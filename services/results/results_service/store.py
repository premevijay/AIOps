"""Results store — lab-grade in-memory implementation + factory.

The store contract is tiny: ``add(record)``, ``recent(device, op, limit)``, and
``latest()``. Any backend (this in-memory one, or
:class:`~results_service.store_postgres.PostgresResultStore`) only needs those
three methods.

WARNING: this in-memory store is an ephemeral, process-local default for
development and tests. Nothing survives a restart. A production deployment that
wants results to outlive the process MUST use durable storage — set
``RESULTS_STORE=postgres`` with ``RESULTS_DB_URL`` (see store_postgres.py).
"""

from __future__ import annotations

from .config import settings
from .models import ResultRecord


class InMemoryResultStore:
    """Process-local list of results. Not durable, not shared."""

    def __init__(self) -> None:
        self._records: list[ResultRecord] = []

    def add(self, record: ResultRecord) -> ResultRecord:
        """Append a record (newest events arrive last)."""
        self._records.append(record)
        return record

    def recent(
        self, device: str | None, op: str | None, limit: int
    ) -> list[ResultRecord]:
        """Newest-first records, optionally filtered by device and/or op."""
        rows = [
            r
            for r in self._records
            if (device is None or r.device == device)
            and (op is None or r.op == op)
        ]
        rows.sort(key=lambda r: r.ts, reverse=True)
        return rows[:limit]

    def latest(self) -> list[ResultRecord]:
        """Most recent record per (device, op) pair, newest-first."""
        newest: dict[tuple[str, str], ResultRecord] = {}
        for r in self._records:
            key = (r.device, r.op)
            current = newest.get(key)
            if current is None or r.ts > current.ts:
                newest[key] = r
        rows = list(newest.values())
        rows.sort(key=lambda r: r.ts, reverse=True)
        return rows


def build_store():
    """Select a store backend from config.

    Returns an :class:`InMemoryResultStore` (the dev default) unless
    ``RESULTS_STORE=postgres``, in which case a durable
    :class:`~results_service.store_postgres.PostgresResultStore` is built against
    ``RESULTS_DB_URL``. The Postgres import is lazy so memory-mode (and the unit
    tests) never need psycopg2 installed.
    """
    backend = (settings.results_store or "memory").lower()
    if backend == "postgres":
        from .store_postgres import PostgresResultStore

        return PostgresResultStore(settings.results_db_url)
    return InMemoryResultStore()
