"""Cisco Catalyst (IOS-XE) driver — the Phase 1 reference vendor.

Uses NAPALM's `ios` driver, which gives a normalized config/facts model out of
the box. NAPALM is imported lazily so the rest of the package (and the unit
tests) load without the native SSH dependencies installed.
"""

from __future__ import annotations

import structlog

from ..models import ConfigResult, HealthResult
from .base import DeviceDriver

log = structlog.get_logger(__name__)


class CiscoCatalystDriver(DeviceDriver):
    vendor_os = "ios"

    def _open(self):
        """Return an opened NAPALM ios connection (caller closes it)."""
        from napalm import get_network_driver  # lazy: native dep

        driver = get_network_driver("ios")
        optional_args = {"port": self.device.port}
        if self.credentials.enable:
            optional_args["secret"] = self.credentials.enable
        conn = driver(
            hostname=self.device.mgmt_host,
            username=self.credentials.username,
            password=self.credentials.password,
            optional_args=optional_args,
        )
        conn.open()
        return conn

    def get_config(self) -> ConfigResult:
        log.info("config.pull", device=self.device.name, host=self.device.mgmt_host)
        conn = self._open()
        try:
            cfg = conn.get_config(retrieve="all")
        finally:
            conn.close()
        return ConfigResult(
            device_name=self.device.name,
            running=cfg.get("running", ""),
            startup=cfg.get("startup") or None,
        )

    def health(self) -> HealthResult:
        log.info("health.check", device=self.device.name, host=self.device.mgmt_host)
        conn = self._open()
        try:
            facts = conn.get_facts()
            try:
                env = conn.get_environment()
            except (NotImplementedError, Exception):  # noqa: BLE001 - env optional on some IOS
                env = {}
        finally:
            conn.close()

        metrics: dict = {}
        if env:
            cpu = env.get("cpu") or {}
            if cpu:
                first = next(iter(cpu.values()), {})
                metrics["cpu_usage"] = first.get("%usage")
            mem = env.get("memory") or {}
            if mem:
                metrics["memory_used"] = mem.get("used_ram")
                metrics["memory_total"] = mem.get("available_ram")

        return HealthResult(
            device_name=self.device.name,
            reachable=True,
            facts={
                "vendor": facts.get("vendor"),
                "model": facts.get("model"),
                "os_version": facts.get("os_version"),
                "serial_number": facts.get("serial_number"),
                "uptime": facts.get("uptime"),
                "hostname": facts.get("hostname"),
            },
            metrics=metrics,
        )
