"""Durable results store backed by Postgres (sync psycopg2).

The store methods stay synchronous so the subscriber callback can persist a
record without awaiting the store. One table:

  results   — one row per JobResult event, keyed by a content hash ``id``
              (device|op|ts). Inserts are idempotent (``ON CONFLICT DO NOTHING``)
              so a duplicate publish of the same event is a no-op. The raw
              JobResult ``data`` dict is stored in ``detail`` jsonb.

``latest()`` uses ``SELECT DISTINCT ON (device, op) ... ORDER BY device, op,
ts DESC`` to pull the newest row per (device, op), then re-sorts newest-first in
Python.

psycopg2 is imported lazily inside __init__ so memory-mode deployments and the
unit tests never need the driver installed.
"""

from __future__ import annotations

import json

import structlog

from .models import ResultRecord

log = structlog.get_logger(__name__)


_DDL = """
CREATE TABLE IF NOT EXISTS results (
    id          text PRIMARY KEY,
    device      text NOT NULL,
    op          text NOT NULL,
    ok          boolean NOT NULL,
    status      text NOT NULL,
    summary     text NOT NULL,
    detail      jsonb NOT NULL,
    ts          text NOT NULL
);
CREATE INDEX IF NOT EXISTS results_device_op_ts ON results (device, op, ts DESC);
"""


class PostgresResultStore:
    """Durable results store: idempotent insert keyed by content hash id."""

    def __init__(self, db_url: str) -> None:
        if not db_url:
            raise ValueError("RESULTS_DB_URL is required for the postgres store")
        self._db_url = db_url
        try:
            import psycopg2  # noqa: F401  (lazy, optional dependency)
        except ImportError as exc:  # pragma: no cover - import guard
            raise RuntimeError(
                "psycopg2-binary is required for RESULTS_STORE=postgres"
            ) from exc
        self._psycopg2 = psycopg2
        self._conn = self._connect()
        self._ensure_schema()
        log.info("results.store.postgres.ready")

    # -- connection ---------------------------------------------------------

    def _connect(self):
        try:
            conn = self._psycopg2.connect(self._db_url)
            conn.autocommit = True  # autocommit per write is fine for low volume
            return conn
        except Exception as exc:  # pragma: no cover - needs a live DB
            log.error("results.store.postgres.connect_failed", error=str(exc))
            raise RuntimeError(f"cannot connect to RESULTS_DB_URL: {exc}") from exc

    def _cursor(self):
        """A cursor on a live connection, reconnecting once if it dropped."""
        try:
            if self._conn.closed:
                self._conn = self._connect()
            return self._conn.cursor()
        except Exception:  # pragma: no cover - needs a live DB
            self._conn = self._connect()
            return self._conn.cursor()

    def _ensure_schema(self) -> None:
        with self._cursor() as cur:
            cur.execute(_DDL)

    # -- contract -----------------------------------------------------------

    def add(self, record: ResultRecord) -> ResultRecord:
        """Insert the record; duplicate ids (same event) are ignored."""
        try:
            with self._cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO results
                        (id, device, op, ok, status, summary, detail, ts)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (
                        record.id,
                        record.device,
                        record.op,
                        record.ok,
                        record.status,
                        record.summary,
                        json.dumps(record.detail),
                        record.ts,
                    ),
                )
        except Exception as exc:  # pragma: no cover - needs a live DB
            log.error("results.store.postgres.add_failed", id=record.id, error=str(exc))
            raise RuntimeError(f"failed to persist result {record.id}: {exc}") from exc
        return record

    def recent(
        self, device: str | None, op: str | None, limit: int
    ) -> list[ResultRecord]:
        clauses = []
        params: list = []
        if device is not None:
            clauses.append("device = %s")
            params.append(device)
        if op is not None:
            clauses.append("op = %s")
            params.append(op)
        where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
        params.append(limit)
        try:
            with self._cursor() as cur:
                cur.execute(
                    "SELECT id, device, op, ok, status, summary, detail, ts "
                    f"FROM results{where} ORDER BY ts DESC LIMIT %s",
                    tuple(params),
                )
                rows = cur.fetchall()
        except Exception as exc:  # pragma: no cover - needs a live DB
            log.error("results.store.postgres.recent_failed", error=str(exc))
            raise RuntimeError(f"failed to read results: {exc}") from exc
        return [self._as_record(r) for r in rows]

    def latest(self) -> list[ResultRecord]:
        try:
            with self._cursor() as cur:
                cur.execute(
                    "SELECT DISTINCT ON (device, op) "
                    "id, device, op, ok, status, summary, detail, ts "
                    "FROM results ORDER BY device, op, ts DESC"
                )
                rows = cur.fetchall()
        except Exception as exc:  # pragma: no cover - needs a live DB
            log.error("results.store.postgres.latest_failed", error=str(exc))
            raise RuntimeError(f"failed to read latest results: {exc}") from exc
        records = [self._as_record(r) for r in rows]
        records.sort(key=lambda r: r.ts, reverse=True)
        return records

    @classmethod
    def _as_record(cls, row) -> ResultRecord:
        return ResultRecord(
            id=row[0],
            device=row[1],
            op=row[2],
            ok=row[3],
            status=row[4],
            summary=row[5],
            detail=cls._as_doc(row[6]),
            ts=row[7],
        )

    @staticmethod
    def _as_doc(value):
        """psycopg2 returns jsonb as a dict already, but tolerate raw text."""
        if isinstance(value, str):
            return json.loads(value)
        return value or {}
