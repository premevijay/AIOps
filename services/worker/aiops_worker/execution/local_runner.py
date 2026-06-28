"""LocalRunnerBackend — run playbooks via ansible-runner inside the worker.

The lab execution path: no AWX needed. ansible-runner is imported lazily so the
package (and the unit tests) load without it installed.
"""

from __future__ import annotations

import tempfile

import structlog

from ..models import Device, DeviceCredentials
from .base import ExecutionBackend, OP_PLAYBOOK, build_extravars, build_inventory

log = structlog.get_logger(__name__)


class LocalRunnerBackend(ExecutionBackend):
    def __init__(self, project_dir: str, config_store: str):
        self.project_dir = project_dir
        self.config_store = config_store

    def run(self, op: str, device: Device, params: dict, credentials: DeviceCredentials) -> dict:
        import ansible_runner  # lazy: heavy dep

        playbook = OP_PLAYBOOK[op]
        inventory = build_inventory(device)
        extravars = build_extravars(device, self.config_store, credentials)

        log.info("ansible.run", op=op, device=device.name, playbook=playbook, backend="local")
        with tempfile.TemporaryDirectory(prefix="aiops-runner-") as tmp:
            r = ansible_runner.run(
                private_data_dir=tmp,
                project_dir=self.project_dir,
                playbook=playbook,
                inventory=inventory,
                extravars=extravars,
                envvars={"ANSIBLE_CONFIG": f"{self.project_dir}/ansible.cfg",
                         "CONFIG_STORE": self.config_store},
                quiet=True,
            )
        ok = r.status == "successful" and r.rc == 0
        return {
            "ok": ok,
            "status": r.status,
            "rc": r.rc,
            "stats": getattr(r, "stats", None),
            "stdout": (r.stdout.read() if r.stdout else "")[-20000:],
        }
