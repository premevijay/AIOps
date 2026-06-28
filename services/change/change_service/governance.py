"""Risk / governance read view — pure aggregation, no IO.

``risk_posture`` rolls a ``list[ChangeRequest]`` up into a single posture
snapshot: counts by status and risk level, the open changes that still carry
high/critical risk (awaiting or holding a decision), and the most recent
policy-denied changes. Pure, so it's unit-testable; app.py feeds it
``store.list()``.
"""

from __future__ import annotations

from .models import ChangeRequest, ChangeStatus

_STATUSES = ("proposed", "approved", "rejected", "applied", "failed")
_RISK_LEVELS = ("low", "medium", "high", "critical")
_OPEN_STATUSES = {ChangeStatus.proposed, ChangeStatus.approved}
_HIGH_RISK = {"high", "critical"}


def risk_posture(changes: list[ChangeRequest]) -> dict:
    """Summarize the risk/governance posture across all changes."""
    by_status = {s: 0 for s in _STATUSES}
    by_risk_level = {lvl: 0 for lvl in _RISK_LEVELS}
    open_high_risk: list[dict] = []
    denied: list[ChangeRequest] = []

    for change in changes:
        if change.status.value in by_status:
            by_status[change.status.value] += 1
        if change.risk.level in by_risk_level:
            by_risk_level[change.risk.level] += 1

        if change.status in _OPEN_STATUSES and change.risk.level in _HIGH_RISK:
            open_high_risk.append(
                {
                    "id": change.id,
                    "device": change.device.name,
                    "intent": change.intent,
                    "level": change.risk.level,
                    "score": change.risk.score,
                }
            )

        # Policy-denied changes: created already-rejected with policy violations.
        if change.status == ChangeStatus.rejected and not change.policy.allow:
            denied.append(change)

    # Most recent policy-denied first (by created_at; ISO strings sort lexically).
    denied.sort(key=lambda c: c.created_at, reverse=True)
    recent_denied = [
        {
            "id": c.id,
            "device": c.device.name,
            "intent": c.intent,
            "violations": list(c.policy.violations),
        }
        for c in denied[:10]
    ]

    return {
        "total": len(changes),
        "by_status": by_status,
        "by_risk_level": by_risk_level,
        "open_high_risk": open_high_risk,
        "recent_denied": recent_denied,
    }
