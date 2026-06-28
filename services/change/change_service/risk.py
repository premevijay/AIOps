"""Risk scorer — pure, no IO.

Produces a 0-100 score from simple heuristics over the target device and the
proposed config lines, then maps it to a level. This is a lab-grade model meant
to make the approval decision legible (the `factors` explain the number); a
production scorer would incorporate CMDB blast-radius, change history, and
service dependencies.
"""

from __future__ import annotations

from .models import Device, RiskResult

# Base risk by device-type hint found in the vendor/name string.
_TYPE_BASE = {
    "firewall": 30,
    "load_balancer": 30,
    "load-balancer": 30,
    "router": 20,
    "switch": 10,
}

# Per change-class keyword weights (matched as substrings of a config line).
_KEYWORD_WEIGHTS = {
    "shutdown": 20,
    "no ": 15,
    "access-list": 15,
    "route-map": 15,
    "aaa": 20,
}


def _level_for(score: int) -> str:
    if score < 30:
        return "low"
    if score < 60:
        return "medium"
    if score < 85:
        return "high"
    return "critical"


def _type_base(device: Device) -> tuple[int, str]:
    haystack = f"{device.vendor} {device.os} {device.name}".lower()
    for key, weight in _TYPE_BASE.items():
        if key in haystack:
            return weight, key.replace("_", " ").replace("-", " ")
    return 10, "generic device"


def score(device: Device, config_lines: list[str]) -> RiskResult:
    """Score a proposed change 0-100 and explain the contributing factors."""
    factors: list[str] = []

    base, type_label = _type_base(device)
    total = base
    factors.append(f"device type ({type_label}): +{base}")

    for keyword, weight in _KEYWORD_WEIGHTS.items():
        if any(keyword in line.lower() for line in config_lines):
            total += weight
            factors.append(f"change touches {keyword.strip()!r}: +{weight}")

    name = device.name.lower()
    if "core" in name or "spine" in name:
        total += 25
        factors.append("high blast-radius (core/spine device): +25")

    total = max(0, min(100, total))
    level = _level_for(total)
    return RiskResult(score=total, level=level, factors=factors)
