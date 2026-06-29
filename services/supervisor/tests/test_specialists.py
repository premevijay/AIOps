"""Pure tests for the domain specialist registry — no LLM/NATS needed."""

from __future__ import annotations

from aiops_supervisor.specialists import (
    devices_for,
    get_specialist,
    list_specialists,
)

DEVICES = [
    {"name": "cat9k-lab-01", "vendor": "Cisco Catalyst", "os": "ios", "type": "switch"},
    {"name": "nexus-dc-01", "vendor": "Cisco Nexus", "os": "nxos", "type": "switch"},
    {"name": "pa-fw-lab-01", "vendor": "Palo Alto", "os": "panos", "type": "firewall"},
    {"name": "fgt-edge-09", "vendor": "FortiGate", "os": "fortios", "type": "firewall"},
    {"name": "ftd-dc-02", "vendor": "Cisco FTD", "os": "ftd", "type": "firewall"},
    {"name": "f5-vip-01", "vendor": "F5 BIG-IP", "os": "tmos", "type": "load_balancer"},
]


def test_firewall_specialist_registered():
    names = [s.name for s in list_specialists()]
    assert "firewall" in names
    fw = get_specialist("firewall")
    assert fw is not None
    # persona + shared rules both present in the prompt
    assert "Firewall Engineer" in fw.system_prompt
    assert "NEVER apply changes" in fw.system_prompt


def test_unknown_specialist_is_none():
    assert get_specialist("nope") is None


def test_firewall_owns_only_firewalls():
    fw = get_specialist("firewall")
    owned = {d["name"] for d in devices_for(fw, DEVICES)}
    assert owned == {"pa-fw-lab-01", "fgt-edge-09", "ftd-dc-02"}


def test_firewall_match_by_vendor_when_type_missing():
    fw = get_specialist("firewall")
    # No explicit type, but a firewall vendor/os should still match.
    palo = [{"name": "pa-2", "vendor": "Palo Alto Networks", "os": "panos"}]
    assert len(devices_for(fw, palo)) == 1
    # A switch must not match.
    sw = [{"name": "sw-1", "vendor": "Cisco Catalyst", "os": "ios"}]
    assert devices_for(fw, sw) == []
