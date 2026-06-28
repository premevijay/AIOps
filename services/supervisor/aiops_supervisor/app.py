"""FastAPI surface for the supervisor — the agents' entry point.

POST /intent {"text": "..."} routes a natural-language intent through the agent,
which calls capability tools (which run jobs on the worker) and returns a reply.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from pydantic import BaseModel

from .bus_client import BusClient
from .config import settings
from .inventory import load_inventory

log = structlog.get_logger(__name__)


class Intent(BaseModel):
    text: str


class IntentReply(BaseModel):
    reply: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Imported lazily so the module loads without LangChain installed (tests).
    from .agent import build_agent
    from .change_client import ChangeClient
    from .tools import build_tools

    bus = BusClient(settings.nats_url, settings.job_subject, settings.request_timeout)
    await bus.connect()
    devices = load_inventory(settings.inventory_path)
    change = ChangeClient(settings.change_url)
    app.state.bus = bus
    app.state.devices = devices
    app.state.agent = build_agent(build_tools(bus, devices, change))
    log.info("supervisor.ready", devices=len(devices), model=settings.anthropic_model)
    try:
        yield
    finally:
        await bus.close()


app = FastAPI(title="AIOps NetOps Supervisor", lifespan=lifespan)


@app.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}


@app.get("/devices")
async def devices() -> list[dict]:
    """The managed device inventory (read-only) — backs the dashboard Inventory view."""
    return app.state.devices


@app.post("/intent", response_model=IntentReply)
async def intent(body: Intent) -> IntentReply:
    result = await app.state.agent.ainvoke({"messages": [("user", body.text)]})
    messages = result.get("messages", [])
    reply = messages[-1].content if messages else ""
    if isinstance(reply, list):  # content can be a list of blocks
        reply = "".join(b.get("text", "") for b in reply if isinstance(b, dict))
    return IntentReply(reply=reply or "(no response)")
