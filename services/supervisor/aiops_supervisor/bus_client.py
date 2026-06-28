"""NATS client — the supervisor's link to the execution worker.

Sends a JobRequest and awaits the JobResult (request/reply). This is the same
wire contract the worker serves on `aiops.jobs.<op>`.
"""

from __future__ import annotations

import json

import nats
import structlog

log = structlog.get_logger(__name__)


class BusClient:
    def __init__(self, nats_url: str, subject: str = "aiops.jobs", timeout: float = 600.0):
        self._url = nats_url
        self._subject = subject
        self._timeout = timeout
        self._nc = None

    async def connect(self) -> None:
        self._nc = await nats.connect(self._url)
        log.info("bus.connected", nats=self._url)

    async def close(self) -> None:
        if self._nc is not None:
            await self._nc.drain()

    async def request_job(self, op: str, device: dict, params: dict | None = None) -> dict:
        """Run `op` against `device` on the worker; return the JobResult dict."""
        if self._nc is None:
            raise RuntimeError("BusClient not connected")
        payload = {"op": op, "device": device, "params": params or {}}
        msg = await self._nc.request(
            f"{self._subject}.{op}", json.dumps(payload).encode(), timeout=self._timeout
        )
        return json.loads(msg.data)
