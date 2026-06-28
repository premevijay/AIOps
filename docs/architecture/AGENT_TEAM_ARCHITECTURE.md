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

## 2. The five planes (platform the agents stand on)

Everything below the agents is shared infrastructure. The agents never talk to a
device directly — they call platform services, which gives us one place to
enforce auth, audit, rate-limiting, and vendor normalization.

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
│  CONNECTIVITY PLANE                                                         │
│  Async job bus (NATS/Kafka/Redis)  →  worker pool                          │
│  One DeviceDriver per vendor behind a common interface                     │
│  Netmiko/NAPALM/Scrapli (CLI)  ·  PAN-OS/FortiOS/CheckPoint/F5/AVI REST    │
└───────────────────────────────┬───────────────────────────────────────────┘
                                │
┌───────────────────────────────┴───────────────────────────────────────────┐
│  SECRETS PLANE  (consulted on every device session)                        │
│  SecretProvider interface → CyberArkProvider · HashiCorpProvider           │
│  Short-lived creds / signed SSH certs · never persisted · every fetch logged│
└───────────────────────────────┬───────────────────────────────────────────┘
                                │
                    ┌──────────┴───────────┐
                    │  On-prem device fleet │  (mgmt network, Section 6)
                    │  switches/fw/LB       │
                    └───────────────────────┘
```

Two non-negotiable cross-cutting rules:

1. **Vault on every session.** A worker requests a short-lived secret from
   CyberArk/HashiCorp at connect time, uses it for that session only, never
   stores it, and the fetch is audited. Build `SecretProvider` first — it is a
   dependency of literally every other capability.
2. **Normalize at the driver.** Each `DeviceDriver` implements the same ~8
   methods (`backup()`, `get_config()`, `run_check()`, `apply_config()`,
   `poll()`, `health()`, `diff()`, `rollback()`) and returns a **vendor-neutral
   model**, so nothing above the connectivity plane knows or cares whether the
   box is a Catalyst or a FortiGate.

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

**Why one agent per domain (not one mega-agent):** smaller, scoped toolbelts
mean tighter guardrails, clearer audit attribution ("the Change agent did X"),
independent iteration, and the ability to give each agent only the device
permissions it needs. It mirrors how a real NetOps team is staffed.

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

- **LLM runtime — a decision to confirm (Section 8).** Because the gear is
  on-prem and often sensitive, the realistic options are (a) a self-hosted local
  model on the Dell servers for full data isolation, or (b) a hosted frontier
  model via the egress proxy for higher reasoning quality. Recommendation:
  start hosted for reasoning quality during build-out, keep the runtime behind a
  `ModelProvider` interface so it can be swapped for a local model without
  touching agent code, and never send raw secrets/configs to any model that
  isn't approved for that data class.
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
┌──────────────────── Dell server(s) — on-prem ─────────────────────────────┐
│  Container platform: k3s / Kubernetes (or Docker Compose to start)         │
│                                                                            │
│  ┌── Intelligence ──┐  ┌── Platform services ──┐  ┌── Data ──┐            │
│  │ Supervisor       │  │ API gateway           │  │ Postgres  │            │
│  │ 10 specialists   │  │ Job bus (NATS)        │  │ Git/minio │            │
│  │ LLM/Model proxy  │  │ Connectivity workers  │  │ Prometheus│            │
│  │ RAG/vector DB    │  │ SecretProvider svc    │  │ Vector DB │            │
│  └──────────────────┘  └───────────────────────┘  └──────────┘            │
│                                                                            │
│  Vault: HashiCorp Vault (lab/dev → HA) and/or CyberArk Conjur (container)  │
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
| **1 — Vault + connectivity spine** | `SecretProvider` + one `DeviceDriver` (Cisco Catalyst) end-to-end in EVE-NG | Worker fetches creds from Vault, SSHes to a lab Catalyst, pulls config |
| **2 — First capabilities, one vendor** | Backup → Compliance → Health on Catalyst | Drift detection + a passing/failing compliance scan on the lab device |
| **3 — First agents** | Stand up Supervisor + Backup + Compliance + Monitoring agents over the normalized data | An intent routes to a specialist and returns grounded results |
| **4 — Guardrails + change mgmt** | Policy-as-code, approval gate, audit ledger, Change agent | A gated config write executes only after approval, fully audited |
| **5 — Widen vendors** | Add Nexus, SD-WAN by writing only new drivers | Same capabilities pass on 3 switch vendors |
| **6 — Firewalls** | Palo Alto, FTD, Check Point, FortiGate drivers | Capabilities + agents pass on firewalls |
| **7 — Load balancers** | F5, AVI drivers | Full on-prem fleet covered |
| **8 — Troubleshooting + Risk/Governance agents** | RCA loop + risk posture over the full fleet | End-to-end incident flow (Section 3.3) works in the lab |
| **9 — Cloud** | Extend connectivity plane to cloud network constructs | First cloud target onboarded |

Guiding principle: **add a vendor = write one driver**; **add a capability =
extend the agents, not the drivers**. The normalization in the connectivity
plane is what makes both cheap.

---

## 8. Open decisions (need your call before Phase 1)

These don't block the architecture map but will shape Phase 1:

1. **LLM hosting** — self-hosted local model (max data isolation) vs hosted
   frontier model via proxy (max reasoning quality)? Default proposal: hosted
   now, `ModelProvider` abstraction so we can swap later.
2. **Vault** — both CyberArk *and* HashiCorp from day one, or start with one
   (HashiCorp dev is fastest in the lab) and add the second behind the same
   `SecretProvider` interface?
3. **Orchestration framework** — adopt LangGraph (or similar) for the agent
   graph, or a thin in-house orchestrator? Trade-off: ecosystem vs control.
4. **Container platform** — k3s/Kubernetes from the start, or Docker Compose for
   the lab and graduate to k3s for production on the Dells?
5. **First vendor** — confirm Cisco Catalyst as the Phase 1 reference vendor.

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
