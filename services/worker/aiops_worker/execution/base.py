"""Execution backend interface + the op->playbook map.

The worker no longer talks to devices directly — it runs Ansible. Two backends
implement this contract:
  - LocalRunnerBackend: ansible-runner, embedded in the worker (lab path)
  - AwxBackend: launches AWX job templates over REST (production path)

Both run the SAME playbooks under ansible/. Pure helpers here (inventory +
extravars building) are unit-tested without Ansible installed.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from ..models import Device, DeviceCredentials

# Capability op -> playbook filename under ansible/playbooks/.
OP_PLAYBOOK: dict[str, str] = {
    "backup": "backup.yml",
    "get_config": "backup.yml",
    "health": "health.yml",
    "compliance": "compliance.yml",
}


def build_inventory(device: Device) -> dict:
    """One-host inventory placing the device in a group named after its OS, so
    ansible/group_vars/<os>.yml supplies the right connection vars."""
    return {
        "all": {
            "children": {
                "network": {
                    "children": {
                        device.os: {
                            "hosts": {
                                device.name: {
                                    "ansible_host": device.mgmt_host,
                                    "ansible_port": device.port,
                                }
                            }
                        }
                    }
                }
            }
        }
    }


def build_extravars(device: Device, config_store: str, credentials: DeviceCredentials) -> dict:
    """Per-run variables, including the creds the worker fetched from CyberArk.
    Consumed by group_vars/<os>.yml. (AWX supplies creds itself and ignores these.)"""
    return {
        "target": device.name,
        "config_store": config_store,
        "device_username": credentials.username,
        "device_password": credentials.password,
        "device_enable": credentials.enable or "",
    }


class ExecutionBackend(ABC):
    @abstractmethod
    def run(self, op: str, device: Device, params: dict, credentials: DeviceCredentials) -> dict:
        """Run the playbook for `op` against `device`. Returns a dict with at
        least {ok: bool, status: str, stdout: str}."""
        raise NotImplementedError
