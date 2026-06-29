"""FastAPI surface for the results store.

A thin read API over the persisted worker results. The subscriber (started in
the lifespan) does the writing; these endpoints only read. ``/results/latest``
is what the dashboard's Compliance/Backup/Health tiles call — the most recent
record per device+op.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI

from .config import settings
from .models import ResultRecord
from .store import build_store
from .subscriber import ResultsSubscriber

log = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    store = build_store()
    sub = ResultsSubscriber(settings.nats_url, settings.results_subject, store)
    await sub.start()
    app.state.store = store
    app.state.sub = sub
    log.info("results.ready", store=settings.results_store)
    try:
        yield
    finally:
        await sub.close()


app = FastAPI(title="AIOps Results Store", lifespan=lifespan)


@app.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}


@app.get("/results", response_model=list[ResultRecord])
async def get_results(
    device: str | None = None,
    op: str | None = None,
    limit: int = 100,
) -> list[ResultRecord]:
    """Newest-first results, optionally filtered by device and/or op."""
    return app.state.store.recent(device, op, limit)


@app.get("/results/latest", response_model=list[ResultRecord])
async def get_latest() -> list[ResultRecord]:
    """The most recent record per device+op — what the dashboard tiles read."""
    return app.state.store.latest()
