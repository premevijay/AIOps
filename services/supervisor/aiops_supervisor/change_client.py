"""HTTP client for the change-management service.

The agent PROPOSES changes and CHECKS status through this client. It has no
approve/apply methods on purpose — those are human actions, not the agent's.
"""

from __future__ import annotations

import httpx


class ChangeClient:
    def __init__(self, base_url: str, timeout: float = 30.0):
        self._base = base_url.rstrip("/")
        self._timeout = timeout

    async def propose(self, change: dict) -> dict:
        async with httpx.AsyncClient(timeout=self._timeout) as c:
            r = await c.post(f"{self._base}/changes", json=change)
            r.raise_for_status()
            return r.json()

    async def get(self, change_id: str) -> dict:
        async with httpx.AsyncClient(timeout=self._timeout) as c:
            r = await c.get(f"{self._base}/changes/{change_id}")
            r.raise_for_status()
            return r.json()

    async def audit(self, params: dict | None = None) -> list[dict]:
        """The platform's change/approval audit ledger (who did what, when)."""
        async with httpx.AsyncClient(timeout=self._timeout) as c:
            r = await c.get(f"{self._base}/audit", params=params or {})
            r.raise_for_status()
            return r.json()

    async def posture(self) -> dict:
        """Risk/governance posture aggregated across change requests."""
        async with httpx.AsyncClient(timeout=self._timeout) as c:
            r = await c.get(f"{self._base}/risk/posture")
            r.raise_for_status()
            return r.json()
