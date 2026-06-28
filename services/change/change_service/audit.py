"""Audit ledger read view — pure aggregation, no IO.

``flatten_ledger`` collapses every change's per-change audit trail into a single,
filterable, newest-first ledger view. It's pure over a ``list[ChangeRequest]``
so it's trivially unit-testable; app.py feeds it ``store.list()``.
"""

from __future__ import annotations

from .models import ChangeRequest


def flatten_ledger(
    changes: list[ChangeRequest],
    *,
    change_id: str | None = None,
    actor: str | None = None,
    action: str | None = None,
    limit: int = 100,
) -> list[dict]:
    """Flatten audit entries across changes into one ledger view.

    Each item carries the change context alongside the audit line:
    ``{change_id, device, intent, ts, actor, action, detail}``. Optional
    ``change_id``/``actor``/``action`` filter the rows; results are sorted
    newest-first by ``ts`` (ISO strings sort lexicographically) and capped at
    ``limit``.
    """
    rows: list[dict] = []
    for change in changes:
        if change_id is not None and change.id != change_id:
            continue
        for entry in change.audit:
            if actor is not None and entry.actor != actor:
                continue
            if action is not None and entry.action != action:
                continue
            rows.append(
                {
                    "change_id": change.id,
                    "device": change.device.name,
                    "intent": change.intent,
                    "ts": entry.ts,
                    "actor": entry.actor,
                    "action": entry.action,
                    "detail": entry.detail,
                }
            )

    rows.sort(key=lambda r: r["ts"], reverse=True)
    if limit is not None and limit >= 0:
        rows = rows[:limit]
    return rows
