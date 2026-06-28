"""Job handlers — turn a JobRequest into a driver call and a JobResult.

The worker stays thin: resolve creds via the SecretProvider, resolve the driver
via the registry, run the requested read op. Device I/O is blocking (SSH/API), so
it runs in a thread to keep the asyncio event loop responsive.
"""

from __future__ import annotations

import asyncio
import time

import structlog

from .drivers import get_driver
from .models import JobRequest, JobResult
from .secrets.base import SecretProvider

log = structlog.get_logger(__name__)


async def handle(req: JobRequest, secrets: SecretProvider) -> JobResult:
    start = time.monotonic()
    try:
        creds = await secrets.get_device_credentials(req.device)
        driver = get_driver(req.device, creds)
        data = await asyncio.to_thread(_run_op, driver, req)
        return JobResult(
            op=req.op,
            device_name=req.device.name,
            ok=True,
            data=data,
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


def _run_op(driver, req: JobRequest) -> dict:
    """Blocking driver dispatch. Runs in a worker thread."""
    if req.op in ("backup", "get_config"):
        result = driver.backup() if req.op == "backup" else driver.get_config()
        return result.model_dump()
    if req.op == "health":
        return driver.health().model_dump()
    if req.op == "diff":
        old = req.params.get("old", "")
        new = req.params.get("new", "")
        return {"diff": driver.diff(old, new)}
    raise ValueError(f"unknown op: {req.op!r}")
