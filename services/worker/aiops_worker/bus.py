"""NATS job bus — subscribe to job requests, reply with results.

Workers subscribe to `<job_subject>.<op>` in a queue group so multiple workers
load-balance. Each message is a JobRequest JSON; the reply is a JobResult JSON
(via NATS request/reply when the requester set a reply subject).
"""

from __future__ import annotations

import asyncio

import nats
import structlog

from .config import settings
from .execution import OP_PLAYBOOK, build_executor
from .handlers import handle
from .models import JobRequest, JobResult
from .secrets import build_secret_provider

log = structlog.get_logger(__name__)

# Capabilities this worker serves (each maps to a playbook).
OPS = tuple(OP_PLAYBOOK)


async def run() -> None:
    executor = build_executor()
    # Skip the SecretProvider entirely when the backend handles its own creds
    # (AWX) — otherwise an AWX-only deployment with no DEVICE_* set fails to start.
    secrets = build_secret_provider() if executor.needs_credentials else None
    nc = await nats.connect(settings.nats_url)
    log.info("worker.connected", nats=settings.nats_url, provider=settings.secret_provider,
             backend=settings.execution_backend, ops=list(OPS))

    async def on_message(msg) -> None:
        try:
            req = JobRequest.model_validate_json(msg.data)
        except Exception as exc:  # noqa: BLE001
            log.error("job.bad_request", error=str(exc))
            if msg.reply:
                err = JobResult(op="?", device_name="?", ok=False, error=f"bad request: {exc}")
                await nc.publish(msg.reply, err.model_dump_json().encode())
            return

        log.info("job.received", op=req.op, device=req.device.name)
        result = await handle(req, secrets, executor)
        if msg.reply:
            await nc.publish(msg.reply, result.model_dump_json().encode())
        # Fan out every result to the results store (and any other subscriber).
        # Best-effort: a results-store outage must not fail the job reply.
        try:
            await nc.publish(settings.results_subject, result.model_dump_json().encode())
        except Exception as exc:  # noqa: BLE001
            log.warning("job.result_publish_failed", op=req.op, error=str(exc))
        log.info("job.completed", op=req.op, device=req.device.name, ok=result.ok)

    for op in OPS:
        await nc.subscribe(f"{settings.job_subject}.{op}",
                           queue=settings.queue_group, cb=on_message)

    # Run until cancelled.
    stop = asyncio.Event()
    try:
        await stop.wait()
    finally:
        await nc.drain()
