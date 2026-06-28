"""Runtime configuration, sourced from environment / .env."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    # Job bus
    nats_url: str = "nats://bus:4222"
    job_subject: str = "aiops.jobs"          # workers listen on "<subject>.<op>"
    queue_group: str = "workers"             # NATS queue group → load-balanced

    # Secret provider: "cyberark" (Conjur) or "env" (local first-run testing)
    secret_provider: str = "env"

    # CyberArk Conjur (used when secret_provider == "cyberark")
    conjur_url: str = "http://conjur:80"
    conjur_account: str = "default"
    conjur_login: str = "host/aiops/aiops-worker"
    conjur_api_key: str = ""

    # Env provider creds (used when secret_provider == "env"; lab only)
    device_username: str = ""
    device_password: str = ""
    device_enable: str = ""

    log_level: str = "INFO"


settings = Settings()
