"""LangChain tools the supervisor agent can call.

Each tool wraps a read-only capability: resolve the device from inventory, run
the op on the worker, summarize the result. Tools are built as closures over the
bus client and inventory so the agent stays stateless.
"""

from __future__ import annotations

from langchain_core.tools import StructuredTool

from .bus_client import BusClient
from .capabilities import CAPABILITIES, summarize_result
from .change_client import ChangeClient
from .inventory import device_names, get_device


def build_tools(bus: BusClient, devices: list[dict], change: ChangeClient) -> list[StructuredTool]:
    async def _run(op: str, device_name: str) -> str:
        dev = get_device(devices, device_name)
        if dev is None:
            return (
                f"Unknown device '{device_name}'. Known devices: "
                f"{', '.join(device_names(devices)) or '(none)'}"
            )
        result = await bus.request_job(op, dev)
        return summarize_result(op, device_name, result)

    def _list_devices() -> str:
        names = device_names(devices)
        return "Managed devices: " + (", ".join(names) if names else "(none)")

    async def _propose_change(device_name: str, intent: str, config_lines: list[str]) -> str:
        """Create a gated change request. Does NOT apply anything — returns the
        change id, computed risk, and policy verdict; approval is a human step."""
        dev = get_device(devices, device_name)
        if dev is None:
            return f"Unknown device '{device_name}'. Known devices: {', '.join(device_names(devices))}"
        ch = await change.propose({
            "device": dev,
            "intent": intent,
            "config": config_lines,
            "requested_by": "supervisor-agent",
        })
        risk = ch.get("risk", {})
        pol = ch.get("policy", {})
        verdict = "policy ALLOWS" if pol.get("allow") else f"policy DENIES ({'; '.join(pol.get('violations', []))})"
        return (
            f"Proposed change {ch.get('id')} on {device_name}: status={ch.get('status')}, "
            f"risk={risk.get('level')} ({risk.get('score')}), {verdict}. "
            f"Awaiting human approval — I cannot approve or apply it."
        )

    async def _change_status(change_id: str) -> str:
        ch = await change.get(change_id)
        return f"Change {change_id}: status={ch.get('status')}, risk={ch.get('risk', {}).get('level')}."

    async def _query_audit(change_id: str = "", actor: str = "", action: str = "") -> str:
        """Audit capability: read the change/approval ledger (who did what, when)."""
        params = {k: v for k, v in {"change_id": change_id, "actor": actor, "action": action}.items() if v}
        params["limit"] = 20
        entries = await change.audit(params)
        if not entries:
            return "No matching audit entries."
        lines = [
            f"- {e.get('ts')} · {e.get('actor')} {e.get('action')} on {e.get('device')} "
            f"(change {str(e.get('change_id'))[:8]}){(' — ' + e['detail']) if e.get('detail') else ''}"
            for e in entries[:20]
        ]
        return "Audit ledger (most recent):\n" + "\n".join(lines)

    async def _risk_posture() -> str:
        """Risk/Governance capability: posture across all change requests."""
        p = await change.posture()
        bl = p.get("by_risk_level", {})
        bs = p.get("by_status", {})
        ohr = p.get("open_high_risk", [])
        rd = p.get("recent_denied", [])
        out = [
            f"Change posture — total {p.get('total', 0)}; "
            f"status {bs}; risk {bl}.",
            f"Open high/critical-risk changes: {len(ohr)}"
            + ("".join(f"\n  - {h.get('id','')[:8]} {h.get('device')} ({h.get('level')} {h.get('score')}): {h.get('intent')}" for h in ohr[:5])),
        ]
        if rd:
            out.append("Recent policy denials: " + ", ".join(f"{d.get('device')} ({'; '.join(d.get('violations', []))})" for d in rd[:5]))
        return "\n".join(out)

    tools: list[StructuredTool] = [
        StructuredTool.from_function(
            name="list_devices",
            description="List the network devices the platform manages.",
            func=_list_devices,
        ),
        StructuredTool.from_function(
            name="propose_change",
            description=(
                "Propose a device configuration change for human approval. Args: "
                "device_name, intent (why), config_lines (list of config lines). "
                "This creates a gated change request and runs policy + risk checks; "
                "it does NOT apply anything. You cannot approve or apply changes."
            ),
            coroutine=_propose_change,
        ),
        StructuredTool.from_function(
            name="change_status",
            description="Check the status of a change request by its id.",
            coroutine=_change_status,
        ),
        StructuredTool.from_function(
            name="query_audit",
            description=(
                "Audit: read the change/approval audit ledger (who proposed, approved, "
                "applied what, and when). Optional filters: change_id, actor, action."
            ),
            coroutine=_query_audit,
        ),
        StructuredTool.from_function(
            name="risk_posture",
            description=(
                "Risk & governance: summarize risk posture across all change requests "
                "— status/risk-level mix, open high-risk changes, recent policy denials."
            ),
            coroutine=_risk_posture,
        ),
    ]
    for op, desc in CAPABILITIES.items():
        async def _op(device_name: str, _op: str = op) -> str:
            return await _run(_op, device_name)

        tools.append(
            StructuredTool.from_function(
                name=op,
                description=f"{desc} Argument: device_name (must be a managed device).",
                coroutine=_op,
            )
        )
    return tools
