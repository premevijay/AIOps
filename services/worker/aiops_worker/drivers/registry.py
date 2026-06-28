"""Driver registry — maps Device.os to a DeviceDriver implementation.

Adding a vendor = register one class here. Nothing else in the platform changes.
"""

from __future__ import annotations

from ..models import Device, DeviceCredentials
from .base import DeviceDriver
from .catalyst import CiscoCatalystDriver

_REGISTRY: dict[str, type[DeviceDriver]] = {
    CiscoCatalystDriver.vendor_os: CiscoCatalystDriver,
    # Phase 5+: "nxos": CiscoNexusDriver, "panos": PanOsDriver, ...
}


def supported_os() -> list[str]:
    return sorted(_REGISTRY)


def get_driver(device: Device, credentials: DeviceCredentials) -> DeviceDriver:
    cls = _REGISTRY.get(device.os)
    if cls is None:
        raise ValueError(
            f"no driver for os={device.os!r} (supported: {', '.join(supported_os())})"
        )
    return cls(device, credentials)
