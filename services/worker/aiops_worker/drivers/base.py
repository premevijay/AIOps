"""DeviceDriver interface.

One driver per vendor, all behind this common contract so the rest of the
platform stays vendor-neutral. Read operations (get_config/backup/health) may
run autonomously. Write operations (apply_config/rollback) are GATED — they
raise here by default and are only enabled once the Phase 4 guardrail +
change-management path (policy-as-code -> approval -> change window -> audit) is
in place.
"""

from __future__ import annotations

import difflib
from abc import ABC, abstractmethod

from ..models import ConfigResult, Device, DeviceCredentials, HealthResult


class WriteGatedError(RuntimeError):
    """Raised when a device-mutating operation is attempted before guardrails exist."""


class DeviceDriver(ABC):
    #: driver key matched against Device.os by the registry
    vendor_os: str = ""

    def __init__(self, device: Device, credentials: DeviceCredentials):
        self.device = device
        self.credentials = credentials

    # --- read operations (autonomous) ------------------------------------

    @abstractmethod
    def get_config(self) -> ConfigResult:
        """Pull the running (and, if available, startup) configuration."""

    def backup(self) -> ConfigResult:
        """Backup == a config pull the Backup agent versions. Override if a
        vendor needs a different mechanism (e.g. archive/export)."""
        return self.get_config()

    @abstractmethod
    def health(self) -> HealthResult:
        """Return a normalized health snapshot (facts + key metrics)."""

    # --- write operations (GATED until Phase 4) --------------------------

    def apply_config(self, config: str) -> None:
        raise WriteGatedError(
            f"apply_config is gated for {self.device.name}: writes require the "
            "change-management approval path (Phase 4)."
        )

    def rollback(self, revision: str | None = None) -> None:
        raise WriteGatedError(
            f"rollback is gated for {self.device.name}: writes require the "
            "change-management approval path (Phase 4)."
        )

    # --- pure helpers -----------------------------------------------------

    @staticmethod
    def diff(old: str, new: str, *, fromname: str = "running", toname: str = "golden") -> str:
        """Unified diff between two configs. Pure; no device contact."""
        return "".join(
            difflib.unified_diff(
                old.splitlines(keepends=True),
                new.splitlines(keepends=True),
                fromfile=fromname,
                tofile=toname,
            )
        )
