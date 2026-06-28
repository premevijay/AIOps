"""Environment-variable SecretProvider — LAB / first-run only.

Lets you exercise the connectivity spine before CyberArk Conjur is provisioned.
Reads one shared credential set from the environment. Never use in production:
real deployments must use CyberArkConjurProvider so each device gets its own
short-lived secret.
"""

from __future__ import annotations

import structlog

from ..models import Device, DeviceCredentials
from .base import SecretProvider

log = structlog.get_logger(__name__)


class EnvSecretProvider(SecretProvider):
    def __init__(self, username: str, password: str, enable: str | None = None):
        if not username or not password:
            raise ValueError(
                "EnvSecretProvider needs DEVICE_USERNAME and DEVICE_PASSWORD set"
            )
        self._username = username
        self._password = password
        self._enable = enable or None

    async def get_device_credentials(self, device: Device) -> DeviceCredentials:
        log.warning("credentials.env_provider", device=device.name,
                    note="lab-only shared credentials")
        return DeviceCredentials(
            username=self._username, password=self._password, enable=self._enable
        )
