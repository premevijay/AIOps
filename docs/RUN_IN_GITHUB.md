# Running & viewing the platform in GitHub

Two ways to run this without a local machine.

## 1. Codespaces — view it live in your browser

A devcontainer (`.devcontainer/devcontainer.json`) gives you a Linux VM with
Docker, Python 3.12 and Node 20, and auto-forwards the service ports.

1. On the repo: **Code ▸ Codespaces ▸ Create codespace** (on your branch).
2. When it opens, the `.env` is created from `.env.example`. To exercise the
   agent, set real values in `.env`:
   - `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` (supervisor won't boot without a
     model id).
   - `CHANGE_SIGNING_KEY` — `openssl rand -hex 32`.
3. Bring the stack up:
   ```bash
   docker compose up -d --build
   ```
4. Open the forwarded ports (the **Ports** tab):

   | Port | Service |
   |------|---------|
   | 8081 | Dashboard (AetherNetOps UI) — opens automatically |
   | 8088 | Supervisor agent API (`POST /intent`, `GET /devices`) |
   | 8089 | Change-management API |
   | 8090 | Results store API (`/results`, `/results/latest`) |
   | 3000 | Grafana |
   | 9090 | Prometheus |

Device jobs (backup/health/compliance/apply) need reachable lab gear — point
`config/inventory.yaml` and the `DEVICE_*` creds at devices the codespace can
reach (e.g. a VPN-exposed EVE-NG lab). The dashboard, change/results APIs, and
inventory view work without any devices.

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
