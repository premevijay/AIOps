"""Results-store configuration, sourced from environment / .env."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    # Results bus (the worker fans out every JobResult here, no reply).
    nats_url: str = "nats://bus:4222"
    results_subject: str = "aiops.results"   # env RESULTS_SUBJECT

    # Storage backend. "memory" (default) is the ephemeral dev store; "postgres"
    # is the durable path (needs a libpq RESULTS_DB_URL and psycopg2-binary
    # installed).
    results_store: str = "memory"           # env RESULTS_STORE: memory | postgres
    results_db_url: str = ""                 # env RESULTS_DB_URL (libpq URL)

    # API
    host: str = "0.0.0.0"
    port: int = 8090
    log_level: str = "INFO"


settings = Settings()
