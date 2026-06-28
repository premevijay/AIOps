"""Vendor-neutral domain models shared across drivers, secrets, and jobs.

Everything above the connectivity plane speaks these models, never raw
vendor-specific structures. Adding a vendor means writing a driver that maps
into these types — not changing anything that consumes them.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class DeviceType(str, Enum):
    switch = "switch"
    firewall = "firewall"
    load_balancer = "load_balancer"
    router = "router"


class Device(BaseModel):
    """A managed device as the platform knows it (inventory/CMDB record)."""

    name: str
    vendor: str                      # e.g. "Cisco Catalyst"
    os: str                          # driver key, e.g. "ios", "nxos", "panos"
    type: DeviceType = DeviceType.switch
    mgmt_host: str                   # mgmt IP or DNS name
    port: int = 22
    # Where this device's credentials live in the vault (provider-specific path).
    vault_path: str = ""


class DeviceCredentials(BaseModel):
    """Short-lived credentials for a single device session. Never persisted."""

    username: str
    password: str = Field(repr=False)
    enable: str | None = Field(default=None, repr=False)

    def masked(self) -> dict[str, str]:
        """Loggable form — no secret material."""
        return {"username": self.username, "password": "***", "enable": "***" if self.enable else ""}


class ConfigResult(BaseModel):
    """Result of a config pull / backup."""

    device_name: str
    running: str
    startup: str | None = None
    # Stable identifier the Backup agent uses to commit/version (set by caller).
    revision: str | None = None


class HealthResult(BaseModel):
    """Normalized health snapshot."""

    device_name: str
    reachable: bool
    facts: dict = Field(default_factory=dict)        # vendor/os/uptime/model/serial...
    metrics: dict = Field(default_factory=dict)      # cpu/mem/temp/env...
    score: int | None = None                          # 0-100, computed by caller/agent


class JobRequest(BaseModel):
    """A unit of work the supervisor/agents put on the bus for a worker."""

    op: str                          # backup | get_config | health | diff
    device: Device
    params: dict = Field(default_factory=dict)


class JobResult(BaseModel):
    """The worker's reply for a JobRequest."""

    op: str
    device_name: str
    ok: bool
    data: dict | None = None
    error: str | None = None
    duration_ms: int | None = None
