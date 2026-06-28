"""Unit tests that need no LLM/NATS — capabilities, summarization, inventory."""

from aiops_supervisor.capabilities import CAPABILITIES, summarize_result
from aiops_supervisor.inventory import device_names, get_device


DEVICES = [
    {"name": "cat9k-lab-01", "vendor": "Cisco Catalyst", "os": "ios", "mgmt_host": "10.0.0.10"},
    {"name": "nexus-lab-02", "vendor": "Cisco Nexus", "os": "nxos", "mgmt_host": "10.0.0.11"},
]


def test_capabilities_are_read_only_set():
    assert set(CAPABILITIES) == {"backup", "health", "compliance"}


def test_inventory_resolution():
    assert device_names(DEVICES) == ["cat9k-lab-01", "nexus-lab-02"]
    assert get_device(DEVICES, "nexus-lab-02")["os"] == "nxos"
    assert get_device(DEVICES, "ghost") is None


def test_summarize_success_includes_status_and_tail():
    out = summarize_result(
        "backup", "cat9k-lab-01",
        {"ok": True, "duration_ms": 1200, "data": {"status": "successful", "stdout": "a\nb\nPLAY RECAP"}},
    )
    assert out.startswith("OK: backup on cat9k-lab-01")
    assert "PLAY RECAP" in out


def test_summarize_failure_surfaces_reason():
    out = summarize_result(
        "compliance", "cat9k-lab-01",
        {"ok": False, "error": "playbook status=failed"},
    )
    assert out.startswith("FAILED:")
    assert "failed" in out
