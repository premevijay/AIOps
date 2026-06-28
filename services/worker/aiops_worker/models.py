"""Vendor-neutral domain models shared across execution, secrets, and jobs.

Everything above the execution plane speaks these models. A device's OS selects
the Ansible group (and thus connection vars/collection); nothing here is
vendor-specific.
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
    os: str                          # ansible group / network_os key: ios, nxos, panos
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


class JobRequest(BaseModel):
    """A unit of work the supervisor/agents put on the bus for a worker.

    `op` is a capability (backup | get_config | health | compliance) that the
    execution backend maps to an Ansible playbook / AWX job template.
    """

    op: str
    device: Device
    params: dict = Field(default_factory=dict)


class JobResult(BaseModel):
    """The worker's reply for a JobRequest. `data` carries the backend result
    (playbook status/stdout/stats, or AWX job id/status/stdout)."""

    op: str
    device_name: str
    ok: bool
    data: dict | None = None
    error: str | None = None
    duration_ms: int | None = None
