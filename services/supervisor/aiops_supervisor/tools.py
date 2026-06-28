"""LangChain tools the supervisor agent can call.

Each tool wraps a read-only capability: resolve the device from inventory, run
the op on the worker, summarize the result. Tools are built as closures over the
bus client and inventory so the agent stays stateless.
"""

from __future__ import annotations

from langchain_core.tools import StructuredTool

from .bus_client import BusClient
from .capabilities import CAPABILITIES, summarize_result
from .inventory import device_names, get_device


def build_tools(bus: BusClient, devices: list[dict]) -> list[StructuredTool]:
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

    tools: list[StructuredTool] = [
        StructuredTool.from_function(
            name="list_devices",
            description="List the network devices the platform manages.",
            func=_list_devices,
        )
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
