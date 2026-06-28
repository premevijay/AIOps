"""Policy-as-code engine — pure, no IO.

This is an *illustrative* in-code rule set so the flow is self-contained and
unit-testable. A production deployment should externalize policy to a real
policy engine (OPA/Rego, or a CMDB-aware guardrail service) and evaluate the
proposed config there; `evaluate()` would then become a thin client. The rules
below are deliberately small, heuristic, and easy to read.
"""

from __future__ import annotations

from .models import Device, PolicyResult


def evaluate(device: Device, config_lines: list[str]) -> PolicyResult:
    """Check a proposed change against the policy rules.

    Returns a PolicyResult with allow=False and human-readable violations if any
    rule trips, otherwise allow=True with no violations.
    """
    violations: list[str] = []
    name = device.name.lower()

    for raw in config_lines:
        line = raw.strip()
        low = line.lower()

        # Rule 1: never remove AAA / authentication.
        if low.startswith("no aaa") or "no authentication" in low:
            violations.append(
                f"Removing AAA/authentication is denied: {line!r}"
            )

        # Rule 2: don't shut down an interface on a core/critical device.
        if "shutdown" in low.split() and "core" in name:
            violations.append(
                f"Disabling an interface on core device {device.name!r} is denied: {line!r}"
            )

        # Rule 3: don't touch a management-plane ACL without an explicit allow.
        if "access-list" in low and ("vty" in low or "mgmt" in low):
            violations.append(
                f"Management-plane ACL change requires explicit approval: {line!r}"
            )

    return PolicyResult(allow=not violations, violations=violations)
