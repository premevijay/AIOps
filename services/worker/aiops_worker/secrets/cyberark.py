"""CyberArk Conjur SecretProvider.

Implements the Conjur OSS REST flow:
  1. Authenticate (login + API key) -> short-lived access token.
  2. Base64 the token into the `Authorization: Token token="..."` header.
  3. Retrieve the device's variables; never persist the token or secrets.

Credentials for a device live under its `vault_path`, with three variables:
    <vault_path>/username
    <vault_path>/password
    <vault_path>/enable      (optional)

The token is held only for the lifetime of one credential fetch.
"""

from __future__ import annotations

import base64
from urllib.parse import quote

import httpx
import structlog

from ..models import Device, DeviceCredentials
from .base import SecretProvider

log = structlog.get_logger(__name__)


class CyberArkConjurProvider(SecretProvider):
    def __init__(self, base_url: str, account: str, login: str, api_key: str):
        self._base_url = base_url.rstrip("/")
        self._account = account
        self._login = login
        self._api_key = api_key

    async def _authenticate(self, client: httpx.AsyncClient) -> str:
        """Return the `Authorization` header value for a fresh access token."""
        login = quote(self._login, safe="")
        resp = await client.post(
            f"{self._base_url}/authn/{self._account}/{login}/authenticate",
            content=self._api_key,
            headers={"Content-Type": "text/plain", "Accept-Encoding": "base64"},
        )
        resp.raise_for_status()
        # With Accept-Encoding: base64 Conjur returns the token already base64'd.
        token_b64 = resp.text.strip()
        # Be tolerant of servers that return the raw JSON token instead.
        if token_b64.startswith("{"):
            token_b64 = base64.b64encode(resp.content).decode()
        return f'Token token="{token_b64}"'

    async def _read_variable(self, client: httpx.AsyncClient, auth: str, var_id: str) -> str:
        path = quote(f"{self._account}/variable/{var_id}", safe="")
        resp = await client.get(
            f"{self._base_url}/secrets/{path}",
            headers={"Authorization": auth},
        )
        resp.raise_for_status()
        return resp.text

    async def get_device_credentials(self, device: Device) -> DeviceCredentials:
        if not device.vault_path:
            raise ValueError(f"device {device.name!r} has no vault_path")

        base = device.vault_path.strip("/")
        async with httpx.AsyncClient(timeout=10.0) as client:
            auth = await self._authenticate(client)
            username = await self._read_variable(client, auth, f"{base}/username")
            password = await self._read_variable(client, auth, f"{base}/password")
            enable: str | None = None
            try:
                enable = await self._read_variable(client, auth, f"{base}/enable")
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code != 404:
                    raise  # 404 just means no enable secret for this device

        log.info("credentials.fetched", device=device.name, vault_path=device.vault_path)
        return DeviceCredentials(username=username, password=password, enable=enable)
