# AetherNetOps Dashboard

The AetherNetOps NetOps dashboard — a React + Vite + TypeScript single-page app
that presents a multi-vendor, AI-assisted network operations console (overview,
inventory, topology, monitoring, compliance, backup, change management, and an
agent view).

## Develop locally

```bash
npm install
npm run dev
```

Vite serves the app on http://localhost:5173 by default. The build command is
`npm run build` (runs `tsc -b` then `vite build`, output in `dist/`).

## Live Grafana telemetry

The **Monitoring** view embeds live Grafana panels at the top of the page under
"Live telemetry (Grafana)". Each panel is rendered as a Grafana `d-solo` iframe
pointing at the Grafana dashboard with uid **`netops-overview`**:

| Panel | Title                 | Grafana panelId |
| ----- | --------------------- | --------------- |
| 1     | Interface throughput  | `1`             |
| 2     | Interface status      | `2`             |
| 3     | Reachability          | `3`             |

The Grafana base URL is read from the build-time env var **`VITE_GRAFANA_URL`**
(see `.env.example`). Copy it to `.env` and point it at your Grafana instance:

```bash
cp .env.example .env
# VITE_GRAFANA_URL=http://localhost:3000
```

If `VITE_GRAFANA_URL` is empty or unset, each panel renders a small
"Grafana is not configured" placeholder instead of a broken iframe, and the
existing mock SNMP charts below remain the fallback view.

Grafana must allow anonymous viewing and iframe embedding (`allow_embedding`);
the repo's Grafana configuration already enables both.

> Note: Vite inlines `VITE_*` variables **at build time**, so the value must be
> present when `npm run build` (or the Docker build) runs — not at container
> runtime.

## Container

A multi-stage `Dockerfile` builds the app and serves it with nginx:

1. `node:20-alpine` runs `npm ci && npm run build`.
2. `nginx:1.27-alpine` serves the static `dist/` on port **80** with an SPA
   fallback (`nginx.conf`).

Build, passing the Grafana URL through the build arg:

```bash
docker build \
  --build-arg VITE_GRAFANA_URL=http://localhost:3000 \
  -t aethernetops-dashboard .

docker run --rm -p 8080:80 aethernetops-dashboard
```

Then open http://localhost:8080.
