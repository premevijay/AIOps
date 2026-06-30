"""Pure tests for the direct firewall query path — no network needed.

The read-only enforcement is a safety boundary, so it is tested explicitly.
"""

from __future__ import annotations

import pytest

from aiops_worker.firewall_api import (
    SAFE_VERBS,
    checkpoint_read_only,
    cli_to_xml,
    first_verb,
    fortios_path,
    fortios_path_ok,
    is_read_only,
    _parse_op_result,
)


@pytest.mark.parametrize("cmd", ["show system info", "  SHOW high-availability state",
                                  "test security-policy-match from trust to untrust",
                                  "<show><system><info></info></system></show>"])
def test_read_only_commands_allowed(cmd):
    assert is_read_only(cmd)


@pytest.mark.parametrize("cmd", ["set deviceconfig system hostname x", "delete rulebase security rules r1",
                                  "commit", "request restart system", "clear session all",
                                  "<set><deviceconfig></deviceconfig></set>", ""])
def test_mutating_commands_refused(cmd):
    assert not is_read_only(cmd)


def test_first_verb():
    assert first_verb("show system info") == "show"
    assert first_verb("<show><system/></show>") == "show"
    assert first_verb("") == ""
    # every safe verb classifies as read-only
    for v in SAFE_VERBS:
        assert is_read_only(f"{v} something")


def test_cli_to_xml_nests_tokens():
    assert cli_to_xml("show system info") == "<show><system><info></info></system></show>"


def test_cli_to_xml_passes_through_xml():
    xml = "<show><counter><interface>all</interface></counter></show>"
    assert cli_to_xml(xml) == xml


def test_parse_op_result_success():
    body = '<response status="success"><result><uptime>10 days</uptime></result></response>'
    ok, text = _parse_op_result(body)
    assert ok is True
    assert "uptime" in text


def test_parse_op_result_error():
    body = '<response status="error"><msg>Invalid credentials</msg></response>'
    ok, text = _parse_op_result(body)
    assert ok is False
    assert "Invalid credentials" in text


def test_parse_op_result_bad_xml():
    ok, text = _parse_op_result("not xml at all")
    assert ok is False
    assert text == "not xml at all"


# -- FortiGate -------------------------------------------------------------

def test_fortios_path_normalizes():
    assert fortios_path("/api/v2/monitor/system/status") == "monitor/system/status"
    assert fortios_path("monitor/system/status") == "monitor/system/status"
    assert fortios_path("cmdb/firewall/policy") == "cmdb/firewall/policy"


@pytest.mark.parametrize("cmd", ["monitor/system/status", "/api/v2/cmdb/firewall/policy",
                                  "cmdb/firewall/address"])
def test_fortios_read_paths_allowed(cmd):
    assert fortios_path_ok(cmd)


@pytest.mark.parametrize("cmd", ["log/disk/raw", "system/admin", "exec/reboot"])
def test_fortios_non_read_paths_refused(cmd):
    assert not fortios_path_ok(cmd)


# -- Check Point -----------------------------------------------------------

@pytest.mark.parametrize("cmd", ["show-gateways-and-servers", "show-access-rulebase",
                                  "show-hosts", "SHOW-task"])
def test_checkpoint_show_allowed(cmd):
    assert checkpoint_read_only(cmd)


@pytest.mark.parametrize("cmd", ["add-host", "set-access-rule", "delete-network",
                                  "install-policy", "logout"])
def test_checkpoint_mutating_refused(cmd):
    assert not checkpoint_read_only(cmd)
