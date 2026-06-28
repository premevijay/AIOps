"""Secret provider factory."""

from __future__ import annotations

from ..config import settings
from .base import SecretProvider
from .cyberark import CyberArkConjurProvider
from .env import EnvSecretProvider

__all__ = ["SecretProvider", "CyberArkConjurProvider", "EnvSecretProvider", "build_secret_provider"]


def build_secret_provider() -> SecretProvider:
    """Construct the configured SecretProvider from settings."""
    kind = settings.secret_provider.lower()
    if kind == "cyberark":
        return CyberArkConjurProvider(
            base_url=settings.conjur_url,
            account=settings.conjur_account,
            login=settings.conjur_login,
            api_key=settings.conjur_api_key,
        )
    if kind == "env":
        return EnvSecretProvider(
            username=settings.device_username,
            password=settings.device_password,
            enable=settings.device_enable,
        )
    raise ValueError(f"unknown secret_provider: {settings.secret_provider!r}")
