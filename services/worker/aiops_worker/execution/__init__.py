"""Execution backend factory."""

from __future__ import annotations

from ..config import settings
from .base import ExecutionBackend, OP_PLAYBOOK, build_extravars, build_inventory

__all__ = [
    "ExecutionBackend", "OP_PLAYBOOK", "build_inventory", "build_extravars",
    "build_executor", "parse_template_map",
]


def parse_template_map(raw: str) -> dict[str, str]:
    """Parse 'backup=12,health=13' -> {'backup': '12', 'health': '13'}."""
    out: dict[str, str] = {}
    for pair in (raw or "").split(","):
        pair = pair.strip()
        if not pair:
            continue
        key, _, value = pair.partition("=")
        if key and value:
            out[key.strip()] = value.strip()
    return out


def build_executor() -> ExecutionBackend:
    kind = settings.execution_backend.lower()
    if kind == "local":
        from .local_runner import LocalRunnerBackend
        return LocalRunnerBackend(
            project_dir=settings.ansible_project_dir,
            config_store=settings.config_store,
        )
    if kind == "awx":
        from .awx import AwxBackend
        return AwxBackend(
            base_url=settings.awx_url,
            token=settings.awx_token,
            template_map=parse_template_map(settings.awx_templates),
            verify=settings.awx_verify_ssl,
        )
    raise ValueError(f"unknown execution_backend: {settings.execution_backend!r}")
