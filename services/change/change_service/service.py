"""Change orchestration — the propose -> approve -> apply state machine.

create/approve/reject are pure (no awaits): they compute risk + policy, drive the
status transitions, and write the audit trail through the store, so they're
trivially unit-testable with the in-memory store and a fake bus. Only apply()
talks to the bus: it enforces the change window, signs the HMAC approval token,
and dispatches the worker apply job.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import structlog

from . import policy, risk, signing, window
from .models import AuditEntry, ChangeRequest, ChangeStatus, Device

log = structlog.get_logger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Service:
    def __init__(self, store, bus, signing_key: str, require_window: bool = False):
        self._store = store
        self._bus = bus
        self._key = signing_key
        self._require_window = require_window

    def _audit(self, change: ChangeRequest, actor: str, action: str, detail: str = "") -> None:
        """Append an audit line and persist the whole change in one write.

        Every transition mutates `change` (status, result, ...) and then calls
        this; appending here and re-`put`-ting makes it the single persistence
        point, so a DB store sees status + audit together on every step.
        """
        change.audit.append(
            AuditEntry(ts=_now_iso(), actor=actor, action=action, detail=detail)
        )
        self._store.put(change)

    def create(
        self,
        device: Device,
        intent: str,
        config: list[str],
        requested_by: str,
        window: dict | None = None,
    ) -> ChangeRequest:
        """Propose a change: score risk, run policy, persist, and audit.

        A change that fails policy is created already-rejected (it can never be
        approved); otherwise it lands `proposed` awaiting a human decision.
        """
        risk_result = risk.score(device, config)
        policy_result = policy.evaluate(device, config)
        denied = not policy_result.allow
        status = ChangeStatus.rejected if denied else ChangeStatus.proposed

        change = ChangeRequest(
            id=uuid.uuid4().hex,
            device=device,
            intent=intent,
            config=config,
            requested_by=requested_by,
            status=status,
            risk=risk_result,
            policy=policy_result,
            window=window,
            created_at=_now_iso(),
            audit=[],
            result=None,
        )
        self._store.put(change)
        self._audit(
            change, requested_by, "created",
            f"risk={risk_result.score}/{risk_result.level} status={status.value}",
        )
        if denied:
            self._audit(
                change, "policy", "policy_denied", "; ".join(policy_result.violations)
            )
        log.info("change.created", id=change.id, status=status.value, risk=risk_result.score)
        return change

    def approve(self, change_id: str, approver: str) -> ChangeRequest:
        """Human approval. Only a proposed, policy-passing change can be approved."""
        change = self._require(change_id)
        if change.status != ChangeStatus.proposed:
            raise ValueError(f"cannot approve change in status {change.status.value}")
        if not change.policy.allow:
            raise ValueError("cannot approve a policy-denied change")
        change.status = ChangeStatus.approved
        self._audit(change, approver, "approved")
        log.info("change.approved", id=change.id, approver=approver)
        return change

    def reject(self, change_id: str, approver: str, reason: str) -> ChangeRequest:
        """Human rejection of a proposed change."""
        change = self._require(change_id)
        if change.status != ChangeStatus.proposed:
            raise ValueError(f"cannot reject change in status {change.status.value}")
        change.status = ChangeStatus.rejected
        self._audit(change, approver, "rejected", reason)
        log.info("change.rejected", id=change.id, approver=approver)
        return change

    async def apply(self, change_id: str, now: datetime) -> ChangeRequest:
        """Apply an approved change via the worker, gated on window + HMAC token."""
        change = self._require(change_id)
        if change.status != ChangeStatus.approved:
            raise ValueError(f"cannot apply change in status {change.status.value}")

        # Enforce the window only if required, or if one is attached to the change.
        if self._require_window or change.window is not None:
            ok, reason = window.in_window(change.window, now)
            if not ok:
                self._audit(change, "system", "window_blocked", reason)
                raise ValueError(f"change window not satisfied: {reason}")

        token = signing.sign(change.id, self._key)
        params = {
            "change_id": change.id,
            "approval_token": token,
            "config": change.config,
        }
        self._audit(change, "system", "apply_dispatched", "approval token signed")
        result = await self._bus.request_apply(change.device.model_dump(), params)
        change.result = result

        if result.get("ok"):
            change.status = ChangeStatus.applied
            self._audit(change, "worker", "applied", "")
            log.info("change.applied", id=change.id)
        else:
            change.status = ChangeStatus.failed
            self._audit(change, "worker", "failed", str(result.get("error", "")))
            log.warning("change.failed", id=change.id, error=result.get("error"))
        return change

    def _require(self, change_id: str) -> ChangeRequest:
        change = self._store.get(change_id)
        if change is None:
            raise KeyError(change_id)
        return change
