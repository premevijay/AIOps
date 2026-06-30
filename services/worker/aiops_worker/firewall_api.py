"""Direct firewall management-API client — the non-Ansible read path.

`firewall_query` lets the firewall agent run an arbitrary READ-ONLY operational
command straight against a firewall's management API, so it isn't limited to the
fixed playbook capabilities. It is deliberately reads-only: only `show`/`test`
operational commands are accepted — anything that could mutate the device is
refused here. Device-mutating changes stay on the gated change-management path.

PAN-OS (Palo Alto) is supported first, over its XML API:
  1. GET /api/?type=keygen&user=&password=        -> API key
  2. GET /api/?type=op&cmd=<xml>&key=             -> operational command result

The connection goes directly to the device's management IP (an internal address,
so it bypasses any outbound proxy). TLS verification is on by default; set
FIREWALL_VERIFY_TLS=false for lab firewalls with self-signed certs.
"""

from __future__ import annotations

from xml.etree import ElementTree as ET

import structlog

from .config import settings
from .models import Device, DeviceCredentials

log = structlog.get_logger(__name__)

# Ops served directly (not via Ansible). Kept here so the bus subscribes to them
# and the handler routes them to this client.
FIREWALL_OPS = frozenset({"firewall_query"})

# Read-only operational verbs. A command must start with one of these; anything
# else (set/commit/delete/request/clear/restart/...) is refused.
SAFE_VERBS = ("show", "test")

_MAX_RESULT = 20000


class FirewallQueryError(Exception):
    """A firewall_query that could not run (bad command, unsupported os, etc.)."""


def first_verb(cmd: str) -> str:
    """The leading verb of a CLI or XML command, lowercased."""
    s = cmd.strip().lstrip("<")
    if not s:
        return ""
    return s.split()[0].split(">")[0].strip().lower()


def is_read_only(cmd: str) -> bool:
    return first_verb(cmd) in SAFE_VERBS


def cli_to_xml(cmd: str) -> str:
    """Convert a CLI-style operational command to PAN-OS XML.

    "show system info" -> "<show><system><info></info></system></show>".
    A command already in XML form (starts with '<') is passed through unchanged,
    which is the escape hatch for commands with arguments the simple nesting
    can't express.
    """
    s = cmd.strip()
    if s.startswith("<"):
        return s
    tokens = s.split()
    return "".join(f"<{t}>" for t in tokens) + "".join(f"</{t}>" for t in reversed(tokens))


def _find_text(xml_text: str, tag: str) -> str | None:
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return None
    el = root.find(f".//{tag}")
    return el.text if el is not None else None


def _parse_op_result(xml_text: str) -> tuple[bool, str]:
    """Return (ok, result_text) from a PAN-OS op API response."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError:
        return False, xml_text[:_MAX_RESULT]
    ok = root.get("status") == "success"
    result_el = root.find("result")
    if result_el is not None:
        inner = (result_el.text or "") + "".join(
            ET.tostring(child, encoding="unicode") for child in result_el
        )
    else:
        # error responses carry the message in <msg>; fall back to the whole body
        inner = _find_text(xml_text, "msg") or xml_text
    return ok, inner.strip()[:_MAX_RESULT]


async def query_firewall(device: Device, credentials: DeviceCredentials, params: dict) -> dict:
    """Run a read-only operational command against `device`'s management API."""
    cmd = str((params or {}).get("cmd", "")).strip()
    if not cmd:
        raise FirewallQueryError("firewall_query requires a 'cmd' (e.g. 'show system info')")
    if not is_read_only(cmd):
        raise FirewallQueryError(
            f"refused: only read-only {SAFE_VERBS} operational commands are allowed; "
            "config changes must go through change management"
        )
    os_ = (device.os or "").lower()
    if os_ == "panos":
        return await _query_panos(device, credentials, cmd)
    raise FirewallQueryError(
        f"firewall_query is not supported yet for os={device.os!r} (PAN-OS only for now)"
    )


async def _query_panos(device: Device, credentials: DeviceCredentials, cmd: str) -> dict:
    import httpx  # lazy: keeps the pure helpers importable without the dep (tests)

    base = f"https://{device.mgmt_host}:{device.port or 443}/api/"
    async with httpx.AsyncClient(
        verify=settings.firewall_verify_tls, timeout=settings.firewall_timeout
    ) as client:
        key_resp = await client.get(
            base, params={"type": "keygen", "user": credentials.username,
                          "password": credentials.password}
        )
        key_resp.raise_for_status()
        key = _find_text(key_resp.text, "key")
        if not key:
            raise FirewallQueryError("PAN-OS keygen failed — check firewall credentials")

        op_resp = await client.get(
            base, params={"type": "op", "cmd": cli_to_xml(cmd), "key": key}
        )
        op_resp.raise_for_status()
        ok, result = _parse_op_result(op_resp.text)
    log.info("firewall.query", device=device.name, cmd=cmd, ok=ok)
    return {"ok": ok, "cmd": cmd, "result": result, "status": "success" if ok else "error"}
