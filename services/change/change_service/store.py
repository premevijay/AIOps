"""Change store — lab-grade in-memory implementation.

WARNING: this is an ephemeral, process-local store for development and tests.
A production deployment MUST use durable storage (Postgres / object store). The
audit ledger in particular must be append-only and tamper-evident — losing or
mutating it defeats the purpose of a human-approval authority. Treat this class
as the interface contract a real backend should implement.
"""

from __future__ import annotations

from .models import AuditEntry, ChangeRequest


class InMemoryChangeStore:
    """Process-local store of changes keyed by id. Not durable, not shared."""

    def __init__(self) -> None:
        self._changes: dict[str, ChangeRequest] = {}

    def put(self, change: ChangeRequest) -> ChangeRequest:
        self._changes[change.id] = change
        return change

    def get(self, change_id: str) -> ChangeRequest | None:
        return self._changes.get(change_id)

    def list(self) -> list[ChangeRequest]:
        return list(self._changes.values())

    def append_audit(self, change_id: str, entry: AuditEntry) -> None:
        """Append an audit entry to a stored change (append-only by contract)."""
        change = self._changes.get(change_id)
        if change is None:
            raise KeyError(change_id)
        change.audit.append(entry)
