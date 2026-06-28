"""Pure normalization: a raw worker JobResult -> a stored ResultRecord.

No I/O, no clock. ``to_record`` is the entire normalization contract and is
fully unit-testable: it takes the JobResult dict and an explicit ``ts`` (the
subscriber generates the real timestamp and passes it in, so this stays
deterministic). It derives a short ``status`` and a one-line ``summary`` per op
so the dashboard's Compliance/Backup/Health tiles can render a record directly.
"""

from __future__ import annotations

import hashlib

from .models import ResultRecord


def _make_id(device_name: str, op: str, ts: str) -> str:
    """Content hash of device|op|ts — stable per event, dedupes re-publishes."""
    return hashlib.sha1(f"{device_name}|{op}|{ts}".encode()).hexdigest()[:16]


def _truthy(value) -> bool:
    return bool(value)


def to_record(job_result: dict, ts: str) -> ResultRecord:
    """Normalize a worker JobResult dict into a ResultRecord at time ``ts``.

    Tolerant of missing keys and a null ``data``: the per-op logic is defensive
    so one odd payload still produces a usable record rather than raising.
    """
    job_result = job_result or {}
    op = str(job_result.get("op") or "")
    device_name = str(job_result.get("device_name") or "")
    ok = bool(job_result.get("ok"))
    data = job_result.get("data")
    error = job_result.get("error")

    detail = data if isinstance(data, dict) else {}

    if not ok:
        status = "failed"
        summary = error or "job failed"
    elif op in ("backup", "get_config"):
        if _truthy(detail.get("changed")) or _truthy(detail.get("drift")):
            status = "changed"
            summary = "config drift detected"
        else:
            status = "ok"
            summary = "config captured"
    elif op == "health":
        status = "ok"
        summary = detail.get("summary") or "health collected"
    elif op == "compliance":
        if isinstance(detail.get("compliant"), bool):
            compliant = detail["compliant"]
        else:
            violations = detail.get("violations") or detail.get("failed") or []
            compliant = not (isinstance(violations, list) and len(violations) > 0)
        if compliant:
            status = "compliant"
            summary = "compliant"
        else:
            status = "non-compliant"
            violations = detail.get("violations") or detail.get("failed") or []
            count = len(violations) if isinstance(violations, list) else 0
            summary = f"{count} failure(s)" if count else "non-compliant"
    elif op == "apply":
        if _truthy(detail.get("changed")):
            status = "changed"
        else:
            status = "ok"
        summary = "config applied"
    else:
        status = "ok" if ok else "failed"
        summary = "completed"

    return ResultRecord(
        id=_make_id(device_name, op, ts),
        device=device_name,
        op=op,
        ok=ok,
        status=status,
        summary=summary,
        detail=detail,
        ts=ts,
    )
