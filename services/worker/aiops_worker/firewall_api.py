"""Direct firewall management-API client — the non-Ansible read path.

`firewall_query` lets the firewall agent run an arbitrary READ-ONLY operational
command straight against a firewall's management API, so it isn't limited to the
fixed playbook capabilities. It is deliberately reads-only: only `show`/`test`
operational commands are accepted — anything that could mutate the device is
refused here. Device-mutating changes stay on the gated change-management path.

Supported vendors (each enforces its own read-only rule; `cmd` form differs):
  - Palo Alto PAN-OS  — XML API; cmd is a CLI op string ('show system info').
  - FortiGate FortiOS — REST GET; cmd is a path ('monitor/system/status').
  - Check Point        — web_api; cmd is a 'show-*' command (login/run/logout).
  - Cisco FTD (FDM)    — REST token + GET; cmd is a resource path.

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


def _truncate(s: str) -> str:
    return (s or "").strip()[:_MAX_RESULT]


# -- FortiGate (FortiOS REST API) ------------------------------------------
# "cmd" is a REST resource path; we only ever issue GET, so it is read-only by
# construction. We additionally restrict to the read collections.
_FORTIOS_READ_PREFIXES = ("monitor/", "cmdb/")


def fortios_path(cmd: str) -> str:
    """Normalize a FortiOS REST path: strip leading slash and an 'api/v2/' prefix."""
    p = cmd.strip().lstrip("/")
    if p.startswith("api/v2/"):
        p = p[len("api/v2/"):]
    return p


def fortios_path_ok(cmd: str) -> bool:
    return fortios_path(cmd).startswith(_FORTIOS_READ_PREFIXES)


# -- Check Point (Management API) ------------------------------------------
def checkpoint_read_only(cmd: str) -> bool:
    """Check Point web_api read commands are the 'show-*'/'show' family."""
    return cmd.strip().lower().startswith("show")


async def query_firewall(device: Device, credentials: DeviceCredentials, params: dict) -> dict:
    """Run a read-only operational query against `device`'s management API.

    Dispatches by device OS; each vendor handler enforces its own read-only
    rule. Mutating operations are always refused here — config changes go
    through change management.
    """
    cmd = str((params or {}).get("cmd", "")).strip()
    if not cmd:
        raise FirewallQueryError("firewall_query requires a 'cmd' (see the tool help for the per-vendor form)")
    os_ = (device.os or "").lower()
    handler = _DISPATCH.get(os_)
    if handler is None:
        raise FirewallQueryError(
            f"firewall_query is not supported for os={device.os!r}; supported: {sorted(_DISPATCH)}"
        )
    return await handler(device, credentials, cmd)


async def _query_panos(device: Device, credentials: DeviceCredentials, cmd: str) -> dict:
    """Palo Alto PAN-OS — XML API. `cmd` is a CLI op string ('show system info')."""
    if not is_read_only(cmd):
        raise FirewallQueryError(
            f"refused: PAN-OS firewall_query allows only read-only {SAFE_VERBS} commands"
        )
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
    log.info("firewall.query", device=device.name, cmd=cmd, ok=ok, vendor="panos")
    return {"ok": ok, "cmd": cmd, "result": result, "status": "success" if ok else "error"}


async def _query_fortios(device: Device, credentials: DeviceCredentials, cmd: str) -> dict:
    """FortiGate (FortiOS) — REST API GET. `cmd` is a path like
    'monitor/system/status' or 'cmdb/firewall/policy'. Auth: the device password
    is treated as a FortiOS API token (Bearer)."""
    if not fortios_path_ok(cmd):
        raise FirewallQueryError(
            "refused: FortiGate firewall_query allows only GET to 'monitor/...' or 'cmdb/...' paths"
        )
    import httpx

    url = f"https://{device.mgmt_host}:{device.port or 443}/api/v2/{fortios_path(cmd)}"
    async with httpx.AsyncClient(
        verify=settings.firewall_verify_tls, timeout=settings.firewall_timeout
    ) as client:
        resp = await client.get(url, headers={"Authorization": f"Bearer {credentials.password}"})
        ok = resp.status_code == 200
        status = resp.status_code
        body = resp.text
    log.info("firewall.query", device=device.name, cmd=cmd, ok=ok, vendor="fortios")
    return {"ok": ok, "cmd": cmd, "result": _truncate(body),
            "status": "success" if ok else f"http {status}"}


async def _query_checkpoint(device: Device, credentials: DeviceCredentials, cmd: str) -> dict:
    """Check Point management server — web_api. `cmd` is a read command like
    'show-gateways-and-servers' or 'show-access-rulebase'. login -> command -> logout."""
    if not checkpoint_read_only(cmd):
        raise FirewallQueryError(
            "refused: Check Point firewall_query allows only 'show-*' management commands"
        )
    import httpx

    base = f"https://{device.mgmt_host}:{device.port or 443}/web_api"
    async with httpx.AsyncClient(
        verify=settings.firewall_verify_tls, timeout=settings.firewall_timeout
    ) as client:
        login = await client.post(
            f"{base}/login", json={"user": credentials.username, "password": credentials.password}
        )
        login.raise_for_status()
        sid = login.json().get("sid")
        if not sid:
            raise FirewallQueryError("Check Point login failed (no session id)")
        headers = {"X-chkp-sid": sid, "content-type": "application/json"}
        try:
            resp = await client.post(f"{base}/{cmd.strip()}", json={}, headers=headers)
            ok = resp.status_code == 200
            status = resp.status_code
            body = resp.text
        finally:
            await client.post(f"{base}/logout", json={}, headers=headers)
    log.info("firewall.query", device=device.name, cmd=cmd, ok=ok, vendor="checkpoint")
    return {"ok": ok, "cmd": cmd, "result": _truncate(body),
            "status": "success" if ok else f"http {status}"}


async def _query_ftd(device: Device, credentials: DeviceCredentials, cmd: str) -> dict:
    """Cisco FTD via Firepower Device Manager (FDM) REST API — token + GET.
    `cmd` is a resource path like 'object/networks' or 'devices/default/routing'.
    GET-only, so read-only by construction."""
    import httpx

    base = f"https://{device.mgmt_host}:{device.port or 443}"
    path = cmd.strip().lstrip("/")
    url_path = path if path.startswith("api/fdm/") else f"api/fdm/latest/{path}"
    async with httpx.AsyncClient(
        verify=settings.firewall_verify_tls, timeout=settings.firewall_timeout
    ) as client:
        tok = await client.post(
            f"{base}/api/fdm/latest/fdm/token",
            json={"grant_type": "password", "username": credentials.username,
                  "password": credentials.password},
        )
        tok.raise_for_status()
        access = tok.json().get("access_token")
        if not access:
            raise FirewallQueryError("FTD/FDM token request failed — check credentials")
        resp = await client.get(f"{base}/{url_path}", headers={"Authorization": f"Bearer {access}"})
        ok = resp.status_code == 200
        status = resp.status_code
        body = resp.text
    log.info("firewall.query", device=device.name, cmd=cmd, ok=ok, vendor="ftd")
    return {"ok": ok, "cmd": cmd, "result": _truncate(body),
            "status": "success" if ok else f"http {status}"}


# os -> handler. Check Point management runs on Gaia, so both keys map to it.
_DISPATCH = {
    "panos": _query_panos,
    "fortios": _query_fortios,
    "checkpoint": _query_checkpoint,
    "gaia": _query_checkpoint,
    "ftd": _query_ftd,
}
