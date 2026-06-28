"""HMAC approval tokens — the cryptographic gate on apply.

The worker verifies these tokens with the *identical* construction, so this
contract MUST NOT change without changing the worker in lockstep:

    token = HMAC-SHA256(key, change_id).hexdigest()

Only a change that has been approved (and thus signed) by this service can be
applied: the worker recomputes the token from the shared CHANGE_SIGNING_KEY and
refuses any apply whose token doesn't match.
"""

from __future__ import annotations

import hashlib
import hmac


def sign(change_id: str, key: str) -> str:
    """Produce the approval token for `change_id` under `key`."""
    return hmac.new(key.encode(), change_id.encode(), hashlib.sha256).hexdigest()


def verify(change_id: str, token: str, key: str) -> bool:
    """Constant-time check that `token` is a valid approval for `change_id`."""
    expected = sign(change_id, key)
    return hmac.compare_digest(expected, token)
