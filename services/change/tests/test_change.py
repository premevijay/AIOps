"""Unit tests that need no NATS/uvicorn — pure engines + the service state machine.

The service's apply() is async, but we drive it with asyncio.run against a FAKE
bus, so these tests don't require fastapi, nats, or pytest-asyncio. We never
import change_service.app or change_service.bus_client here.
"""

import asyncio

import pytest

from change_service import policy, risk, signing, window
from change_service.models import ChangeStatus, Device
from change_service.service import Service
from change_service.store import InMemoryChangeStore
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
