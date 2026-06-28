"""Durable change store backed by Postgres (sync psycopg2).

The store methods stay synchronous so the service stays sync; the only async
part of the service is apply(), and it never touches the store mid-await. Two
tables:

  changes        — the current change document (full ChangeRequest JSON in
                   ``doc`` jsonb, plus status/created_at columns for cheap
                   queries). Upserted on every ``put``.
  change_audit   — the append-only ledger of record: one row per audit entry,
                   keyed (change_id, audit_index), insert-only. We never update
                   or delete these rows; on ``put`` we insert only the new tail
                   (entries whose index is past what's already stored) with
                   ``ON CONFLICT DO NOTHING``.

Reads reconstruct ChangeRequest straight from ``doc`` (which already carries the
audit array), so get/list are simple; change_audit is the durable, tamper-
evident ledger that outlives any single doc rewrite.

psycopg2 is imported lazily inside __init__ so memory-mode deployments and the
unit tests never need the driver installed.
"""

from __future__ import annotations

import json

import structlog

from .models import ChangeRequest

log = structlog.get_logger(__name__)


_DDL = """
CREATE TABLE IF NOT EXISTS changes (
    id          text PRIMARY KEY,
    status      text NOT NULL,
    created_at  text NOT NULL,
    doc         jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS change_audit (
    seq          bigserial PRIMARY KEY,
    change_id    text NOT NULL,
    audit_index  int  NOT NULL,
    ts           text,
    actor        text,
    action       text,
    detail       text,
    recorded_at  timestamptz DEFAULT now(),
    UNIQUE (change_id, audit_index)
);
"""


class PostgresChangeStore:
    """Durable change store: upsert the doc, append-only audit ledger."""

    def __init__(self, db_url: str) -> None:
        if not db_url:
            raise ValueError("CHANGE_DB_URL is required for the postgres store")
        self._db_url = db_url
        try:
            import psycopg2  # noqa: F401  (lazy, optional dependency)
        except ImportError as exc:  # pragma: no cover - import guard
            raise RuntimeError(
                "psycopg2-binary is required for CHANGE_STORE=postgres"
            ) from exc
        self._psycopg2 = psycopg2
        self._conn = self._connect()
        self._ensure_schema()
        log.info("change.store.postgres.ready")

    # -- connection ---------------------------------------------------------

    def _connect(self):
        try:
            conn = self._psycopg2.connect(self._db_url)
            conn.autocommit = True  # autocommit per write is fine for low volume
            return conn
        except Exception as exc:  # pragma: no cover - needs a live DB
            log.error("change.store.postgres.connect_failed", error=str(exc))
            raise RuntimeError(f"cannot connect to CHANGE_DB_URL: {exc}") from exc

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

    def put(self, change: ChangeRequest) -> ChangeRequest:
        """Upsert the change doc, then append any new audit tail (insert-only)."""
        doc = change.model_dump()
        try:
            with self._cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO changes (id, status, created_at, doc)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE
                        SET status = EXCLUDED.status,
                            doc    = EXCLUDED.doc
                    """,
                    (change.id, change.status.value, change.created_at, json.dumps(doc)),
                )
                # Append-only ledger: insert each audit entry at its list index;
                # rows already present (lower indexes) are skipped by the
                # unique (change_id, audit_index) constraint.
                for idx, entry in enumerate(change.audit):
                    cur.execute(
                        """
                        INSERT INTO change_audit
                            (change_id, audit_index, ts, actor, action, detail)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        ON CONFLICT (change_id, audit_index) DO NOTHING
                        """,
                        (change.id, idx, entry.ts, entry.actor, entry.action, entry.detail),
                    )
        except Exception as exc:  # pragma: no cover - needs a live DB
            log.error("change.store.postgres.put_failed", id=change.id, error=str(exc))
            raise RuntimeError(f"failed to persist change {change.id}: {exc}") from exc
        return change

    def get(self, change_id: str) -> ChangeRequest | None:
        try:
            with self._cursor() as cur:
                cur.execute("SELECT doc FROM changes WHERE id = %s", (change_id,))
                row = cur.fetchone()
        except Exception as exc:  # pragma: no cover - needs a live DB
            log.error("change.store.postgres.get_failed", id=change_id, error=str(exc))
            raise RuntimeError(f"failed to read change {change_id}: {exc}") from exc
        if row is None:
            return None
        return ChangeRequest.model_validate(self._as_doc(row[0]))

    def list(self) -> list[ChangeRequest]:
        try:
            with self._cursor() as cur:
                cur.execute("SELECT doc FROM changes ORDER BY created_at")
                rows = cur.fetchall()
        except Exception as exc:  # pragma: no cover - needs a live DB
            log.error("change.store.postgres.list_failed", error=str(exc))
            raise RuntimeError(f"failed to list changes: {exc}") from exc
        return [ChangeRequest.model_validate(self._as_doc(r[0])) for r in rows]

    @staticmethod
    def _as_doc(value):
        """psycopg2 returns jsonb as a dict already, but tolerate raw text."""
        if isinstance(value, str):
            return json.loads(value)
        return value
