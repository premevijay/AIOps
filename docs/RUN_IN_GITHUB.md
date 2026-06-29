# Running & viewing the platform in GitHub

Two ways to run this without a local machine.

## 1. Codespaces — a live app URL in your browser

A devcontainer (`.devcontainer/devcontainer.json`) gives you a Linux VM with
Docker, Python 3.12 and Node 20, **auto-builds and starts the core stack**, and
forwards the service ports. This is the quickest way to get a working URL.

1. On the repo: **Code ▸ Codespaces ▸ Create codespace** (on your branch).
2. Wait for the build (first boot is a few minutes). When it finishes, the
   devcontainer brings up `bus`, `state-db`, `worker`, `change`, `results` and
   `dashboard`, and the **Dashboard tab opens automatically**.

### Your app URL

The dashboard is forwarded on **port 8081**. The URL looks like:

```
https://<your-codespace-name>-8081.app.github.dev
```

Find/copy it in the **Ports** tab (the 🌐 next to port 8081). By default a
forwarded port is **private to you**. To share it, right-click port 8081 ▸
**Port Visibility ▸ Public** — then anyone with the link can open it.

| Port | Service | Auto-started |
|------|---------|--------------|
| 8081 | Dashboard (AetherNetOps UI) — opens automatically | ✅ |
| 8089 | Change-management API | ✅ |
| 8090 | Results store API (`/results`, `/results/latest`) | ✅ |
| 8088 | Supervisor agent API (`POST /intent`, `GET /devices`) | needs keys (below) |
| 3000 | Grafana | start manually |
| 9090 | Prometheus | start manually |

### Light up the agent + inventory + monitoring views (optional)

The supervisor isn't auto-started because it needs an LLM key. To enable the
**AI Troubleshooting** and **Inventory** views:

```bash
# add to .env, then start the supervisor
#   ANTHROPIC_API_KEY=sk-...
#   ANTHROPIC_MODEL=<a current Claude model id>
#   CHANGE_SIGNING_KEY=$(openssl rand -hex 32)
docker compose up -d supervisor
```

For the **Monitoring** view (embedded Grafana): `docker compose up -d grafana`.

Device jobs (backup/health/compliance/apply) need reachable lab gear — point
`config/inventory.yaml` and the `DEVICE_*` creds at devices the codespace can
reach (e.g. a VPN-exposed EVE-NG lab). The dashboard, change and results APIs
work without any devices.

> **Heads-up:** a Codespace URL is **ephemeral** — it serves only while the
> Codespace is running and stops when it's idled/deleted. For an always-on URL,
> deploy the stack to a host (Render / Fly.io / a VM) and point a domain at the
> dashboard container.

## 2. GitHub Actions — automated checks + screenshots

`.github/workflows/ci.yml` runs on every push and pull request:

- **tests** — unit tests for the `worker`, `change`, and `results` services.
- **compose-validate** — `docker compose config` over the full stack.
- **dashboard-build** — typecheck + production build of the dashboard.
- **screenshots** — stands the core stack up, seeds a sample change, and
  captures every dashboard view with headless Chromium.

To **view** a run: open the **Actions** tab ▸ the run ▸ download the
**`dashboard-screenshots`** artifact. It contains a PNG per view
(overview, topology, inventory, backup, compliance, health, agent, change
management). This is the "see it running" path that doesn't need a live UI.
