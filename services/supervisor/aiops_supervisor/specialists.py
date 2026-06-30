"""Domain specialist agents — the hybrid team model.

A specialist is NOT a separate execution stack. It is the supervisor's same
gated capability toolbelt, but (a) scoped to the devices it owns and (b) given a
domain persona. This is the "hybrid" org: domain agents (firewall, campus,
datacenter, …) standing on the shared backup/compliance/change/audit engine, so
guardrails, audit attribution, and the approval path are identical for every
agent — only the scope and the system prompt differ.

Everything here is pure (no LLM/NATS): matching a device to a domain and
filtering the inventory are unit-tested without any backend.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

# Shared operating rules every specialist inherits (read freely; never apply;
# propose gated changes; audit/governance are read-only). Kept in sync with the
# supervisor's own rules — a specialist is bound by the exact same guardrails.
_SHARED_RULES = """\
Operating rules (shared across the whole team, non-negotiable):
- Read freely. Backup, health, and compliance are read-only and safe to run.
- You NEVER apply changes. If a fix is needed, use `propose_change` to create a
  gated change request (policy + risk are scored, a change id returned) and
  report that it awaits human approval. You cannot approve or apply.
- Use `query_audit` and `risk_posture` for read-only audit/governance questions.
- Act only on devices in YOUR scope; if unsure, call list_devices first.
- Lead with the answer, then the supporting detail."""


@dataclass(frozen=True)
class Specialist:
    """A domain agent definition."""

    name: str                       # url-safe id, e.g. "firewall"
    title: str                      # human label, e.g. "Firewall Engineer"
    summary: str                    # one line: what this agent owns
    #: Predicate selecting the devices this agent owns from the inventory.
    match: Callable[[dict], bool]
    #: The agent's persona (prepended to the shared rules).
    persona: str

    @property
    def system_prompt(self) -> str:
        return f"{self.persona}\n\n{_SHARED_RULES}"


def _is_firewall(d: dict) -> bool:
    """Firewalls by device type, or by a known firewall network OS / vendor."""
    t = str(d.get("type", "")).lower()
    if t == "firewall":
        return True
    os_ = str(d.get("os", "")).lower()
    vendor = str(d.get("vendor", "")).lower()
    fw_os = {"panos", "fortios", "ftd", "asa", "gaia", "checkpoint"}
    fw_vendors = ("palo alto", "fortinet", "fortigate", "check point", "checkpoint", "ftd")
    return os_ in fw_os or any(v in vendor for v in fw_vendors)


# The team roster. Firewall is the first real domain specialist; more domains
# (campus, datacenter, ddi/lb) follow the same shape.
SPECIALISTS: list[Specialist] = [
    Specialist(
        name="firewall",
        title="Firewall Engineer",
        summary="Owns the firewall estate — Palo Alto, FortiGate, Check Point, Cisco FTD.",
        match=_is_firewall,
        persona=(
            "You are the Firewall Engineer — the network security specialist for the "
            "platform's firewall estate (Palo Alto PAN-OS, FortiGate, Check Point, "
            "Cisco FTD). You reason about security policy hygiene, rulebase drift, "
            "high-availability state, threat/UTM posture, and management-plane "
            "hardening. You only manage firewalls; defer other gear to the supervisor "
            "or another specialist."
        ),
    ),
]


def list_specialists() -> list[Specialist]:
    return list(SPECIALISTS)


def get_specialist(name: str) -> Specialist | None:
    return next((s for s in SPECIALISTS if s.name == name), None)


def devices_for(spec: Specialist, devices: list[dict]) -> list[dict]:
    """The subset of the inventory this specialist owns."""
    return [d for d in devices if spec.match(d)]
