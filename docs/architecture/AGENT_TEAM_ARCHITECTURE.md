# AIOps — Network Operations Agent Team: Target Architecture

> **Status:** Target architecture map (Phase 0 deliverable). No code yet.
> **Scope of this document:** the full target system — the team of specialized
> network-engineer agents, the platform planes they run on, how they connect to
> multi-vendor on-prem devices through Vault, and how they are deployed on the
> Dell servers. Implementation phasing is at the end.
>
> This is the agreed **"map the full target architecture first"** step. Treat it
> as the contract every later build phase is measured against.

---

## 1. The goal, in one paragraph

We are building a **team of AI network engineers** — not one chatbot. Each agent
owns a specific operational domain (configuration, automation, compliance,
audit, change management, backup, monitoring, health, troubleshooting,
risk/governance). A **supervisor** decomposes intent and routes work to the
right specialist. Every agent shares a common platform: vendor-agnostic device
drivers, short-lived secrets from Vault, versioned config/state stores, and an
append-only audit ledger. Agents **read freely** but **every write to a device
is gated** by policy-as-code, a change window, and human approval. The whole
thing runs **on-prem on the Dell servers**, beside the network it manages.

Target fleet (from the original requirement):

| Class          | Vendors                                                        |
| -------------- | ------------------------------------------------------------- |
| Switching      | Cisco Catalyst (campus), Cisco Nexus (DC), Cisco SD-WAN        |
| Firewall       | Palo Alto, Cisco FTD, Check Point, FortiGate                  |
| Load balancer  | F5 BIG-IP, AVI / NSX ALB                                       |
| Secrets/Vault  | CyberArk (Conjur/CCP), HashiCorp Vault                         |
| Later          | Cloud (AWS/Azure/GCP network constructs)                      |

---

## 2. The planes (platform the agents stand on)

Everything below the agents is shared infrastructure. The agents never talk to a
device directly — they launch **Ansible** through AWX (and read telemetry from
the monitoring stack), which gives us one place to enforce auth, audit,
scheduling, approvals, and vendor coverage.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PRESENTATION PLANE                                                        │
│  AetherNetOps UI (existing React prototype)  ·  REST/GraphQL API  ·  CLI  │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │
┌───────────────────────────────┴───────────────────────────────────────────┐
│  INTELLIGENCE PLANE  (the agent team — Section 3)                          │
│  Supervisor/Orchestrator  +  10 specialist agents  +  shared tool registry │
│  LLM runtime  ·  RAG/knowledge base  ·  policy-as-code guardrails          │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │
┌───────────────────────────────┴───────────────────────────────────────────┐
│  DATA PLANE                                                                 │
│  Postgres (inventory/state/CMDB)  ·  Git + object store (configs/backups)  │
│  Prometheus/InfluxDB (metrics)  ·  Vector DB (RAG)  ·  Audit ledger        │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │
┌───────────────────────────────┴───────────────────────────────────────────┐
│  EXECUTION PLANE  (task-based device ops — Ansible)                         │
│  AWX (control plane: RBAC · audit · scheduling · approvals · creds)         │
│  Job templates → Ansible playbooks → vendor collections                     │
│  (lab: ansible-runner in the worker, same playbooks · NATS job bus)         │
│                                                                            │
│  TELEMETRY PATH  (streaming — NOT Ansible)                                  │
│  Telegraf/snmp_exporter → Prometheus/InfluxDB   ·   synthetic probes        │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │
┌───────────────────────────────┴───────────────────────────────────────────┐
│  SECRETS PLANE  (consulted on every device session)                        │
│  SecretProvider / AWX credential → CyberArk (Conjur) · HashiCorp (later)   │
│  Short-lived creds · never persisted · every fetch logged                  │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │
                    ┌──────────┴───────────┐
                    │  On-prem device fleet │  (mgmt network, Section 6)
                    │  switches/fw/LB       │
                    └───────────────────────┘
```

Two non-negotiable cross-cutting rules:

1. **Vault on every session.** Device credentials come from CyberArk at run time
   (the worker's `SecretProvider` in the lab; an AWX CyberArk Conjur credential
   in production), are used for that session only, never stored, and every fetch
   is audited. Secrets are a dependency of every capability — build them first.
2. **Ansible is the execution engine; the OS is the only vendor seam.** Every
   task-based operation (backup, compliance, health, config, change, audit,
   automation) is an **Ansible playbook** run by AWX, using the vendor
   collection for the device's OS (`cisco.ios`, `cisco.nxos`, `paloaltonetworks.panos`,
   `fortinet.fortios`, `check_point.mgmt`, `f5networks.f5_modules`, `vmware.alb`…).
   **Adding a vendor = installing a collection + a per-OS block**, not writing a
   driver. Streaming telemetry (SNMP/synthetic) is the exception — it stays on
   the telemetry path, not Ansible.

---

## 3. The agent team

The core of this turn. The team is organized as a **supervisor + specialists**
pattern. The supervisor is the "team lead network engineer"; each specialist is
a senior engineer who owns one domain end-to-end.

### 3.1 Supervisor / Orchestrator agent

- **Role:** receives an intent (from a human, the UI, a schedule, or an alert),
  decomposes it into tasks, routes each task to the right specialist, sequences
  dependencies, aggregates results, and owns the human-approval handshake.
- **Owns:** task graph, conversation/working memory, guardrail enforcement,
  escalation to humans.
- **Never:** touches a device directly — it only delegates.

### 3.2 The ten specialists

Each row is a self-contained agent. **Autonomy** column: `R` = may act
autonomously on **read-only** operations; `R+W*` = may *propose* writes but a
write requires approval + change window.

| # | Agent | Owns (responsibilities) | Primary tools | Autonomy |
|---|-------|------------------------|---------------|----------|
| 1 | **Configuration** | Golden configs, templating (Jinja2), config generation, drift remediation, intended-state | `config.get`, `config.render`, `config.apply*`, `config.diff` | R+W* |
| 2 | **Automation** | Playbooks, bulk/scheduled jobs, workflow runs, fleet-wide operations | `job.schedule`, `job.run`, `playbook.exec`, `inventory.query` | R+W* |
| 3 | **Backup** | Scheduled + on-change config backups, versioning to Git, golden-vs-running drift, restore | `backup.run`, `vcs.commit`, `config.diff`, `backup.restore*` | R+W* |
| 4 | **Compliance** | CIS/PCI/NIST/internal policy checks, Batfish analysis, scoring, remediation snippets | `compliance.scan`, `batfish.query`, `policy.eval`, `report.write` | R |
| 5 | **Audit** | Audit trail, evidence collection, who-did-what, log integrity, auditor evidence packs | `audit.query`, `evidence.collect`, `ledger.verify` | R |
| 6 | **Change Management** | Change requests, risk scoring, approval/CAB workflow, change windows, rollback plans | `change.create`, `risk.score`, `approval.request`, `rollback.plan` | R+W* |
| 7 | **Monitoring** | SNMP polling, synthetic probes, telemetry ingest, alerting, anomaly detection | `snmp.poll`, `probe.run`, `metrics.query`, `alert.raise` | R |
| 8 | **Health Check** | Scheduled show-command bundles, structured parsing (TextFSM), health scoring | `health.check`, `cli.show`, `parse.structured`, `score.compute` | R |
| 9 | **Troubleshooting / RCA** | Diagnostic loop, root-cause analysis, correlates metrics+config+logs, proposes fix | `snmp.poll`, `config.diff`, `health.check`, `log.search`, `remediate.propose*` | R+W* |
| 10 | **Risk & Governance** | Risk posture, vuln/CVE correlation to fleet, policy-as-code, guardrail authoring | `risk.assess`, `cve.correlate`, `policy.author`, `posture.report` | R |

The tool names above are logical capabilities. Concretely, a device-touching
tool is an **AWX job template** the agent launches (e.g. `compliance.scan` →
launch the `aiops-compliance` template, scoped by RBAC); read-only data tools
query the data/telemetry plane. AWX is the choke point where the guardrails,
approvals, and audit in Section 4 are enforced — the agents don't run Ansible or
touch devices themselves.

**Why one agent per domain (not one mega-agent):** smaller, scoped toolbelts
mean tighter guardrails, clearer audit attribution ("the Change agent did X"),
independent iteration, and the ability to give each agent only the AWX templates
it needs. It mirrors how a real NetOps team is staffed.

### 3.3 How the team coordinates (example flow)

> *"fgt-syd-edge-09 is dropping sessions."*

```
Human/alert ──▶ Supervisor
   │  decomposes: diagnose → identify change → remediate (gated)
   ├─▶ Monitoring agent      → pulls SNMP/session telemetry, confirms drop
   ├─▶ Troubleshooting agent → correlates with config.diff + logs → root cause
   ├─▶ Configuration agent   → renders the corrective config (does NOT push)
   ├─▶ Change Management agent→ creates CR, scores risk, builds rollback plan
   │                           ─── HUMAN APPROVAL GATE ───
   ├─▶ Configuration agent    → apply* inside change window (creds from Vault)
   ├─▶ Backup agent           → snapshots post-change config to Git
   └─▶ Audit agent            → records the full chain as immutable evidence
```

Reads happen freely and in parallel; the single **write** sits behind the
approval gate. Every step lands in the audit ledger.

---

## 4. Guardrails & autonomy model

This is what makes a team of agents safe enough to point at production gear.

- **Read/write split.** Any operation that mutates a device, secret, or policy
  is a *write*. Writes are never auto-executed; they are *proposed*, then pass
  through: policy-as-code check → risk score → human approval → change window →
  staged apply → automatic post-change verify → audit.
- **Policy-as-code.** Guardrails (e.g. "no config push to a `critical`-status
  firewall outside a window", "deny any change touching mgmt-plane ACLs without
  CAB") live as versioned rules (OPA/Rego or equivalent) the Risk agent authors
  and the Supervisor enforces. Not prompt text — actual code in the path.
- **Least-privilege creds.** Vault issues per-session, per-device, scoped,
  short-lived credentials. A monitoring poll gets read-only SNMP creds; a config
  push gets a scoped enable credential — different paths, different leases.
- **Full audit ledger.** Append-only, tamper-evident record of every intent,
  tool call, secret fetch, approval, and device write. This is both the Audit
  agent's data source and the compliance evidence trail.
- **Rollback always staged before apply.** The Change agent must produce a
  validated rollback plan before any write is eligible for approval.

---

## 5. LLM & knowledge (intelligence plane internals)

- **LLM runtime (locked, Section 8).** A hosted frontier model via the egress
  proxy for reasoning quality, kept behind a `ModelProvider` interface so it can
  be swapped for a self-hosted local model later without touching agent code.
  Raw secrets/configs are never sent to any model not approved for that data
  class.
- **RAG / knowledge base.** Vector store over: the versioned config repo, vendor
  documentation, internal runbooks, and historical incidents. Grounds the
  Troubleshooting and Configuration agents so they cite real state, not guesses.
- **Shared tool registry.** Tools are defined once, versioned, and granted to
  agents per the matrix in 3.2. A tool carries its own auth scope and
  read/write classification so the guardrail layer can reason about it.

---

## 6. Deployment on the Dell servers (on-prem)

The agents run **beside the network they manage**, on your Dell hardware.

```
┌──── Dell server → Ubuntu Linux VM → Docker (Compose) — on-prem ────────────┐
│  Phase 1: Docker Compose services on one Ubuntu VM (→ k3s for prod HA later)│
│                                                                            │
│  ┌── Intelligence ──┐  ┌── Platform services ──┐  ┌── Data ──┐            │
│  │ Supervisor       │  │ API gateway           │  │ Postgres  │            │
│  │ 10 specialists   │  │ Job bus (NATS)        │  │ Git/minio │            │
│  │ (LangGraph)      │  │ Connectivity workers  │  │ Prometheus│            │
│  │ Model proxy →    │  │ SecretProvider svc    │  │ Vector DB │            │
│  │   hosted LLM     │  │                       │  │          │            │
│  │ RAG/vector DB    │  │                       │  │          │            │
│  └──────────────────┘  └───────────────────────┘  └──────────┘            │
│                                                                            │
│  Vault: CyberArk Conjur (container) first; HashiCorp Vault added later     │
└───────────────────────────────┬────────────────────────────────────────────┘
                                │  dedicated mgmt network / pnet bridge
                ┌───────────────┴────────────────┐
                │   Device fleet (mgmt IPs)        │
                │   SSH · HTTPS/REST · NETCONF · SNMP
                └─────────────────────────────────┘
```

- **Management network.** A dedicated mgmt subnet reaches every device's mgmt IP
  over SSH / HTTPS-REST / NETCONF / SNMP. (In the EVE-NG lab this is the
  `Cloud`/`pnet` bridge; in production it is the real OOB mgmt network.)
- **Lab parity.** EVE-NG emulates the real vendor OSes so drivers exercise
  genuine CLIs/APIs, not mocks. The Dell deployment topology is identical to the
  lab topology — same workers, same Vault, same stores — only the device side
  changes from emulated to physical.
- **Scale knobs.** Connectivity workers scale horizontally (devices are slow and
  flaky → keep them async behind the job bus). Stateful stores get HA when we
  leave lab mode.

---

## 7. Phased build plan (don't boil the ocean)

| Phase | Goal | Exit criteria |
|-------|------|---------------|
| **0 — Architecture (this doc)** | Agree the target map | This document accepted |
| **1 — Vault + execution spine** | Docker/Compose on the Ubuntu VM + `CyberArkProvider` + Ansible (`cisco.ios`) run by the worker via ansible-runner against a lab Catalyst | Worker fetches creds from CyberArk and runs `backup.yml` end-to-end in EVE-NG |
| **2 — First capabilities, one vendor** | Backup → Compliance → Health on Catalyst | Drift detection + a passing/failing compliance scan on the lab device |
| **3 — First agents** | Stand up Supervisor + Backup + Compliance + Monitoring agents over the normalized data | An intent routes to a specialist and returns grounded results |
| **4 — Guardrails + change mgmt** | Policy-as-code, approval gate, audit ledger, Change agent | A gated config write executes only after approval, fully audited |
| **5 — Widen vendors** | Add Nexus, SD-WAN by writing only new drivers | Same capabilities pass on 3 switch vendors |
| **6 — Firewalls** | Palo Alto, FTD, Check Point, FortiGate drivers | Capabilities + agents pass on firewalls |
| **7 — Load balancers** | F5, AVI drivers | Full on-prem fleet covered |
| **8 — Troubleshooting + Risk/Governance agents** | RCA loop + risk posture over the full fleet | End-to-end incident flow (Section 3.3) works in the lab |
| **9 — Cloud** | Extend the execution plane to cloud network constructs (cloud Ansible collections) | First cloud target onboarded |

Guiding principle: **add a vendor = install a collection + a per-OS playbook
block**; **add a capability = a new playbook + job template the agents can
launch**. Ansible's vendor coverage is what makes both cheap.

---

## 8. Decisions (locked — 2026-06-28)

These shape Phase 1 and are now decided:

| # | Decision | Choice | Implication |
|---|----------|--------|-------------|
| 1 | **LLM hosting** | Hosted frontier model via egress proxy, behind a `ModelProvider` interface | Best reasoning quality now; local model swappable later with no agent-code change. Raw secrets/configs are never sent to a model not approved for that data class. |
| 2 | **Vault** | **CyberArk first** (Conjur/CCP), HashiCorp added later behind the same `SecretProvider` interface | `CyberArkProvider` in the worker (lab); an AWX CyberArk Conjur credential in production. |
| 3 | **Orchestration** | **LangGraph** (framework) for the supervisor/specialist graph | Use its supervisor / tool-loop / human-in-the-loop patterns; the agents' tools launch AWX job templates. |
| 4 | **Runtime host** | **Docker** (Compose) on an **Ubuntu Linux VM** | Lab/Phase 1 runs as Compose services on one Ubuntu VM. See [`docs/setup/UBUNTU_DOCKER_SETUP.md`](../setup/UBUNTU_DOCKER_SETUP.md). Graduate to k3s for production HA later. |
| 5 | **First vendor** | **Cisco Catalyst** (IOS-XE) as the Phase 1 reference | First playbooks target IOS; other vendors follow by adding a collection + per-OS block. |
| 6 | **Execution engine** | **Ansible**, run by **AWX** (open-source) | All task-based ops are playbooks; AWX gives RBAC/audit/scheduling/approvals/creds. Lab runs the same playbooks via `ansible-runner` in the worker. See [`docs/setup/AWX_SETUP.md`](../setup/AWX_SETUP.md). |
| 7 | **Pivot scope** | **Ansible-primary; telemetry stays direct** | Ansible owns backup/compliance/health/config/change/audit/automation. The NAPALM `DeviceDriver` is **retired**. SNMP/synthetic monitoring stays on Telegraf/Prometheus. |

---

## 9. Relationship to existing work

The prior **AetherNetOps** effort (preserved in `AIOpsaethernetops.bundle`)
built the **presentation plane** — a clickable React/Vite dashboard with the
seven views (Overview, Inventory+Vault, Backup, Compliance, Health, Monitoring,
AI Troubleshooting) plus Topology and Change Management, all on realistic mock
data. That UI is the front door for the system mapped here: the agent team and
platform planes (Sections 2–6) are the **real backend** the dashboard was always
meant to sit on top of. No live device connections exist yet — this document is
the bridge from prototype to platform.
