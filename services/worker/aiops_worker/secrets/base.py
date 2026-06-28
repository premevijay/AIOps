"""SecretProvider interface.

Every device session fetches short-lived credentials through this interface and
never persists them. CyberArk is the Phase 1 implementation (decision #2);
HashiCorp Vault drops in later behind the same contract.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from ..models import Device, DeviceCredentials


class SecretProvider(ABC):
    """Resolve per-device credentials at connect time."""

    @abstractmethod
    async def get_device_credentials(self, device: Device) -> DeviceCredentials:
        """Return short-lived credentials for `device`. Must not cache to disk.

        Implementations should audit every fetch (who/which device/when).
        """
        raise NotImplementedError
