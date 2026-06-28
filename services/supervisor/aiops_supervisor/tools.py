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
