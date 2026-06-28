# AIOps

A platform for **autonomous, multi-vendor network operations** — a team of
specialized AI network-engineer agents (configuration, automation, compliance,
audit, change management, backup, monitoring, health, troubleshooting, and
risk/governance) that operate the on-prem device fleet, running on Dell servers.

## Where to start

**Building the lab?** Follow [`docs/LAB_GUIDE.md`](docs/LAB_GUIDE.md) — a single
ordered runbook from a bare Ubuntu VM to the full stack (device → worker →
Conjur → AWX → agent → monitoring), with a minimal-path-first order.

**Phase 0 — the target architecture map** is the current deliverable:

- [`docs/architecture/AGENT_TEAM_ARCHITECTURE.md`](docs/architecture/AGENT_TEAM_ARCHITECTURE.md)
  — the full target architecture: the agent team, the platform planes, the
  Ansible/AWX execution engine, Vault, the deployment topology on the Dell
  servers, the guardrail/autonomy model, the phased build plan, and the
  locked decisions.

## Execution engine — Ansible, run by AWX

Task-based device operations (backup, compliance, health, config, change, audit,
automation) are **Ansible** playbooks under [`ansible/`](ansible/), run by **AWX**
in production and by `ansible-runner` in the lab. Adding a vendor = installing a
collection + a per-OS block. Streaming monitoring (SNMP/synthetic) stays on a
separate telemetry stack.

## Setup

- [`docs/setup/UBUNTU_DOCKER_SETUP.md`](docs/setup/UBUNTU_DOCKER_SETUP.md)
  — stand up the runtime host: an Ubuntu VM with Docker Engine + Compose.
- [`docs/setup/AWX_SETUP.md`](docs/setup/AWX_SETUP.md)
  — stand up AWX (the production execution control plane) and wire its job
  templates to the playbooks.

## Phase 1 — execution spine (scaffolded)

The first backend service is in [`services/worker/`](services/worker/) — a NATS
execution worker that resolves credentials from a `SecretProvider` (CyberArk
Conjur, with an env provider for first-run) and runs the `ansible/` playbooks via
ansible-runner (or launches AWX job templates). Bring the stack up with
[`compose.yaml`](compose.yaml); see the
[worker README](services/worker/README.md) to run it and enqueue a test job.

## The first agent — NetOps Supervisor

[`services/supervisor/`](services/supervisor/) is a **LangGraph** agent (hosted
Claude model behind a `ModelProvider` seam) that turns a natural-language intent
into read-only capability calls on the worker (`POST /intent`). Its tools are
read-only by design — anything that would mutate a device is **proposed, not
executed**, pending the change-management approval path. See the
[supervisor README](services/supervisor/README.md).

## Change management — the gated-write path

[`services/change/`](services/change/) is the human-approval authority for any
device-mutating change:

```
agent/operator ──propose──▶ policy-as-code ──▶ risk score ──▶ HUMAN approve
                                                                    │
                       audit ◀── apply (Ansible) ◀── change window ◀┘
```

The worker refuses to run the `apply` playbook without a valid HMAC token the
change service issues only after approval — so the guardrail is enforced in
code, not just policy. The supervisor agent can `propose_change` but has no
approve/apply capability.

## Monitoring — telemetry stack (off Ansible)

[`telemetry/`](telemetry/) is the SNMP + synthetic monitoring capability, kept
**off Ansible** because it's continuous, not task-based: **Telegraf** (SNMP +
ICMP/HTTP probes) → **Prometheus** → **Grafana** (pre-provisioned datasource +
the NetOps Overview dashboard). The [`dashboard/`](dashboard/) AetherNetOps UI
embeds those Grafana panels live in its Monitoring view via `VITE_GRAFANA_URL`.

## Prior work

`AIOpsaethernetops.bundle` preserves the earlier **AetherNetOps** UI prototype
(React + Vite dashboard with realistic mock data). It is the presentation layer
that the architecture above is designed to sit beneath.
