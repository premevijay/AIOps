"""Unit tests that need no NATS/uvicorn/DB — the pure extract + in-memory store.

We never import results_service.app or results_service.subscriber here, and we
never call datetime.now: every timestamp is an explicit, increasing ISO string
so the pure logic stays deterministic.
"""

from results_service.extract import to_record
from results_service.models import ResultRecord
from results_service.store import InMemoryResultStore, build_store


TS1 = "2026-06-28T00:00:01Z"
TS2 = "2026-06-28T00:00:02Z"
TS3 = "2026-06-28T00:00:03Z"
TS4 = "2026-06-28T00:00:04Z"


# --- extract.to_record per op ---------------------------------------------

def test_failed_job_is_failed_with_error_summary():
    jr = {"op": "health", "device_name": "sw-a", "ok": False, "data": None, "error": "timeout"}
    rec = to_record(jr, TS1)
    assert rec.status == "failed"
    assert rec.summary == "timeout"
    assert rec.detail == {}
    assert rec.ok is False


def test_failed_job_without_error_has_default_summary():
    jr = {"op": "apply", "device_name": "sw-a", "ok": False}
    rec = to_record(jr, TS1)
    assert rec.status == "failed"
    assert rec.summary == "job failed"


def test_backup_ok_captures_config():
    jr = {"op": "backup", "device_name": "sw-a", "ok": True, "data": {}}
    rec = to_record(jr, TS1)
    assert rec.status == "ok"
    assert rec.summary == "config captured"


def test_backup_changed_is_changed():
    jr = {"op": "backup", "device_name": "sw-a", "ok": True, "data": {"changed": True}}
    rec = to_record(jr, TS1)
    assert rec.status == "changed"
    assert rec.summary == "config drift detected"


def test_get_config_drift_is_changed():
    jr = {"op": "get_config", "device_name": "sw-a", "ok": True, "data": {"drift": True}}
    rec = to_record(jr, TS1)
    assert rec.status == "changed"


def test_health_ok_uses_summary_when_present():
    jr = {"op": "health", "device_name": "sw-a", "ok": True, "data": {"summary": "cpu 12%"}}
    rec = to_record(jr, TS1)
    assert rec.status == "ok"
    assert rec.summary == "cpu 12%"


def test_health_ok_default_summary():
    jr = {"op": "health", "device_name": "sw-a", "ok": True, "data": {}}
    rec = to_record(jr, TS1)
    assert rec.status == "ok"
    assert rec.summary == "health collected"


def test_compliance_compliant_bool_true():
    jr = {"op": "compliance", "device_name": "sw-a", "ok": True, "data": {"compliant": True}}
    rec = to_record(jr, TS1)
    assert rec.status == "compliant"


def test_compliance_compliant_bool_false():
    jr = {"op": "compliance", "device_name": "sw-a", "ok": True, "data": {"compliant": False}}
    rec = to_record(jr, TS1)
    assert rec.status == "non-compliant"


def test_compliance_violations_make_noncompliant_with_count():
    jr = {
        "op": "compliance",
        "device_name": "sw-a",
        "ok": True,
        "data": {"violations": ["a", "b", "c"]},
    }
    rec = to_record(jr, TS1)
    assert rec.status == "non-compliant"
    assert "3" in rec.summary


def test_compliance_no_violations_is_compliant():
    jr = {"op": "compliance", "device_name": "sw-a", "ok": True, "data": {"violations": []}}
    rec = to_record(jr, TS1)
    assert rec.status == "compliant"


def test_apply_changed_and_ok():
    changed = to_record(
        {"op": "apply", "device_name": "sw-a", "ok": True, "data": {"changed": True}}, TS1
    )
    assert changed.status == "changed"
    assert changed.summary == "config applied"
    unchanged = to_record(
        {"op": "apply", "device_name": "sw-a", "ok": True, "data": {"changed": False}}, TS1
    )
    assert unchanged.status == "ok"


def test_unknown_op_completes():
    rec = to_record({"op": "mystery", "device_name": "sw-a", "ok": True, "data": {}}, TS1)
    assert rec.status == "ok"
    assert rec.summary == "completed"


def test_null_data_is_tolerated():
    rec = to_record({"op": "backup", "device_name": "sw-a", "ok": True, "data": None}, TS1)
    assert rec.detail == {}
    assert rec.status == "ok"


def test_missing_keys_are_tolerated():
    rec = to_record({}, TS1)
    assert rec.device == ""
    assert rec.op == ""
    assert rec.status == "failed"  # ok defaults falsey


# --- id determinism -------------------------------------------------------

def test_id_is_deterministic_for_same_device_op_ts():
    a = to_record({"op": "health", "device_name": "sw-a", "ok": True, "data": {}}, TS1)
    b = to_record({"op": "health", "device_name": "sw-a", "ok": True, "data": {}}, TS1)
    assert a.id == b.id


def test_id_differs_when_ts_differs():
    a = to_record({"op": "health", "device_name": "sw-a", "ok": True, "data": {}}, TS1)
    b = to_record({"op": "health", "device_name": "sw-a", "ok": True, "data": {}}, TS2)
    assert a.id != b.id


def test_id_differs_when_device_or_op_differs():
    base = to_record({"op": "health", "device_name": "sw-a", "ok": True, "data": {}}, TS1)
    other_dev = to_record({"op": "health", "device_name": "sw-b", "ok": True, "data": {}}, TS1)
    other_op = to_record({"op": "backup", "device_name": "sw-a", "ok": True, "data": {}}, TS1)
    assert base.id != other_dev.id
    assert base.id != other_op.id


# --- InMemoryResultStore --------------------------------------------------

def _rec(device, op, ts, status="ok"):
    return ResultRecord(
        id=f"{device}|{op}|{ts}",
        device=device,
        op=op,
        ok=True,
        status=status,
        summary="x",
        detail={},
        ts=ts,
    )


def test_recent_is_newest_first():
    store = InMemoryResultStore()
    store.add(_rec("sw-a", "health", TS1))
    store.add(_rec("sw-a", "health", TS3))
    store.add(_rec("sw-a", "health", TS2))
    rows = store.recent(None, None, 100)
    assert [r.ts for r in rows] == [TS3, TS2, TS1]


def test_recent_filters_by_device_and_op():
    store = InMemoryResultStore()
    store.add(_rec("sw-a", "health", TS1))
    store.add(_rec("sw-b", "health", TS2))
    store.add(_rec("sw-a", "backup", TS3))
    assert {r.device for r in store.recent("sw-a", None, 100)} == {"sw-a"}
    by_op = store.recent(None, "health", 100)
    assert {r.op for r in by_op} == {"health"}
    both = store.recent("sw-a", "backup", 100)
    assert len(both) == 1 and both[0].device == "sw-a" and both[0].op == "backup"


def test_recent_respects_limit():
    store = InMemoryResultStore()
    store.add(_rec("sw-a", "health", TS1))
    store.add(_rec("sw-a", "health", TS2))
    store.add(_rec("sw-a", "health", TS3))
    rows = store.recent(None, None, 2)
    assert len(rows) == 2
    assert [r.ts for r in rows] == [TS3, TS2]  # newest survive the cap


def test_latest_one_per_device_op_newest():
    store = InMemoryResultStore()
    store.add(_rec("sw-a", "health", TS1, status="ok"))
    store.add(_rec("sw-a", "health", TS3, status="failed"))   # newest for (sw-a, health)
    store.add(_rec("sw-a", "backup", TS2))
    store.add(_rec("sw-b", "health", TS4))                    # newest overall
    latest = store.latest()
    # one record per (device, op)
    keys = {(r.device, r.op) for r in latest}
    assert keys == {("sw-a", "health"), ("sw-a", "backup"), ("sw-b", "health")}
    # the (sw-a, health) entry is the TS3 one
    sw_a_health = next(r for r in latest if r.device == "sw-a" and r.op == "health")
    assert sw_a_health.ts == TS3 and sw_a_health.status == "failed"
    # newest-first overall
    assert [r.ts for r in latest] == sorted([r.ts for r in latest], reverse=True)
    assert latest[0].ts == TS4


def test_add_returns_the_record():
    store = InMemoryResultStore()
    rec = _rec("sw-a", "health", TS1)
    assert store.add(rec) is rec


# --- store factory --------------------------------------------------------

def test_build_store_defaults_to_memory(monkeypatch):
    from results_service import store as store_mod

    monkeypatch.setattr(store_mod.settings, "results_store", "memory")
    assert isinstance(build_store(), InMemoryResultStore)


def test_build_store_selects_postgres(monkeypatch):
    # No DB available; just prove the factory routes to PostgresResultStore,
    # whose __init__ then fails fast on the empty URL.
    import pytest

    from results_service import store as store_mod

    monkeypatch.setattr(store_mod.settings, "results_store", "postgres")
    monkeypatch.setattr(store_mod.settings, "results_db_url", "")
    with pytest.raises((ValueError, RuntimeError)):
        build_store()
