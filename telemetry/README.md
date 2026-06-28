# Telemetry stack — the monitoring capability

Monitoring is **off Ansible** by design: it is continuous/streaming telemetry,
not task-based device automation. This stack is the SNMP + synthetic monitoring
path from the architecture.

```
devices ──SNMP/ICMP/HTTP──▶ Telegraf ──/metrics──▶ Prometheus ──▶ Grafana
                                                                    │
                                                          embedded (d-solo iframes)
                                                                    ▼
                                                   AetherNetOps dashboard (Monitoring view)
```

## Components

| Service | Role |
|---------|------|
| `telegraf` | Polls device SNMP (IF-MIB throughput + oper status, sysName/uptime) and runs synthetic probes (ICMP ping, HTTP). Exposes Prometheus metrics on `:9273`. |
| `prometheus` | Scrapes Telegraf every 30s; the time-series store (`:9090`). |
| `grafana` | Dashboards over Prometheus (`:3000`). Pre-provisioned datasource + the **NetOps Overview** dashboard (uid `netops-overview`), configured for embedding. |

## Files

```
telegraf/telegraf.conf                         # SNMP + synthetic inputs, Prometheus output
prometheus/prometheus.yml                      # scrape config
grafana/grafana.ini                            # embedding + anonymous viewer
grafana/provisioning/datasources/prometheus.yml
grafana/provisioning/dashboards/dashboards.yml
grafana/dashboards/netops-overview.json        # panels 1 throughput · 2 status · 3 reachability
```

## Run it (from the repo root)

```bash
# .env: set SNMP_COMMUNITY (and GRAFANA_ADMIN_PASSWORD)
docker compose up -d telegraf prometheus grafana
open http://localhost:3000        # admin / $GRAFANA_ADMIN_PASSWORD → "NetOps Overview"
open http://localhost:9090        # Prometheus
```

Point `telegraf/telegraf.conf` at your EVE-NG/lab device IPs (keep them in sync
with `config/inventory.yaml`) and enable SNMP on those devices.

## Dashboard integration

The AetherNetOps dashboard (`../dashboard/`) embeds these Grafana panels in its
Monitoring view via **d-solo** iframes, driven by `VITE_GRAFANA_URL`. Embedding
works because `grafana.ini` sets `allow_embedding = true` and an anonymous Viewer
role. Lock that down (signed embeds / auth proxy) before exposing Grafana
outside the lab.

## Adding a device

Copy the `[[inputs.snmp]] agents` entry (and the `ping` / `http_response`
targets) in `telegraf.conf` for the new device's mgmt IP. Prometheus and Grafana
pick up the new series automatically.
