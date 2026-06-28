"""Job handlers — resolve creds, then run the capability playbook via the
configured execution backend (ansible-runner locally, or AWX in production).

Ansible execution is blocking, so it runs in a thread to keep the asyncio event
loop responsive.
"""

from __future__ import annotations

import asyncio
import time

import structlog

from .execution import OP_PLAYBOOK
from .execution.base import ExecutionBackend
from .models import JobRequest, JobResult
from .secrets.base import SecretProvider

log = structlog.get_logger(__name__)


async def handle(req: JobRequest, secrets: SecretProvider, executor: ExecutionBackend) -> JobResult:
    start = time.monotonic()
    try:
        if req.op not in OP_PLAYBOOK:
            raise ValueError(f"unknown op: {req.op!r}")
        # The local backend injects these creds as extravars; the AWX backend
        # ignores them (AWX injects its own). Cheap to fetch either way.
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
