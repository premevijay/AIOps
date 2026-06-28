"""AIOps Change Management service — the human-approval authority.

Phase 4 of the platform: the only path by which a device-mutating change reaches
the execution worker. A change is proposed, checked against policy-as-code,
risk-scored, gated on a human approval, checked against a change window, and only
then applied — with an HMAC approval token the worker independently verifies.

Nothing here mutates a device directly; it authorizes the worker to.
"""

__version__ = "0.1.0"
