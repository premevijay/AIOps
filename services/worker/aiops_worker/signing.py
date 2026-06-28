"""HMAC approval tokens for gated writes.

The change-management service signs a change id; the worker verifies the token
before running an `apply`. Both sides MUST use this exact construction
(HMAC-SHA256 hex over the change id, keyed by CHANGE_SIGNING_KEY).
"""

from __future__ import annotations

import hashlib
import hmac


def sign(change_id: str, key: str) -> str:
    return hmac.new(key.encode(), change_id.encode(), hashlib.sha256).hexdigest()


def verify(change_id: str, token: str, key: str) -> bool:
    if not key or not token:
        return False
    return hmac.compare_digest(sign(change_id, key), token)
