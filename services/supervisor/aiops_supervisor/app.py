"""FastAPI surface for the supervisor — the agents' entry point.

POST /intent {"text": "..."} routes a natural-language intent through the agent
(which needs an LLM key). POST /run {op, device_name} triggers a single safe
capability job on the worker directly — no LLM involved, so it works without a
key and backs the dashboard's "Run backup/health/compliance" buttons.

The agent is built lazily on first /intent so the service boots (and serves
/devices and /run) even when ANTHROPIC_MODEL is unset.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .bus_client import BusClient
from .config import settings
from .inventory import device_names, get_device, load_inventory

log = structlog.get_logger(__name__)

# Safe, non-mutating capabilities the dashboard may trigger directly. `apply` is
# intentionally excluded — device-mutating changes must go through the change-
# management service (policy + approval + HMAC token), never this path.
RUNNABLE_OPS = frozenset({"backup", "get_config", "health", "compliance"})


class Intent(BaseModel):
    text: str


class IntentReply(BaseModel):
    reply: str


class RunJob(BaseModel):
    op: str
    device_name: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Imported lazily so the module loads without LangChain installed (tests).
    from .change_client import ChangeClient

    bus = BusClient(settings.nats_url, settings.job_subject, settings.request_timeout)
    await bus.connect()
    app.state.bus = bus
    app.state.devices = load_inventory(settings.inventory_path)
    app.state.change = ChangeClient(settings.change_url)
    app.state.agent = None  # built lazily on first /intent (needs an LLM key)
    log.info(
        "supervisor.ready",
        devices=len(app.state.devices),
        model=settings.anthropic_model or "(unset)",
    )
    try:
        yield
    finally:
        await bus.close()


app = FastAPI(title="AIOps NetOps Supervisor", lifespan=lifespan)


def _get_agent(app: FastAPI):
    """Build the LangGraph agent on first use. Raises if no model is configured."""
    if app.state.agent is None:
        from .agent import build_agent
        from .tools import build_tools

        app.state.agent = build_agent(
            build_tools(app.state.bus, app.state.devices, app.state.change)
        )
    return app.state.agent


@app.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}


@app.get("/devices")
async def devices() -> list[dict]:
    """The managed device inventory (read-only) — backs the dashboard Inventory view."""
    return app.state.devices


@app.post("/run")
async def run(body: RunJob) -> dict:
    """Trigger a single safe capability job on the worker; return the JobResult.

    Backs the dashboard's Run buttons. No LLM needed. `apply` is rejected — that
    path is gated by the change-management service.
    """
    if body.op not in RUNNABLE_OPS:
        raise HTTPException(
            status_code=400,
            detail=f"op '{body.op}' is not runnable here. Allowed: {sorted(RUNNABLE_OPS)}",
        )
    dev = get_device(app.state.devices, body.device_name)
    if dev is None:
        raise HTTPException(
            status_code=404,
            detail=f"unknown device '{body.device_name}'. Known: {device_names(app.state.devices)}",
        )
    try:
        return await app.state.bus.request_job(body.op, dev)
    except Exception as exc:  # noqa: BLE001 — surface bus/worker errors to the UI
        raise HTTPException(status_code=502, detail=f"job failed: {exc}")


@app.post("/intent", response_model=IntentReply)
async def intent(body: Intent) -> IntentReply:
    try:
        agent = _get_agent(app)
    except Exception as exc:  # noqa: BLE001 — most likely ANTHROPIC_MODEL unset
        raise HTTPException(
            status_code=503,
            detail=f"agent unavailable (set ANTHROPIC_API_KEY + ANTHROPIC_MODEL): {exc}",
        )
    result = await agent.ainvoke({"messages": [("user", body.text)]})
    messages = result.get("messages", [])
    reply = messages[-1].content if messages else ""
    if isinstance(reply, list):  # content can be a list of blocks
        reply = "".join(b.get("text", "") for b in reply if isinstance(b, dict))
    return IntentReply(reply=reply or "(no response)")
