"""Domain models for the change-management flow.

The `Device` shape mirrors the worker/supervisor inventory record so a change can
carry its target device verbatim onto the bus. Everything else describes a change
as it moves proposed -> approved/rejected -> applied/failed, with its risk,
policy verdict, optional change window, and an append-only audit trail.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class ChangeStatus(str, Enum):
    proposed = "proposed"
    approved = "approved"
    rejected = "rejected"
    applied = "applied"
    failed = "failed"


class Device(BaseModel):
    """The change's target device — same shape as the worker inventory record."""

    name: str
    vendor: str
    os: str
    mgmt_host: str
    port: int = 22
    vault_path: str = ""


class RiskResult(BaseModel):
    """Heuristic risk assessment of a proposed change."""

    score: int = Field(ge=0, le=100)
    level: str  # low | medium | high | critical
    factors: list[str] = Field(default_factory=list)


class PolicyResult(BaseModel):
    """Policy-as-code verdict for a proposed change."""

    allow: bool
    violations: list[str] = Field(default_factory=list)


class AuditEntry(BaseModel):
    """One immutable line in the change's audit ledger."""

    ts: str   # ISO-8601 timestamp
    actor: str
    action: str
    detail: str = ""


class ChangeRequest(BaseModel):
    """A device-mutating change as the service tracks it end to end."""

    id: str
    device: Device
    intent: str
    config: list[str]              # the config LINES to push
    requested_by: str
    status: ChangeStatus
    risk: RiskResult
    policy: PolicyResult
    window: dict | None = None     # {"start": iso, "end": iso} or None
    created_at: str
    audit: list[AuditEntry] = Field(default_factory=list)
    result: dict | None = None     # the worker's JobResult on apply
