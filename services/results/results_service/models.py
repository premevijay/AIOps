"""Domain models for the results store.

A ``ResultRecord`` is the normalized, stored shape of one worker JobResult. The
worker publishes a raw JobResult on ``aiops.results``; the pure extract logic
turns it into a record with a short ``status`` and one-line ``summary`` the
dashboard tiles can render directly.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ResultRecord(BaseModel):
    """A normalized, stored worker result row."""

    id: str       # content hash of device|op|ts — stable, dedupes duplicate publishes
    device: str
    op: str
    ok: bool
    status: str   # ok | failed | changed | drift | compliant | non-compliant
    summary: str  # one-line human summary
    detail: dict = Field(default_factory=dict)  # the raw JobResult data dict, or {}
    ts: str       # ISO-8601 UTC ingest timestamp — passed in, never generated in pure code
