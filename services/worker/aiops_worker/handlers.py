"""Job handlers — resolve creds, then run the capability playbook via the
configured execution backend (ansible-runner locally, or AWX in production).

Ansible execution is blocking, so it runs in a thread to keep the asyncio event
loop responsive.
"""

from __future__ import annotations

import asyncio
import time

import structlog

from .config import settings
from .execution import OP_PLAYBOOK
from .execution.base import WRITE_OPS, ExecutionBackend
from .firewall_api import FIREWALL_OPS, query_firewall
from .firewall_caps import FIREWALL_CAP_OS, run_firewall_capability
from .models import JobRequest, JobResult
from .secrets.base import SecretProvider
from .signing import verify

log = structlog.get_logger(__name__)

# Every op this worker knows: Ansible-backed capabilities + direct firewall ops.
KNOWN_OPS = set(OP_PLAYBOOK) | set(FIREWALL_OPS)

# Structured capabilities that, for firewalls in FIREWALL_CAP_OS, run directly
# over the vendor API (firewall_caps) instead of Ansible. PAN-OS keeps Ansible.
STRUCTURED_FW_OPS = frozenset({"backup", "get_config", "health", "compliance"})


def _ms(start: float) -> int:
    return int((time.monotonic() - start) * 1000)


async def handle(req: JobRequest, secrets: SecretProvider | None,
                 executor: ExecutionBackend) -> JobResult:
    start = time.monotonic()
    try:
        if req.op not in KNOWN_OPS:
            raise ValueError(f"unknown op: {req.op!r}")

        # The gate: device-mutating ops require a valid approval token issued by
        # the change-management service. No token (or a bad one) => refused.
        if req.op in WRITE_OPS:
            change_id = req.params.get("change_id", "")
            token = req.params.get("approval_token", "")
            if not verify(change_id, token, settings.change_signing_key):
                log.warning("write.blocked", op=req.op, device=req.device.name, change_id=change_id)
                return JobResult(
                    op=req.op, device_name=req.device.name, ok=False,
                    error="unapproved write blocked: missing or invalid approval token",
                    duration_ms=_ms(start),
                )

        # Direct firewall query path (non-Ansible, read-only). Needs creds for the
        # device's management API, resolved from the vault like any other op.
        if req.op in FIREWALL_OPS:
            if secrets is None:
                raise RuntimeError(
                    "firewall_query needs a secret provider; not available with this backend config"
                )
            creds = await secrets.get_device_credentials(req.device)
            data = await query_firewall(req.device, creds, req.params)
            return JobResult(
                op=req.op, device_name=req.device.name, ok=bool(data.get("ok")),
                data=data, error=None if data.get("ok") else "query returned an error status",
                duration_ms=_ms(start),
            )

        # Structured firewall capabilities (FortiGate/Check Point/FTD) run
        # directly over the vendor API rather than Ansible. PAN-OS stays on the
        # Ansible path (its os is not in FIREWALL_CAP_OS).
        if req.op in STRUCTURED_FW_OPS and (req.device.os or "").lower() in FIREWALL_CAP_OS:
            if secrets is None:
                raise RuntimeError(
                    "firewall capabilities need a secret provider; not available with this backend config"
                )
            creds = await secrets.get_device_credentials(req.device)
            data = await run_firewall_capability(req.op, req.device, creds, settings.config_store)
            return JobResult(
                op=req.op, device_name=req.device.name, ok=bool(data.get("ok")),
                data=data, error=None if data.get("ok") else f"{data.get('status')}: {data.get('error', '')}",
                duration_ms=_ms(start),
            )

        # Only resolve creds when the backend needs them (local injects them as
        # extravars; AWX injects its own and runs with secrets=None).
        creds = None
        if executor.needs_credentials and secrets is not None:
            creds = await secrets.get_device_credentials(req.device)
        data = await asyncio.to_thread(executor.run, req.op, req.device, req.params, creds)
        return JobResult(
            op=req.op,
            device_name=req.device.name,
            ok=bool(data.get("ok")),
            data=data,
            error=None if data.get("ok") else f"playbook status={data.get('status')}",
            duration_ms=int((time.monotonic() - start) * 1000),
        )
    except Exception as exc:  # noqa: BLE001 - surface any failure as a result
        log.error("job.failed", op=req.op, device=req.device.name, error=str(exc))
        return JobResult(
            op=req.op,
            device_name=req.device.name,
            ok=False,
            error=f"{type(exc).__name__}: {exc}",
            duration_ms=int((time.monotonic() - start) * 1000),
        )
