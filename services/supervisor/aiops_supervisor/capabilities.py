"""Capability metadata + result summarization. Pure; no LLM/NATS deps.

The supervisor exposes one tool per read-only capability. Device-mutating
operations are deliberately NOT here — writes are gated behind the
change-management approval path (Phase 4), so the agent can propose but never
execute them.
"""

from __future__ import annotations

# Read-only capabilities the agent may invoke autonomously. Each maps to a
# worker op (and thus an Ansible playbook / AWX job template).
CAPABILITIES: dict[str, str] = {
    "backup": "Pull and version the device's running configuration; report drift vs golden.",
    "health": "Gather device facts and report a health snapshot.",
    "compliance": "Run the hardening/compliance baseline and report pass or fail.",
}


def summarize_result(op: str, device_name: str, result: dict) -> str:
    """Turn a worker JobResult dict into a short line the agent can reason over."""
    if not result.get("ok"):
        data = result.get("data") or {}
        reason = result.get("error") or f"status={data.get('status')}"
        return f"FAILED: {op} on {device_name} did not succeed ({reason})."

    data = result.get("data") or {}
    status = data.get("status", "successful")
    tail = (data.get("stdout") or "").strip().splitlines()[-3:]
    tail_str = (" | last: " + " / ".join(tail)) if tail else ""
    ms = result.get("duration_ms")
    dur = f" in {ms} ms" if ms is not None else ""
    return f"OK: {op} on {device_name} completed (status={status}){dur}.{tail_str}"
