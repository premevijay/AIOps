# AWX setup — the production execution control plane

AWX is the **engine** that runs the Ansible playbooks under [`ansible/`](../../ansible/)
(decision: AWX, open-source). It gives the agent team RBAC, audit, scheduling,
an approval workflow (= change management), inventory, and credential injection
(Machine credential + CyberArk Conjur plugin) — so the agents just **launch job
templates** instead of running Ansible themselves.

> Lab vs production: in the lab the worker runs the same playbooks via
> `ansible-runner` (`EXECUTION_BACKEND=local`) — no AWX required. Stand up AWX
> when you want the control plane, then set `EXECUTION_BACKEND=awx`.

## 1. Install AWX on the Ubuntu VM

AWX is Kubernetes-native (the old docker-compose install is unsupported). On a
single Ubuntu VM the simplest path is **k3s + the AWX Operator**:

```bash
# lightweight k8s
curl -sfL https://get.k3s.io | sh -
sudo k3s kubectl get nodes               # Ready

# AWX Operator (pin to a current release tag)
kubectl apply -k "github.com/ansible/awx-operator/config/default?ref=2.19.1"
```

Then create an `AWX` custom resource (a minimal `awx-demo.yaml` with a
`NodePort`/`Ingress` service), apply it, and wait for the operator to reconcile:

```bash
kubectl apply -f awx-demo.yaml
kubectl get pods -n awx -w                # wait for awx-* Running
kubectl get svc  -n awx                   # note the NodePort for the UI
```

Get the admin password:

```bash
kubectl get secret awx-demo-admin-password -n awx -o jsonpath='{.data.password}' | base64 -d; echo
```

(For a Red Hat-supported install, use Ansible Automation Platform instead — same
objects below apply.)

## 2. Configure the AWX objects

In the AWX UI (or via the API / `awx` CLI / the `awx.awx` collection):

1. **Project** → source control, this repo, **playbook directory `ansible/`**.
   AWX installs `ansible/collections/requirements.yml` automatically.
2. **Inventory** → import `ansible/inventory/lab.yml` (or a dynamic source).
3. **Credentials:**
   - a **Machine** credential for device login, **or**
   - a **CyberArk Conjur** credential (Conjur as an external secret source) so
     AWX injects per-device secrets at job time — the production secrets path.
4. **Job Templates** — one per capability, each pointing at a playbook:
   | Template name      | Playbook                      |
   |--------------------|-------------------------------|
   | `aiops-backup`     | `playbooks/backup.yml`        |
   | `aiops-health`     | `playbooks/health.yml`        |
   | `aiops-compliance` | `playbooks/compliance.yml`    |
   Enable **Prompt on launch** for `limit` and `extra_vars` so a run can target
   one device. Add an **approval node** in a workflow for change-class templates.

## 3. Point the worker (or agents) at AWX

Create an AWX **token** (User → Tokens) and note each template's numeric id, then:

```ini
# .env
EXECUTION_BACKEND=awx
AWX_URL=https://<vm-ip>:<nodeport>
AWX_TOKEN=<personal access token>
AWX_TEMPLATES=backup=<id>,health=<id>,compliance=<id>
```

```bash
docker compose up -d worker
python scripts/enqueue_job.py backup --device cat9k-lab-01
```

The worker's `AwxBackend` launches the mapped job template (`limit=<device>`),
polls the job to completion, and returns its status + stdout. The same call an
agent will make directly once the LangGraph supervisor is wired in.

## How this maps to the capabilities

- **Change management / approvals** → AWX workflow approval nodes + RBAC.
- **Audit** → AWX job history (who ran what, when, against which hosts, full stdout).
- **Scheduling** → AWX schedules (nightly backups, periodic compliance scans).
- **Secrets** → AWX CyberArk Conjur credential plugin (no creds in playbooks).

Streaming monitoring (SNMP/synthetic) is **not** an AWX job — it stays on the
telemetry stack (Telegraf → Prometheus).
