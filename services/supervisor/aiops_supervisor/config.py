"""Supervisor configuration, sourced from environment / .env."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    # LLM (hosted, behind the ModelProvider abstraction — decision #1).
    # ANTHROPIC_API_KEY is read by the Anthropic SDK directly.
    # Set ANTHROPIC_MODEL to a current Claude model id (see
    # https://docs.claude.com/en/docs/about-claude/models). A capable Opus-tier
    # model is recommended for the orchestrator.
    anthropic_model: str = ""
    max_tokens: int = 4096

    # Job bus (to the execution worker)
    nats_url: str = "nats://bus:4222"
    job_subject: str = "aiops.jobs"
    request_timeout: float = 600.0

    # Inventory the agent can act on
    inventory_path: str = "/app/inventory.yaml"

    # API
    host: str = "0.0.0.0"
    port: int = 8088
    log_level: str = "INFO"


settings = Settings()
