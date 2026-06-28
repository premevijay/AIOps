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
  servers, the guardrail/autonomy model, the phased build plan, and the
  locked Phase 1 decisions.

## Setup

- [`docs/setup/UBUNTU_DOCKER_SETUP.md`](docs/setup/UBUNTU_DOCKER_SETUP.md)
  — stand up the Phase 1 runtime host: an Ubuntu VM with Docker Engine +
  Compose, VM sizing, the stack skeleton, and a device-reachability check.

## Phase 1 — connectivity spine (scaffolded)

The first backend service is in [`services/worker/`](services/worker/) — a NATS
connectivity worker that resolves credentials from a `SecretProvider` (CyberArk
Conjur, with an env provider for first-run) and pulls config/health through a
vendor `DeviceDriver` (Cisco Catalyst first). Bring the stack up with
[`compose.yaml`](compose.yaml); see the
[worker README](services/worker/README.md) to run it and enqueue a test job.

## Prior work

`AIOpsaethernetops.bundle` preserves the earlier **AetherNetOps** UI prototype
(React + Vite dashboard with realistic mock data). It is the presentation layer
that the architecture above is designed to sit beneath.
