"""Change store — lab-grade in-memory implementation + factory.

The store contract is intentionally tiny: ``put(change)``, ``get(id)``,
``list()``. A transition mutates the ChangeRequest (status + audit) and the
service persists the whole thing with a single ``put`` — so any backend (this
in-memory one, or :class:`~change_service.store_postgres.PostgresChangeStore`)
only needs those three methods.

WARNING: this in-memory store is an ephemeral, process-local default for
development and tests. A production deployment MUST use durable storage — set
``CHANGE_STORE=postgres`` with ``CHANGE_DB_URL`` (see store_postgres.py). The
audit ledger in particular must be append-only and tamper-evident — losing or
mutating it defeats the purpose of a human-approval authority.
"""

from __future__ import annotations

from .config import settings
from .models import ChangeRequest


class InMemoryChangeStore:
    """Process-local store of changes keyed by id. Not durable, not shared."""

    def __init__(self) -> None:
        self._changes: dict[str, ChangeRequest] = {}

    def put(self, change: ChangeRequest) -> ChangeRequest:
        """Persist the whole change (status + audit) by reference."""
        self._changes[change.id] = change
        return change

    def get(self, change_id: str) -> ChangeRequest | None:
        return self._changes.get(change_id)

    def list(self) -> list[ChangeRequest]:
        return list(self._changes.values())


def build_store():
    """Select a store backend from config.

    Returns an :class:`InMemoryChangeStore` (the dev default) unless
    ``CHANGE_STORE=postgres``, in which case a durable
    :class:`~change_service.store_postgres.PostgresChangeStore` is built against
    ``CHANGE_DB_URL``. The Postgres import is lazy so memory-mode (and the
    unit tests) never need psycopg2 installed.
    """
    backend = (settings.change_store or "memory").lower()
    if backend == "postgres":
        from .store_postgres import PostgresChangeStore

        return PostgresChangeStore(settings.change_db_url)
    return InMemoryChangeStore()
