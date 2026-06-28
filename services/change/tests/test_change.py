"""Unit tests that need no NATS/uvicorn — pure engines + the service state machine.

The service's apply() is async, but we drive it with asyncio.run against a FAKE
bus, so these tests don't require fastapi, nats, or pytest-asyncio. We never
import change_service.app or change_service.bus_client here.
"""

import asyncio

import pytest

from change_service import policy, risk, signing, window
from change_service.audit import flatten_ledger
from change_service.governance import risk_posture
from change_service.models import (
    AuditEntry,
    ChangeRequest,
    ChangeStatus,
    Device,
    PolicyResult,
    RiskResult,
)
from change_service.service import Service
from change_service.store import InMemoryChangeStore, build_store
from datetime import datetime, timezone


def _switch(name="cat9k-lab-01"):
    return Device(name=name, vendor="Cisco Catalyst", os="ios", mgmt_host="10.0.0.10")


def _firewall(name="fw-edge-01"):
    return Device(name=name, vendor="Palo Alto firewall", os="panos", mgmt_host="10.0.0.20")


class FakeBus:
    """Stub bus: records the apply call and returns a canned JobResult."""

    def __init__(self, ok=True):
        self.ok = ok
        self.calls = []

    async def request_apply(self, device, params):
        self.calls.append((device, params))
        if self.ok:
            return {"op": "apply", "device_name": device["name"], "ok": True, "data": {"status": "successful"}}
        return {"op": "apply", "device_name": device["name"], "ok": False, "error": "boom"}


# --- policy ---------------------------------------------------------------

def test_policy_allows_benign_change():
    res = policy.evaluate(_switch(), ["interface Gi1/0/1", "description uplink"])
    assert res.allow is True
    assert res.violations == []


def test_policy_denies_removing_aaa():
    res = policy.evaluate(_switch(), ["no aaa authentication login default"])
    assert res.allow is False
    assert any("AAA" in v for v in res.violations)


def test_policy_denies_shutdown_on_core_device():
    res = policy.evaluate(_switch("core-spine-01"), ["interface Gi1/0/1", "shutdown"])
    assert res.allow is False
    assert any("core" in v.lower() for v in res.violations)


def test_policy_allows_shutdown_on_noncore_device():
    res = policy.evaluate(_switch("edge-access-09"), ["interface Gi1/0/1", "shutdown"])
    assert res.allow is True


def test_policy_denies_mgmt_plane_acl():
    res = policy.evaluate(_switch(), ["access-list 99 permit any vty"])
    assert res.allow is False
    assert any("ACL" in v for v in res.violations)


# --- risk -----------------------------------------------------------------

def test_risk_low_for_benign_switch_change():
    res = risk.score(_switch("edge-access-09"), ["description uplink"])
    assert res.level == "low"
    assert res.score < 30


def test_risk_rises_with_change_class_keywords():
    res = risk.score(_switch("edge-access-09"), ["no aaa authentication", "access-list 10 permit"])
    assert res.score > 30
    assert res.level in {"medium", "high", "critical"}


def test_risk_critical_for_core_firewall_destructive_change():
    res = risk.score(
        _firewall("core-fw-01"),
        ["shutdown", "no aaa", "access-list 1 deny", "route-map RM permit"],
    )
    assert res.level == "critical"
    assert res.score >= 85


def test_risk_score_is_clamped_0_100():
    res = risk.score(_firewall("core-spine-fw"), ["shutdown", "no aaa", "access-list", "route-map"])
    assert 0 <= res.score <= 100


# --- window ---------------------------------------------------------------

def test_window_none_is_ok():
    ok, reason = window.in_window(None, datetime(2026, 6, 28, tzinfo=timezone.utc))
    assert ok is True
    assert "no window" in reason


def test_window_inside():
    w = {"start": "2026-06-28T00:00:00+00:00", "end": "2026-06-28T04:00:00+00:00"}
    ok, _ = window.in_window(w, datetime(2026, 6, 28, 2, tzinfo=timezone.utc))
    assert ok is True


def test_window_outside():
    w = {"start": "2026-06-28T00:00:00+00:00", "end": "2026-06-28T04:00:00+00:00"}
    ok, reason = window.in_window(w, datetime(2026, 6, 28, 6, tzinfo=timezone.utc))
    assert ok is False
    assert "outside" in reason


# --- signing --------------------------------------------------------------

def test_sign_verify_roundtrip():
    token = signing.sign("abc123", "topsecret")
    assert signing.verify("abc123", token, "topsecret") is True


def test_verify_rejects_tampered_token():
    token = signing.sign("abc123", "topsecret")
    assert signing.verify("abc123", token + "00", "topsecret") is False
    assert signing.verify("abc123", token, "wrongkey") is False
    assert signing.verify("other", token, "topsecret") is False


# --- service transitions --------------------------------------------------

def _service(bus, require_window=False):
    return Service(InMemoryChangeStore(), bus, signing_key="k", require_window=require_window)


def test_create_approve_apply_happy_path():
    bus = FakeBus(ok=True)
    svc = _service(bus)
    change = svc.create(_switch(), "add description", ["description uplink"], "alice")
    assert change.status == ChangeStatus.proposed

    approved = svc.approve(change.id, "bob")
    assert approved.status == ChangeStatus.approved

    applied = asyncio.run(svc.apply(change.id, datetime.now(timezone.utc)))
    assert applied.status == ChangeStatus.applied
    assert applied.result["ok"] is True

    # The signed token reaching the worker must match the verification contract.
    device, params = bus.calls[0]
    assert params["change_id"] == change.id
    assert signing.verify(change.id, params["approval_token"], "k") is True
    assert params["config"] == ["description uplink"]

    actions = [a.action for a in applied.audit]
    assert "created" in actions and "approved" in actions and "applied" in actions


def test_policy_denied_change_is_rejected_and_cannot_be_approved():
    svc = _service(FakeBus())
    change = svc.create(_switch(), "kill aaa", ["no aaa authentication login"], "alice")
    assert change.status == ChangeStatus.rejected
    assert change.policy.allow is False
    with pytest.raises(ValueError):
        svc.approve(change.id, "bob")


def test_cannot_approve_already_approved():
    svc = _service(FakeBus())
    change = svc.create(_switch(), "noop", ["description x"], "alice")
    svc.approve(change.id, "bob")
    with pytest.raises(ValueError):
        svc.approve(change.id, "bob")


def test_apply_blocked_outside_window():
    svc = _service(FakeBus())
    w = {"start": "2026-06-28T00:00:00+00:00", "end": "2026-06-28T04:00:00+00:00"}
    change = svc.create(_switch(), "noop", ["description x"], "alice", window=w)
    svc.approve(change.id, "bob")
    with pytest.raises(ValueError):
        asyncio.run(svc.apply(change.id, datetime(2026, 6, 28, 6, tzinfo=timezone.utc)))
    # still approved (not applied) after the block
    assert svc._store.get(change.id).status == ChangeStatus.approved


def test_apply_failure_marks_failed():
    bus = FakeBus(ok=False)
    svc = _service(bus)
    change = svc.create(_switch(), "noop", ["description x"], "alice")
    svc.approve(change.id, "bob")
    applied = asyncio.run(svc.apply(change.id, datetime.now(timezone.utc)))
    assert applied.status == ChangeStatus.failed
    assert applied.result["ok"] is False


def test_put_based_persistence_records_status_and_audit():
    # After the put-based refactor, the store always reflects the latest status
    # and the full audit trail (the service re-puts on every transition).
    bus = FakeBus(ok=True)
    svc = _service(bus)
    change = svc.create(_switch(), "noop", ["description x"], "alice")
    svc.approve(change.id, "bob")
    stored = svc._store.get(change.id)
    assert stored.status == ChangeStatus.approved
    assert [a.action for a in stored.audit] == ["created", "approved"]


# --- store factory --------------------------------------------------------

def test_build_store_defaults_to_memory(monkeypatch):
    from change_service import store as store_mod

    monkeypatch.setattr(store_mod.settings, "change_store", "memory")
    assert isinstance(build_store(), InMemoryChangeStore)


def test_build_store_selects_postgres(monkeypatch):
    # We don't have a DB; just prove the factory routes to PostgresChangeStore
    # (its __init__ then fails fast on the empty/unreachable URL).
    from change_service import store as store_mod

    monkeypatch.setattr(store_mod.settings, "change_store", "postgres")
    monkeypatch.setattr(store_mod.settings, "change_db_url", "")
    with pytest.raises((ValueError, RuntimeError)):
        build_store()


# --- audit: flatten_ledger ------------------------------------------------

def _make_change(cid, device_name, intent, status, level, score, audit, *,
                 allow=True, violations=None):
    return ChangeRequest(
        id=cid,
        device=_switch(device_name),
        intent=intent,
        config=["description x"],
        requested_by="alice",
        status=status,
        risk=RiskResult(score=score, level=level, factors=[]),
        policy=PolicyResult(allow=allow, violations=violations or []),
        created_at="2026-06-28T00:00:00+00:00",
        audit=[AuditEntry(**a) for a in audit],
    )


def _ledger_fixture():
    c1 = _make_change(
        "c1", "sw-a", "intent-a", ChangeStatus.approved, "low", 10,
        [
            {"ts": "2026-06-28T01:00:00+00:00", "actor": "alice", "action": "created"},
            {"ts": "2026-06-28T03:00:00+00:00", "actor": "bob", "action": "approved"},
        ],
    )
    c2 = _make_change(
        "c2", "sw-b", "intent-b", ChangeStatus.rejected, "high", 70,
        [
            {"ts": "2026-06-28T02:00:00+00:00", "actor": "carol", "action": "created"},
            {"ts": "2026-06-28T04:00:00+00:00", "actor": "carol", "action": "rejected"},
        ],
    )
    return [c1, c2]


def test_flatten_ledger_newest_first_and_shape():
    rows = flatten_ledger(_ledger_fixture())
    ts = [r["ts"] for r in rows]
    assert ts == sorted(ts, reverse=True)
    top = rows[0]
    assert set(top) == {"change_id", "device", "intent", "ts", "actor", "action", "detail"}
    assert top["action"] == "rejected" and top["change_id"] == "c2"


def test_flatten_ledger_filter_by_change_id():
    rows = flatten_ledger(_ledger_fixture(), change_id="c1")
    assert {r["change_id"] for r in rows} == {"c1"}
    assert len(rows) == 2


def test_flatten_ledger_filter_by_actor_and_action():
    rows = flatten_ledger(_ledger_fixture(), actor="bob")
    assert len(rows) == 1 and rows[0]["actor"] == "bob"
    rows = flatten_ledger(_ledger_fixture(), action="created")
    assert {r["action"] for r in rows} == {"created"}
    assert len(rows) == 2


def test_flatten_ledger_limit():
    rows = flatten_ledger(_ledger_fixture(), limit=1)
    assert len(rows) == 1
    assert rows[0]["ts"] == "2026-06-28T04:00:00+00:00"  # newest survives the cap


# --- governance: risk_posture ---------------------------------------------

def _posture_fixture():
    open_high = _make_change(
        "h1", "core-sw", "risky", ChangeStatus.proposed, "high", 70,
        [{"ts": "2026-06-28T01:00:00+00:00", "actor": "alice", "action": "created"}],
    )
    open_crit = _make_change(
        "h2", "core-fw", "very risky", ChangeStatus.approved, "critical", 90,
        [{"ts": "2026-06-28T01:00:00+00:00", "actor": "alice", "action": "created"}],
    )
    applied_high = _make_change(
        "h3", "sw-x", "done", ChangeStatus.applied, "high", 65,
        [{"ts": "2026-06-28T01:00:00+00:00", "actor": "alice", "action": "created"}],
    )
    benign = _make_change(
        "b1", "sw-y", "benign", ChangeStatus.proposed, "low", 10,
        [{"ts": "2026-06-28T01:00:00+00:00", "actor": "alice", "action": "created"}],
    )
    denied_old = _make_change(
        "d1", "sw-z", "kill aaa", ChangeStatus.rejected, "medium", 40,
        [{"ts": "2026-06-28T01:00:00+00:00", "actor": "policy", "action": "policy_denied"}],
        allow=False, violations=["AAA removal denied"],
    )
    denied_old.created_at = "2026-06-27T00:00:00+00:00"
    denied_new = _make_change(
        "d2", "sw-w", "mgmt acl", ChangeStatus.rejected, "medium", 45,
        [{"ts": "2026-06-29T01:00:00+00:00", "actor": "policy", "action": "policy_denied"}],
        allow=False, violations=["mgmt-plane ACL"],
    )
    denied_new.created_at = "2026-06-29T00:00:00+00:00"
    return [open_high, open_crit, applied_high, benign, denied_old, denied_new]


def test_risk_posture_counts():
    p = risk_posture(_posture_fixture())
    assert p["total"] == 6
    assert p["by_status"] == {
        "proposed": 2, "approved": 1, "rejected": 2, "applied": 1, "failed": 0
    }
    assert p["by_risk_level"] == {"low": 1, "medium": 2, "high": 2, "critical": 1}


def test_risk_posture_open_high_risk_selection():
    p = risk_posture(_posture_fixture())
    ids = {item["id"] for item in p["open_high_risk"]}
    # h1 (proposed/high) and h2 (approved/critical) qualify; h3 is applied (closed),
    # b1 is low risk.
    assert ids == {"h1", "h2"}
    for item in p["open_high_risk"]:
        assert set(item) == {"id", "device", "intent", "level", "score"}


def test_risk_posture_recent_denied_newest_first():
    p = risk_posture(_posture_fixture())
    denied_ids = [d["id"] for d in p["recent_denied"]]
    assert denied_ids == ["d2", "d1"]  # newest created_at first
    assert p["recent_denied"][0]["violations"] == ["mgmt-plane ACL"]
    assert set(p["recent_denied"][0]) == {"id", "device", "intent", "violations"}
