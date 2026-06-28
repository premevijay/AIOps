# AIOps

A platform for **autonomous, multi-vendor network operations** — a team of
specialized AI network-engineer agents (configuration, automation, compliance,
audit, change management, backup, monitoring, health, troubleshooting, and
risk/governance) that operate the on-prem device fleet, running on Dell servers.

## Where to start

**Phase 0 — the target architecture map** is the current deliverable:

- [`docs/architecture/AGENT_TEAM_ARCHITECTURE.md`](docs/architecture/AGENT_TEAM_ARCHITECTURE.md)
  — the full target architecture: the agent team, the five platform planes,
  Vault and multi-vendor connectivity, the deployment topology on the Dell
  servers, the guardrail/autonomy model, and the phased build plan.

## Prior work

`AIOpsaethernetops.bundle` preserves the earlier **AetherNetOps** UI prototype
(React + Vite dashboard with realistic mock data). It is the presentation layer
that the architecture above is designed to sit beneath.
