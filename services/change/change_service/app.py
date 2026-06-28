"""FastAPI surface for the change-management service.

The HTTP entry point to the approval authority: propose a change, list/inspect
them, approve or reject (the human gate), and apply (token-gated dispatch to the
worker). The orchestration lives in Service; this module only maps it to HTTP.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone

import structlog
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .bus_client import BusClient
from .config import settings
from .models import ChangeRequest, Device
from .service import Service
from .store import InMemoryChangeStore

log = structlog.get_logger(__name__)


class CreateBody(BaseModel):
    device: Device
    intent: str
    config: list[str]
    requested_by: str
    window: dict | None = None


class ApproveBody(BaseModel):
    approver: str


class RejectBody(BaseModel):
    approver: str
    reason: str = ""


@asynccontextmanager
async def lifespan(app: FastAPI):
    store = InMemoryChangeStore()
    bus = BusClient(settings.nats_url, settings.job_subject, settings.request_timeout)
    await bus.connect()
    app.state.bus = bus
    app.state.service = Service(
        store, bus, settings.change_signing_key, settings.require_change_window
    )
    log.info("change.ready", require_window=settings.require_change_window)
    try:
        yield
    finally:
        await bus.close()


app = FastAPI(title="AIOps Change Management", lifespan=lifespan)


@app.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}


@app.post("/changes", response_model=ChangeRequest)
async def create_change(body: CreateBody) -> ChangeRequest:
    return app.state.service.create(
        body.device, body.intent, body.config, body.requested_by, body.window
    )


@app.get("/changes", response_model=list[ChangeRequest])
async def list_changes() -> list[ChangeRequest]:
    return app.state.service._store.list()


@app.get("/changes/{change_id}", response_model=ChangeRequest)
async def get_change(change_id: str) -> ChangeRequest:
    change = app.state.service._store.get(change_id)
    if change is None:
        raise HTTPException(status_code=404, detail="change not found")
    return change


@app.post("/changes/{change_id}/approve", response_model=ChangeRequest)
async def approve_change(change_id: str, body: ApproveBody) -> ChangeRequest:
    try:
        return app.state.service.approve(change_id, body.approver)
    except KeyError:
        raise HTTPException(status_code=404, detail="change not found")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/changes/{change_id}/reject", response_model=ChangeRequest)
async def reject_change(change_id: str, body: RejectBody) -> ChangeRequest:
    try:
        return app.state.service.reject(change_id, body.approver, body.reason)
    except KeyError:
        raise HTTPException(status_code=404, detail="change not found")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/changes/{change_id}/apply", response_model=ChangeRequest)
async def apply_change(change_id: str) -> ChangeRequest:
    try:
        return await app.state.service.apply(change_id, datetime.now(timezone.utc))
    except KeyError:
        raise HTTPException(status_code=404, detail="change not found")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
