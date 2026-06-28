"""Inventory loading + device resolution. Pure; no LLM/NATS deps (unit-tested)."""

from __future__ import annotations

import yaml


def load_inventory(path: str) -> list[dict]:
    with open(path) as fh:
        doc = yaml.safe_load(fh) or {}
    return doc.get("devices", [])


def device_names(devices: list[dict]) -> list[str]:
    return [d["name"] for d in devices if "name" in d]


def get_device(devices: list[dict], name: str) -> dict | None:
    return next((d for d in devices if d.get("name") == name), None)
