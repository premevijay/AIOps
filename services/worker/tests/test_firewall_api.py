"""Pure tests for the direct firewall query path — no network needed.

The read-only enforcement is a safety boundary, so it is tested explicitly.
"""

from __future__ import annotations

import pytest

from aiops_worker.firewall_api import (
    SAFE_VERBS,
    cli_to_xml,
    first_verb,
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
