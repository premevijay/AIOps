"""NATS subscriber — the results store's link to the worker fanout.

The worker publishes every JobResult as JSON on ``aiops.results`` (fanout, no
reply). This subscriber consumes them, stamps an ingest timestamp, normalizes
each into a ResultRecord (via the pure ``to_record``), and persists it to the
store. It subscribes with queue group ``results-store`` so multiple replicas
share the stream and a single result is stored once, not once per replica.

The message callback is defensive: a bad payload is logged and swallowed so one
malformed message can't kill the subscription.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

import nats
import structlog

from .extract import to_record

log = structlog.get_logger(__name__)


class ResultsSubscriber:
    def __init__(self, nats_url: str, subject: str, store) -> None:
        self._url = nats_url
        self._subject = subject
        self._store = store
        self._nc = None

    async def start(self) -> None:
        self._nc = await nats.connect(self._url)
        await self._nc.subscribe(
            self._subject, queue="results-store", cb=self._on_message
        )
        log.info("results.subscribed", nats=self._url, subject=self._subject)

    async def close(self) -> None:
        if self._nc is not None:
            await self._nc.drain()

    async def _on_message(self, msg) -> None:
        try:
            payload = json.loads(msg.data)
            ts = datetime.now(timezone.utc).isoformat()
            record = to_record(payload, ts)
            self._store.add(record)
            log.info(
                "results.stored",
                device=record.device,
                op=record.op,
                status=record.status,
            )
        except Exception as exc:  # one bad message must not kill the subscription
            log.error("results.ingest_failed", error=str(exc))
