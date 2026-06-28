"""AwxBackend — launch AWX job templates over REST (production path).

The agents' production tool boundary: instead of running Ansible itself, the
worker (or, later, an agent directly) asks AWX to launch a job template. AWX
owns RBAC, audit, scheduling, approvals, and credential injection (Machine cred
+ CyberArk Conjur plugin) — so this backend does NOT pass device credentials.

httpx is imported lazily. `op` maps to a job-template id via template_map.
"""

from __future__ import annotations

import time

import structlog

from ..models import Device, DeviceCredentials
from .base import ExecutionBackend

log = structlog.get_logger(__name__)


class AwxBackend(ExecutionBackend):
    needs_credentials = False     # AWX injects creds via its own credential plugin

    def __init__(self, base_url: str, token: str, template_map: dict[str, str],
                 verify: bool = True, poll_interval: float = 3.0, timeout: float = 600.0):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.template_map = template_map      # op -> job template id (or name)
        self.verify = verify
        self.poll_interval = poll_interval
        self.timeout = timeout

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}

    def run(self, op: str, device: Device, params: dict,
            credentials: DeviceCredentials | None = None) -> dict:
        import httpx  # lazy

        template = self.template_map.get(op)
        if not template:
            raise ValueError(f"no AWX job template mapped for op {op!r}")

        launch_url = f"{self.base_url}/api/v2/job_templates/{template}/launch/"
        payload = {"limit": device.name, "extra_vars": {"target": device.name, **params}}

        log.info("awx.launch", op=op, device=device.name, template=template)
        with httpx.Client(verify=self.verify, timeout=30.0, headers=self._headers()) as client:
            launch = client.post(launch_url, json=payload)
            launch.raise_for_status()
            job_id = launch.json()["id"]

            deadline = time.monotonic() + self.timeout
            status = "pending"
            while time.monotonic() < deadline:
                job = client.get(f"{self.base_url}/api/v2/jobs/{job_id}/").json()
                status = job["status"]
                if status in ("successful", "failed", "error", "canceled"):
                    break
                time.sleep(self.poll_interval)

            stdout = client.get(
                f"{self.base_url}/api/v2/jobs/{job_id}/stdout/?format=txt"
            ).text[-20000:]

        return {"ok": status == "successful", "status": status, "job_id": job_id, "stdout": stdout}
