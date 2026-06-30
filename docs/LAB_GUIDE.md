# AIOps lab — step-by-step build guide

A single ordered runbook to stand up everything built so far, in a lab. Each
step links to the deeper doc for that piece. Follow the **Minimal path** first
(get one device backed up end-to-end), then layer on CyberArk, AWX, the agent,
and monitoring.

```
EVE-NG host (emulated devices)              Ubuntu VM (the AIOps stack, Docker)
┌─────────────────────────┐   mgmt net    ┌───────────────────────────────────┐
│  cat9k-lab-01 (IOS-XE)   │◀────────────▶│  bus · worker · supervisor         │
│  SSH + SNMP enabled      │   SSH/SNMP    │  conjur · telegraf/prometheus/     │
└─────────────────────────┘               │  grafana · dashboard               │
                                          └───────────────────────────────────┘
```

> Conventions: the reference lab device is **`cat9k-lab-01`** at mgmt IP
> **`10.10.10.11`**. That IP appears in three places that must stay in sync —
> `config/inventory.example.yaml`, `ansible/inventory/lab.yml`, and
> `telemetry/telegraf/telegraf.conf`. Change all three if your device differs.

---

## Phase 0 — Prerequisites

1. **A Dell server** (or any host) running a hypervisor, with two guests:
   - an **EVE-NG** host with a Cisco Catalyst / IOS-XE image (the device), and
   - an **Ubuntu VM** for the AIOps stack.
   See [`docs/setup/UBUNTU_DOCKER_SETUP.md`](setup/UBUNTU_DOCKER_SETUP.md) §0 for VM sizing.
2. A **management network** the Ubuntu VM and the device share (in EVE-NG, a
   `Cloud`/`pnet` bridge). The VM must reach the device's mgmt IP over SSH + SNMP.

---

## Phase 1 — Ubuntu VM + Docker

On the Ubuntu VM, install Docker Engine + Compose:

```bash
# full steps (official apt repo, post-install, verify) are in the setup guide
docker --version && docker compose version && docker run --rm hello-world
```

Reference: [`docs/setup/UBUNTU_DOCKER_SETUP.md`](setup/UBUNTU_DOCKER_SETUP.md) §1–3.

---

## Phase 2 — Get the repo + configure

```bash
sudo mkdir -p /opt/aiops && sudo chown "$USER":"$USER" /opt/aiops
cd /opt/aiops
git clone <your-AIOps-repo-url> .
cp .env.example .env
```

Edit `.env` for the **minimal path** (env credentials, local Ansible execution):

```ini
SECRET_PROVIDER=env
DEVICE_USERNAME=admin
DEVICE_PASSWORD=<device password>
DEVICE_ENABLE=<enable secret, if any>
EXECUTION_BACKEND=local
```

---

## Phase 3 — Bring up the lab device (EVE-NG)

1. Boot the Catalyst node in EVE-NG. Console in and set a mgmt IP on the
   mgmt-network interface (e.g. `10.10.10.11`).
2. Enable management access:
   ```
   hostname cat9k-lab-01
   ip domain-name lab.local
   crypto key generate rsa modulus 2048
   username admin privilege 15 secret <device password>
   line vty 0 4
     login local
     transport input ssh
   snmp-server community public RO
   ```
3. Point `config/inventory.example.yaml`, `ansible/inventory/lab.yml`, and
   `telemetry/telegraf/telegraf.conf` at that IP if it isn't `10.10.10.11`.
4. Verify reachability **from the Ubuntu VM**:
   ```bash
   ping -c2 10.10.10.11
   nc -vz 10.10.10.11 22      # SSH
   ```

---

## Phase 4 — Minimal path: first backup end-to-end

Bring up the job bus and the execution worker, then run a capability:

```bash
docker compose up -d --build bus worker
docker compose logs -f worker      # watch it connect (provider=env, backend=local)
```

In another shell, enqueue jobs (the worker resolves creds from `.env`, runs the
matching Ansible playbook via ansible-runner, and replies):

```bash
pip install nats-py pyyaml
python scripts/enqueue_job.py health     --device cat9k-lab-01
python scripts/enqueue_job.py backup     --device cat9k-lab-01
python scripts/enqueue_job.py compliance --device cat9k-lab-01
```

Success = a `JobResult` with `"ok": true`. The backup is git-versioned in the
`configs` volume. Details: [`services/worker/README.md`](../services/worker/README.md),
[`ansible/README.md`](../ansible/README.md).

### Firewall agent — direct query path (PAN-OS, FortiGate, Check Point, FTD)

Firewalls are owned by the **Firewall specialist agent** and reached *directly
over each vendor's management API* (not CLI scraping). Two ways to use them:

- **Fixed capabilities** (structured): `backup` / `health` / `compliance`, run
  the same way as the switch examples
  (`python scripts/enqueue_job.py health --device pa-fw-lab-01`). PAN-OS runs
  these via Ansible; FortiGate / Check Point / FTD run them **directly over the
  vendor API**. Note: `backup` for Check Point and FTD is an async management
  export and is not implemented — those return an honest "unsupported" (use
  `health` / `compliance` / `firewall_query`); FortiGate `backup` is supported.
- **Free-form `firewall_query`** (direct API, read-only): the agent can run any
  read query — not just the fixed ops. Mutating operations are refused; config
  changes go through change management. The command form is per-vendor:
  - **PAN-OS** (`os: panos`): a CLI op string — `show system info`.
  - **FortiGate** (`os: fortios`): a REST path — `monitor/system/status` (store
    the FortiOS API token as the device password).
  - **Check Point** (`os: checkpoint`): a `show-*` command — `show-gateways-and-servers`.
  - **Cisco FTD** (`os: ftd`): an FDM resource path — `object/networks`.

  Example via the supervisor:

  ```bash
  # the Firewall agent answers, scoped to firewalls only
  curl -s localhost:8088/agents                       # see the specialist roster
  curl -s localhost:8088/agents/firewall/intent \
    -H 'content-type: application/json' \
    -d '{"text":"show me HA state and system info for pa-fw-lab-01"}'
  ```

For a lab PAN-OS VM-series with a self-signed cert, set `FIREWALL_VERIFY_TLS=false`
in `.env`. The supervisor needs `ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL` for the
agent endpoints; the raw `firewall_query` op can also be driven without a key by
the dashboard/`/run` path's siblings.

> **That's the core loop working.** Everything below is optional hardening and
> additional capabilities — add them one at a time.

---

## Phase 5 — CyberArk Conjur (real secrets path)

Replace the shared `env` credential with per-device secrets from CyberArk:

```bash
docker run --rm cyberark/conjur:1.21 data-key generate   # -> .env CONJUR_DATA_KEY
docker compose up -d conjur conjur-db
./infra/conjur/bootstrap.sh                              # account + policy + device creds
```

Put the printed worker key in `.env`, then restart the worker:

```ini
SECRET_PROVIDER=cyberark
CONJUR_API_KEY=<worker key from bootstrap>
```

```bash
docker compose up -d worker
python scripts/enqueue_job.py health --device cat9k-lab-01   # now via CyberArk
```

Reference: [`infra/conjur/README.md`](../infra/conjur/README.md).

---

## Phase 6 — AWX (production execution engine) — optional

The worker runs playbooks via `ansible-runner` in the lab. To use AWX (RBAC,
audit, scheduling, approvals), stand it up and point the worker at it:

```ini
EXECUTION_BACKEND=awx
AWX_URL=https://<vm-ip>:<nodeport>
AWX_TOKEN=<awx token>
AWX_TEMPLATES=backup=<id>,health=<id>,compliance=<id>
```

Full install + job-template setup: [`docs/setup/AWX_SETUP.md`](setup/AWX_SETUP.md).

---

## Phase 7 — The NetOps Supervisor agent

Drive capabilities by natural language. Set the LLM creds in `.env`:

```ini
ANTHROPIC_API_KEY=<your key>
ANTHROPIC_MODEL=<a current Claude model id>   # see docs.claude.com models
```

```bash
docker compose up -d --build supervisor
pip install httpx
python scripts/ask_supervisor.py "is cat9k-lab-01 compliant?"
python scripts/ask_supervisor.py "back up cat9k-lab-01"
```

The agent's tools are read-only plus `propose_change` — it can propose a gated
change but cannot approve or apply it. Reference:
[`services/supervisor/README.md`](../services/supervisor/README.md).

---

## Phase 8 — Change management (gated writes)

Lets an approved change actually reach a device — `propose → policy → risk →
human approve → window → token-gated apply → audit`. Set the shared signing key
(the worker refuses any `apply` without a token signed by it):

```ini
CHANGE_SIGNING_KEY=<openssl rand -hex 32>
REQUIRE_CHANGE_WINDOW=false
```

```bash
docker compose up -d --build change worker
DEV='{"name":"cat9k-lab-01","vendor":"Cisco Catalyst","os":"ios","mgmt_host":"10.10.10.11"}'

# 1) propose (agent or curl) — runs policy + risk, returns a change id
cid=$(curl -s localhost:8089/changes -H 'content-type: application/json' \
  -d "{\"device\":$DEV,\"intent\":\"enable HTTPS server\",\"config\":[\"ip http secure-server\"],\"requested_by\":\"you\"}" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')

# 2) human approves
curl -s localhost:8089/changes/$cid/approve -H 'content-type: application/json' -d '{"approver":"you"}'

# 3) apply — change service signs a token; worker verifies it and runs apply_config.yml
curl -s localhost:8089/changes/$cid/apply

# audit trail
curl -s localhost:8089/changes/$cid | python3 -m json.tool
```

A change whose config trips a policy rule (e.g. `no aaa new-model`) is created
**rejected** and can never be approved. Reference:
[`services/change/README.md`](../services/change/README.md).

> Lab-grade: the change store + audit ledger are in-memory; move them to durable,
> append-only storage before production.

---

## Phase 9 — Monitoring (telemetry stack + dashboard)

Continuous SNMP + synthetic telemetry (off Ansible) → Grafana → dashboard:

```ini
SNMP_COMMUNITY=public
GRAFANA_ADMIN_PASSWORD=<choose one>
VITE_GRAFANA_URL=http://<vm-ip>:3000
```

```bash
docker compose up -d --build telegraf prometheus grafana dashboard
```

- Grafana → `http://<vm-ip>:3000` (admin / `GRAFANA_ADMIN_PASSWORD`) → **NetOps Overview**
- Prometheus → `http://<vm-ip>:9090`
- AetherNetOps dashboard → `http://<vm-ip>:8081` → **Monitoring** view shows the
  embedded Grafana panels.

References: [`telemetry/README.md`](../telemetry/README.md), [`dashboard/README.md`](../dashboard/README.md).

---

## The whole stack at once

Once `.env` is filled in, the entire lab comes up with:

```bash
docker compose up -d --build
docker compose ps
```

### Service / port map

| Service | Host port | Purpose |
|---------|-----------|---------|
| dashboard | 8081 | AetherNetOps UI (Monitoring embeds Grafana) |
| supervisor | 8088 | Agent API (`POST /intent`) |
| change | 8089 | Change-management API (propose/approve/apply) |
| results | 8090 | Job-results store (`GET /results`, `/results/latest`) |
| grafana | 3000 | Dashboards |
| prometheus | 9090 | Metrics store |
| conjur | 8080 | CyberArk Conjur |
| bus (NATS) | 4222 | Job bus |
| worker | — | Runs Ansible playbooks (no published port) |
| telegraf | — | SNMP + synthetic collector |

---

## Verification checklist

- [ ] VM reaches the device mgmt IP over SSH (22) and SNMP (161/udp)
- [ ] `enqueue_job.py health` returns `ok: true`
- [ ] `enqueue_job.py backup` versions a config in the `configs` volume
- [ ] (Conjur) worker logs show `credentials.fetched` from Conjur, not the env provider
- [ ] (Agent) `ask_supervisor.py` returns a grounded answer that ran a real job
- [ ] Grafana **NetOps Overview** shows interface + reachability data
- [ ] Dashboard Monitoring view renders the embedded Grafana panels

## Troubleshooting

- **Worker can't reach the device** — check the VM's mgmt NIC is on the device
  network; `nc -vz <ip> 22`. In EVE-NG, confirm the `Cloud`/`pnet` bridge.
- **Ansible collection not found** — the worker image bakes collections in; if
  running playbooks by hand, `export ANSIBLE_COLLECTIONS_PATH=$PWD/collections`
  (see `ansible/README.md`).
- **Conjur bootstrap can't get the admin key** — ensure `conjur` is up
  (`docker compose ps conjur`) and `CONJUR_DATA_KEY` is set before bootstrapping.
- **Grafana panels blank in the dashboard** — the dashboard inlines
  `VITE_GRAFANA_URL` at **build** time; rebuild after changing it
  (`docker compose up -d --build dashboard`). Confirm Grafana is reachable at
  that URL and embedding is enabled (it is, in `telemetry/grafana/grafana.ini`).
- **Supervisor won't start** — set `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`;
  the agent refuses to start without a model id.
