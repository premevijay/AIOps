"""NATS client — the change service's link to the execution worker.

Sends an apply JobRequest and awaits the JobResult (request/reply), matching the
worker's wire contract on `aiops.jobs.apply`. The params carry the change id, the
config lines, and the HMAC approval token the worker independently verifies.
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

    async def request_apply(self, device: dict, params: dict) -> dict:
        """Apply a change against `device` on the worker; return the JobResult dict.

        params must include change_id, approval_token, and config lines. The
        worker verifies the token before touching the device.
        """
        if self._nc is None:
            await self.connect()
        payload = {"op": "apply", "device": device, "params": params}
        msg = await self._nc.request(
            f"{self._subject}.apply", json.dumps(payload).encode(), timeout=self._timeout
        )
        return json.loads(msg.data)
