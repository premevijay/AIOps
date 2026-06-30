"""Structured firewall capabilities over each vendor's management API.

This is the non-Ansible capability path for firewalls. Where `firewall_api`
exposes one arbitrary read-only `firewall_query`, this module composes that same
read path into the four named capabilities the orchestrator wires to —
**backup / get_config / health / compliance** — and structures the raw vendor
response into a stable result dict.

Supported vendors (PAN-OS deliberately stays on the Ansible path and is NOT here):
  - FortiGate FortiOS — REST GET (monitor/* & cmdb/* read paths).
  - Check Point (Gaia) — Management web_api 'show-*' commands.
  - Cisco FTD (FDM)    — Firepower Device Manager REST GET.

Design rules:
  - Reuse `firewall_api.query_firewall` for every device read; never open our own
    connection. The read-only enforcement therefore lives in one place.
  - Be honest: ops a vendor can't serve over a simple read (Check Point / FTD
    config export are async management jobs) return an unsupported result rather
    than faking a backup.
  - Pure helpers (`*_violations`, op routing) import with no third-party deps and
    touch no network. `httpx`, `os`, `subprocess` are imported lazily, matching
    `firewall_api`, so this module and its tests load without those deps.

UNSURE / needs validation against a live device (flagged for the orchestrator):
  - FortiOS health uses 'monitor/system/ha-checksum' best-effort; field names in
    'monitor/system/status' `results` (version/serial/hostname) vary by build.
  - Check Point 'show-access-rulebase' usually needs a layer `name`; query_firewall
    sends an empty body, so it commonly errors — handled gracefully.
  - The Check Point rulebase JSON shape (rule "source"/"destination"/"action") is
    parsed defensively; nested layers/sections are not walked.
  - FTD health path 'operational/systeminfo/default' 404s on some FDM versions.
  - FTD access-rule schema (sourceNetworks/destinationNetworks/ruleAction) is
    best-effort; the real rulebase is paged and field-heavy.
"""

from __future__ import annotations

import json

import structlog

from .config import settings
from .firewall_api import query_firewall
from .models import Device, DeviceCredentials

log = structlog.get_logger(__name__)

# OS keys this capability path serves. panos stays on the Ansible path on purpose.
FIREWALL_CAP_OS = frozenset({"fortios", "checkpoint", "gaia", "ftd"})

# The four named capabilities. get_config is an alias for backup.
FIREWALL_CAPS = frozenset({"backup", "get_config", "health", "compliance"})


def _unsupported(op: str, os_: str, error: str) -> dict:
    return {"ok": False, "status": "unsupported", "op": op, "os": os_, "error": error}


def _loads(text: str) -> dict | list | None:
    """Best-effort JSON parse of a query_firewall `result` string."""
    try:
        return json.loads(text or "")
    except (ValueError, TypeError):
        return None


# -- FortiGate (FortiOS REST) ----------------------------------------------
# STARTER compliance baseline (tune to your policy before trusting it):
#   flag any policy that is effectively "permit any-any-any" — srcaddr has an
#   entry named "all" AND dstaddr has an entry named "all" AND action=="accept"
#   AND service has an entry named "ALL".

def _named(entries) -> list[str]:
    """Pull the 'name' field out of a FortiOS address/service list, defensively."""
    out: list[str] = []
    if isinstance(entries, list):
        for e in entries:
            if isinstance(e, dict) and "name" in e:
                out.append(str(e["name"]))
            elif isinstance(e, str):
                out.append(e)
    elif isinstance(entries, str):
        out.append(entries)
    return out


def fortios_violations(policies: list) -> list[str]:
    """Flag effectively any-any-any accept policies. Pure; no I/O."""
    violations: list[str] = []
    if not isinstance(policies, list):
        return violations
    for pol in policies:
        if not isinstance(pol, dict):
            continue
        src = [n.lower() for n in _named(pol.get("srcaddr"))]
        dst = [n.lower() for n in _named(pol.get("dstaddr"))]
        svc = [n.upper() for n in _named(pol.get("service"))]
        action = str(pol.get("action", "")).lower()
        if "all" in src and "all" in dst and action == "accept" and "ALL" in svc:
            ident = pol.get("name") or pol.get("policyid") or pol.get("id") or "?"
            violations.append(
                f"FortiGate policy {ident}: any source -> any destination, all "
                f"services, action accept (overly permissive)"
            )
    return violations


async def _fortios_health(device: Device, creds: DeviceCredentials) -> dict:
    res = await query_firewall(device, creds, {"cmd": "monitor/system/status"})
    if not res.get("ok"):
        return {"ok": False, "status": "error",
                "error": f"FortiGate status read failed: {res.get('status')}",
                "raw": res.get("result")}
    body = _loads(res.get("result", ""))
    results = (body or {}).get("results", {}) if isinstance(body, dict) else {}
    facts = {}
    if isinstance(results, dict):
        for key in ("version", "serial", "hostname", "model_name", "build"):
            if key in results:
                facts[key] = results[key]
    # Best-effort HA state; ignore failure (single-unit firewalls have no HA).
    try:
        ha = await query_firewall(device, creds, {"cmd": "monitor/system/ha-checksum"})
        if ha.get("ok"):
            ha_body = _loads(ha.get("result", ""))
            if isinstance(ha_body, dict) and ha_body.get("results") is not None:
                facts["ha"] = ha_body["results"]
    except Exception as exc:  # noqa: BLE001 - HA is best-effort
        log.debug("fortios.ha.skip", device=device.name, error=str(exc))
    summary = "FortiGate " + ", ".join(
        f"{k}={facts[k]}" for k in ("version", "serial", "hostname") if k in facts
    ) if facts else "FortiGate status retrieved"
    return {"ok": True, "status": "ok", "summary": summary, "facts": facts}


async def _fortios_compliance(device: Device, creds: DeviceCredentials) -> dict:
    res = await query_firewall(device, creds, {"cmd": "cmdb/firewall/policy"})
    if not res.get("ok"):
        return {"ok": False, "status": "error",
                "error": f"FortiGate policy read failed: {res.get('status')}",
                "raw": res.get("result")}
    body = _loads(res.get("result", ""))
    policies = (body or {}).get("results", []) if isinstance(body, dict) else []
    violations = fortios_violations(policies if isinstance(policies, list) else [])
    compliant = not violations
    return {"ok": True, "status": "compliant" if compliant else "non-compliant",
            "compliant": compliant, "violations": violations,
            "checked": len(policies) if isinstance(policies, list) else 0}


async def _fortios_backup(device: Device, creds: DeviceCredentials, config_store: str) -> dict:
    res = await query_firewall(
        device, creds, {"cmd": "monitor/system/config/backup?scope=global"}
    )
    if not res.get("ok"):
        return {"ok": False, "status": "error",
                "error": f"FortiGate config backup read failed: {res.get('status')}",
                "raw": res.get("result")}
    text = res.get("result", "") or ""
    saved = save_config(config_store, device.name, text)
    return {"ok": True, "status": "ok", **saved}


# -- Check Point (Management web_api) --------------------------------------
# STARTER compliance baseline: flag any rule that is source Any AND dest Any AND
# action Accept. The rulebase JSON nests rules under "rulebase"; each rule's
# source/destination is a list of objects with "name", and "action" is either a
# string or an object with "name". Parsed defensively.

def _cp_names(field) -> list[str]:
    out: list[str] = []
    if isinstance(field, list):
        for e in field:
            if isinstance(e, dict) and "name" in e:
                out.append(str(e["name"]))
            elif isinstance(e, str):
                out.append(e)
    elif isinstance(field, dict) and "name" in field:
        out.append(str(field["name"]))
    elif isinstance(field, str):
        out.append(field)
    return out


def _cp_action(field) -> str:
    if isinstance(field, dict):
        return str(field.get("name", ""))
    return str(field or "")


def checkpoint_violations(rulebase: dict) -> list[str]:
    """Flag Any/Any/Accept rules in a show-access-rulebase response. Pure; no I/O."""
    violations: list[str] = []
    if not isinstance(rulebase, dict):
        return violations
    rules = rulebase.get("rulebase")
    if not isinstance(rules, list):
        return violations
    for idx, rule in enumerate(rules):
        if not isinstance(rule, dict):
            continue
        # Skip section headers / non-access-rule entries when typed.
        rtype = str(rule.get("type", "")).lower()
        if rtype and "rule" not in rtype:
            continue
        src = [n.lower() for n in _cp_names(rule.get("source"))]
        dst = [n.lower() for n in _cp_names(rule.get("destination"))]
        action = _cp_action(rule.get("action")).lower()
        if "any" in src and "any" in dst and action == "accept":
            ident = rule.get("name") or rule.get("rule-number") or rule.get("uid") or idx
            violations.append(
                f"Check Point rule {ident}: Any source -> Any destination, action "
                f"Accept (overly permissive)"
            )
    return violations


async def _checkpoint_health(device: Device, creds: DeviceCredentials) -> dict:
    res = await query_firewall(device, creds, {"cmd": "show-gateways-and-servers"})
    if not res.get("ok"):
        return {"ok": False, "status": "error",
                "error": f"Check Point gateways read failed: {res.get('status')}",
                "raw": res.get("result")}
    body = _loads(res.get("result", ""))
    objects = (body or {}).get("objects", []) if isinstance(body, dict) else []
    names = [str(o.get("name")) for o in objects
             if isinstance(o, dict) and o.get("name")]
    summary = f"Check Point: {len(names)} gateway(s)/server(s)"
    if names:
        summary += " — " + ", ".join(names[:10])
    return {"ok": True, "status": "ok", "summary": summary,
            "facts": {"count": len(names), "names": names}}


async def _checkpoint_compliance(device: Device, creds: DeviceCredentials) -> dict:
    res = await query_firewall(device, creds, {"cmd": "show-access-rulebase"})
    if not res.get("ok"):
        # Commonly errors because the command needs a layer `name` and
        # query_firewall sends an empty body — echo the device message honestly.
        return {"ok": False, "status": "error",
                "error": ("Check Point show-access-rulebase needs a layer name; "
                          f"query returned {res.get('status')}"),
                "raw": res.get("result")}
    body = _loads(res.get("result", ""))
    rulebase = body if isinstance(body, dict) else {}
    violations = checkpoint_violations(rulebase)
    compliant = not violations
    rules = rulebase.get("rulebase")
    return {"ok": True, "status": "compliant" if compliant else "non-compliant",
            "compliant": compliant, "violations": violations,
            "checked": len(rules) if isinstance(rules, list) else 0}


# -- Cisco FTD (Firepower Device Manager REST) -----------------------------
# STARTER compliance baseline: flag an access rule with empty sourceNetworks AND
# empty destinationNetworks AND ruleAction "PERMIT" (FDM treats absent network
# selectors as "any"). The real FDM rulebase is paged and field-heavy.

def ftd_violations(rules: list) -> list[str]:
    """Flag any-any PERMIT access rules in an FDM rule list. Pure; no I/O."""
    violations: list[str] = []
    if not isinstance(rules, list):
        return violations
    for idx, rule in enumerate(rules):
        if not isinstance(rule, dict):
            continue
        src = rule.get("sourceNetworks")
        dst = rule.get("destinationNetworks")
        action = str(rule.get("ruleAction", "")).upper()
        # "empty" = absent, None, or a container with no members.
        if _ftd_empty(src) and _ftd_empty(dst) and action == "PERMIT":
            ident = rule.get("name") or rule.get("id") or idx
            violations.append(
                f"Cisco FTD access rule {ident}: any source -> any destination, "
                f"ruleAction PERMIT (overly permissive)"
            )
    return violations


def _ftd_empty(field) -> bool:
    """An FDM network selector counts as empty (i.e. 'any') when it has no members.

    FDM may model this as a missing key, None, a bare list, or an object with an
    'objects'/'networks' member list. Treat all of those as empty.
    """
    if field is None:
        return True
    if isinstance(field, list):
        return len(field) == 0
    if isinstance(field, dict):
        for key in ("objects", "networks", "literals"):
            members = field.get(key)
            if isinstance(members, list) and members:
                return False
        # No populated member list found.
        return True
    return False


async def _ftd_health(device: Device, creds: DeviceCredentials) -> dict:
    res = await query_firewall(device, creds, {"cmd": "operational/systeminfo/default"})
    if not res.get("ok"):
        # 404s on some FDM versions — report honestly rather than guessing.
        return {"ok": False, "status": "error",
                "error": ("Cisco FTD/FDM systeminfo read failed (path may not exist "
                          f"on this FDM version): {res.get('status')}"),
                "raw": res.get("result")}
    body = _loads(res.get("result", ""))
    facts = {}
    if isinstance(body, dict):
        for key in ("softwareVersion", "version", "model", "modelNumber",
                    "serialNumber", "hostname"):
            if key in body:
                facts[key] = body[key]
    summary = "Cisco FTD " + ", ".join(f"{k}={v}" for k, v in facts.items()) \
        if facts else "Cisco FTD systeminfo retrieved"
    return {"ok": True, "status": "ok", "summary": summary, "facts": facts}


async def _ftd_compliance(device: Device, creds: DeviceCredentials) -> dict:
    res = await query_firewall(device, creds, {"cmd": "policy/accesspolicies"})
    if not res.get("ok"):
        return {"ok": False, "status": "error",
                "error": f"Cisco FTD access-policy read failed: {res.get('status')}",
                "raw": res.get("result")}
    body = _loads(res.get("result", ""))
    items = (body or {}).get("items", []) if isinstance(body, dict) else []
    # The accesspolicies listing gives policy containers, not the rules
    # themselves — fetching each policy's rules is a separate paged call. Only
    # flag when rule-shaped objects are actually present; otherwise be honest.
    rules = [it for it in items
             if isinstance(it, dict) and "ruleAction" in it]
    if not rules:
        return {"ok": False, "status": "error",
                "error": ("FTD compliance baseline needs validation against the FDM "
                          "rule schema — access rules are a separate paged resource "
                          "(policy/accesspolicies/{id}/accessrules) not returned here"),
                "raw": res.get("result")}
    violations = ftd_violations(rules)
    compliant = not violations
    return {"ok": True, "status": "compliant" if compliant else "non-compliant",
            "compliant": compliant, "violations": violations, "checked": len(rules)}


# -- config persistence ----------------------------------------------------

def save_config(config_store: str, device_name: str, text: str) -> dict:
    """Write a device config to <config_store>/<device_name>/running.conf (utf-8).

    File persistence is the must; git versioning is best-effort — any git error
    (no repo, git missing, nothing to commit) is swallowed. Never raises from git.
    Returns {"path", "bytes"}.
    """
    import os
    import subprocess

    dest_dir = os.path.join(config_store, device_name)
    os.makedirs(dest_dir, exist_ok=True)
    path = os.path.join(dest_dir, "running.conf")
    data = (text or "").encode("utf-8")
    with open(path, "wb") as fh:
        fh.write(data)

    # Best-effort version control. Swallow ALL git issues — saving is what counts.
    try:
        subprocess.run(["git", "-C", config_store, "add", "-A"],
                       check=False, capture_output=True)
        subprocess.run(["git", "-C", config_store, "commit", "-m",
                        f"backup {device_name}"],
                       check=False, capture_output=True)
    except Exception as exc:  # noqa: BLE001 - git is best-effort
        log.debug("save_config.git.skip", device=device_name, error=str(exc))

    return {"path": path, "bytes": len(data)}


# -- public capability router ----------------------------------------------

# (os, op) -> coroutine. backup/get_config share the per-vendor backup impl.
async def run_firewall_capability(op: str, device: Device,
                                  credentials: DeviceCredentials,
                                  config_store: str) -> dict:
    """Run a structured firewall capability over the device's management API.

    `op` in {backup, get_config, health, compliance}; get_config aliases backup.
    Returns a dict with at least {"ok", "status"}. compliance also carries
    {"compliant", "violations"}; a successful backup also carries {"path", "bytes"}.

    Unknown op, or an os not in FIREWALL_CAP_OS, returns an unsupported result
    (never raises) so the worker turns it into a clean JobResult.
    """
    os_ = (device.os or "").lower()
    if os_ not in FIREWALL_CAP_OS:
        return _unsupported(op, os_, f"os={device.os!r} is not on the firewall "
                                     f"capability path; supported: {sorted(FIREWALL_CAP_OS)}")
    if op not in FIREWALL_CAPS:
        return _unsupported(op, os_, f"unknown firewall capability {op!r}; "
                                     f"supported: {sorted(FIREWALL_CAPS)}")

    cfg_store = config_store or settings.config_store

    try:
        if op in ("backup", "get_config"):
            return await _do_backup(os_, device, credentials, cfg_store)
        if op == "health":
            return await _HEALTH[os_](device, credentials)
        if op == "compliance":
            return await _COMPLIANCE[os_](device, credentials)
    except Exception as exc:  # noqa: BLE001 - surface as a result, never raise
        log.error("firewall_capability.failed", op=op, device=device.name,
                  os=os_, error=str(exc))
        return {"ok": False, "status": "error", "op": op, "os": os_,
                "error": f"{type(exc).__name__}: {exc}"}

    return _unsupported(op, os_, f"unhandled capability {op!r}")


async def _do_backup(os_: str, device: Device, creds: DeviceCredentials,
                     config_store: str) -> dict:
    if os_ == "fortios":
        return await _fortios_backup(device, creds, config_store)
    if os_ in ("checkpoint", "gaia"):
        return {"ok": False, "status": "unsupported",
                "error": ("Check Point config backup needs the async management "
                          "export API — not implemented; use health/compliance or "
                          "firewall_query")}
    if os_ == "ftd":
        return {"ok": False, "status": "unsupported",
                "error": ("Cisco FTD/FDM config export is an async job — not "
                          "implemented; use health/compliance or firewall_query")}
    return _unsupported("backup", os_, "no backup implementation for this os")


_HEALTH = {
    "fortios": _fortios_health,
    "checkpoint": _checkpoint_health,
    "gaia": _checkpoint_health,
    "ftd": _ftd_health,
}

_COMPLIANCE = {
    "fortios": _fortios_compliance,
    "checkpoint": _checkpoint_compliance,
    "gaia": _checkpoint_compliance,
    "ftd": _ftd_compliance,
}
