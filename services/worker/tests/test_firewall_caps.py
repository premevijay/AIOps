"""Pure tests for the structured firewall capabilities — no network/git/httpx.

Only the vendor compliance baseline parsers are unit-tested here; everything
that touches a device or disk (save_config, run_firewall_capability) is left out
so this module imports and runs with no third-party deps.
"""

from __future__ import annotations

from aiops_worker.firewall_caps import (
    FIREWALL_CAP_OS,
    checkpoint_violations,
    fortios_violations,
    ftd_violations,
)


def test_cap_os_set():
    assert FIREWALL_CAP_OS == frozenset({"fortios", "checkpoint", "gaia", "ftd"})
    assert "panos" not in FIREWALL_CAP_OS


# -- FortiGate -------------------------------------------------------------

def _forti_policy(src, dst, action, service):
    return {
        "name": "test",
        "srcaddr": [{"name": n} for n in src],
        "dstaddr": [{"name": n} for n in dst],
        "action": action,
        "service": [{"name": s} for s in service],
    }


def test_fortios_any_any_accept_all_flagged():
    pol = _forti_policy(["all"], ["all"], "accept", ["ALL"])
    violations = fortios_violations([pol])
    assert len(violations) == 1
    assert "any source" in violations[0]


def test_fortios_scoped_policy_clean():
    pol = _forti_policy(["LAN"], ["all"], "accept", ["HTTPS"])
    assert fortios_violations([pol]) == []


def test_fortios_any_any_deny_clean():
    # all/all but action deny is not a violation.
    pol = _forti_policy(["all"], ["all"], "deny", ["ALL"])
    assert fortios_violations([pol]) == []


def test_fortios_empty_clean():
    assert fortios_violations([]) == []


# -- Check Point -----------------------------------------------------------

def test_checkpoint_any_any_accept_flagged_string_action():
    rulebase = {"rulebase": [
        {"name": "Cleanup", "source": [{"name": "Any"}],
         "destination": [{"name": "Any"}], "action": "Accept"},
    ]}
    violations = checkpoint_violations(rulebase)
    assert len(violations) == 1
    assert "Any source" in violations[0]


def test_checkpoint_any_any_accept_flagged_object_action():
    rulebase = {"rulebase": [
        {"name": "Cleanup", "source": [{"name": "Any"}],
         "destination": [{"name": "Any"}], "action": {"name": "Accept"}},
    ]}
    assert len(checkpoint_violations(rulebase)) == 1


def test_checkpoint_scoped_rule_clean():
    rulebase = {"rulebase": [
        {"name": "WebDMZ", "source": [{"name": "Internal-Net"}],
         "destination": [{"name": "Any"}], "action": {"name": "Accept"}},
    ]}
    assert checkpoint_violations(rulebase) == []


def test_checkpoint_any_any_drop_clean():
    rulebase = {"rulebase": [
        {"name": "Cleanup", "source": [{"name": "Any"}],
         "destination": [{"name": "Any"}], "action": {"name": "Drop"}},
    ]}
    assert checkpoint_violations(rulebase) == []


def test_checkpoint_missing_rulebase_clean():
    assert checkpoint_violations({}) == []
    assert checkpoint_violations({"rulebase": "not-a-list"}) == []


# -- Cisco FTD -------------------------------------------------------------

def test_ftd_empty_networks_permit_flagged():
    rules = [{"name": "AllowAny", "sourceNetworks": [],
              "destinationNetworks": [], "ruleAction": "PERMIT"}]
    violations = ftd_violations(rules)
    assert len(violations) == 1
    assert "any source" in violations[0]


def test_ftd_missing_networks_permit_flagged():
    # Absent selectors also count as "any".
    rules = [{"name": "AllowAny", "ruleAction": "PERMIT"}]
    assert len(ftd_violations(rules)) == 1


def test_ftd_scoped_rule_clean():
    rules = [{"name": "WebTier",
              "sourceNetworks": {"objects": [{"name": "Inside"}]},
              "destinationNetworks": [], "ruleAction": "PERMIT"}]
    assert ftd_violations(rules) == []


def test_ftd_any_any_block_clean():
    rules = [{"name": "DenyAll", "sourceNetworks": [],
              "destinationNetworks": [], "ruleAction": "BLOCK"}]
    assert ftd_violations(rules) == []


def test_ftd_empty_clean():
    assert ftd_violations([]) == []
