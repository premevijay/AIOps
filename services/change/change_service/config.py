"""Change-management configuration, sourced from environment / .env."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    # Job bus (to the execution worker)
    nats_url: str = "nats://bus:4222"
    job_subject: str = "aiops.jobs"          # apply lands on "<subject>.apply"
    request_timeout: float = 600.0

    # HMAC key for approval tokens — shared with the worker (CHANGE_SIGNING_KEY).
    # The worker verifies sign(change_id, key) and refuses apply without a match.
    change_signing_key: str = ""

    # Whether a change window is required to apply (when False, a window is only
    # enforced if one is attached to the change).
    require_change_window: bool = False

    # Storage backend. "memory" (default) is the ephemeral dev store; "postgres"
    # is the durable path with an append-only change_audit ledger (needs a libpq
    # CHANGE_DB_URL and psycopg2-binary installed).
    change_store: str = "memory"           # env CHANGE_STORE: memory | postgres
    change_db_url: str = ""                 # env CHANGE_DB_URL (libpq URL)

    # API
    host: str = "0.0.0.0"
    port: int = 8089
    log_level: str = "INFO"


settings = Settings()
