# AIOps Results Store

Persists every worker job result so the dashboard can read the **latest
per-device-per-op outcome**. It is a NATS subscriber + Postgres store + a small
FastAPI read API. The worker fans out results; this service stores them; the
dashboard's Compliance/Backup/Health tiles read them back.

```
worker ──(fanout aiops.results)──▶ results store ──(/results/latest)──▶ dashboard tiles
```

## The wire contract

The worker publishes every job result as JSON to NATS subject **`aiops.results`**
(fanout, no reply). The payload is a `JobResult`:

```json
{"op": "compliance", "device_name": "cat9k-lab-01", "ok": true,
 "data": {"compliant": false, "violations": ["..."]}, "error": null, "duration_ms": 42}
```

- `op` is one of: `backup`, `get_config`, `health`, `compliance`, `apply`.
- `data` carries backend-specific result (playbook status/stdout_lines/stats, or
  AWX job id/status/stdout). It may be `null` on failure (then `error` is set).

The subscriber subscribes with queue group `results-store`, so multiple replicas
share the stream and each result is stored once. Each result is normalized into a
`ResultRecord` with a short `status` (`ok` | `failed` | `changed` | `drift` |
`compliant` | `non-compliant`) and a one-line `summary`. The record `id` is a
content hash of `device|op|ts`, so a duplicate publish is idempotent.

## Endpoints

| Method | Path              | Purpose                                            |
|--------|-------------------|----------------------------------------------------|
| GET    | `/healthz`        | liveness                                            |
| GET    | `/results`        | newest-first records (query: `device`, `op`, `limit=100`) |
| GET    | `/results/latest` | the most recent record per device+op (dashboard tiles) |

`ResultRecord` shape:

```json
{"id":"<hash>","device":"cat9k-lab-01","op":"compliance","ok":true,
 "status":"non-compliant","summary":"1 failure(s)","detail":{...},"ts":"<iso>"}
```

## Environment

| Var               | Default              | Purpose                              |
|-------------------|----------------------|--------------------------------------|
| `NATS_URL`        | `nats://bus:4222`    | bus to subscribe on                  |
| `RESULTS_SUBJECT` | `aiops.results`      | subject the worker fans out on       |
| `RESULTS_STORE`   | `memory`             | `memory` or `postgres`               |
| `RESULTS_DB_URL`  | _(empty)_            | libpq URL when `RESULTS_STORE=postgres` |
| `HOST` / `PORT`   | `0.0.0.0` / `8090`   | API bind                             |
| `LOG_LEVEL`       | `INFO`               | log level                            |

## Storage

Two backends, selected by `RESULTS_STORE`:

- **`memory`** (default) — `InMemoryResultStore`, ephemeral and process-local.
  Fine for dev and tests; nothing survives a restart.
- **`postgres`** — `PostgresResultStore` (set `RESULTS_STORE=postgres` and a
  libpq `RESULTS_DB_URL`). The durable path: a single `results` table, inserts
  idempotent on the content-hash `id` (`ON CONFLICT DO NOTHING`), and `latest()`
  pulls the newest row per `(device, op)` via `DISTINCT ON`. Needs
  `psycopg2-binary` (in requirements.txt; imported lazily so memory-mode and the
  tests don't need it).

## Tests

```bash
cd services/results
pip install pydantic pydantic-settings structlog pytest fastapi
python -m pytest
```

Tests need no NATS, uvicorn, or database — they cover the pure `to_record`
normalization (one assertion per op) and the in-memory store's `recent`/`latest`
ordering and filtering, all driven with explicit timestamp strings.
```
results_service/
  config.py          # env/.env settings (RESULTS_STORE, RESULTS_DB_URL, RESULTS_SUBJECT)
  models.py          # ResultRecord
  extract.py         # to_record(job_result, ts) — pure normalization, no IO
  store.py           # in-memory store (dev default) + build_store() factory
  store_postgres.py  # durable Postgres store
  subscriber.py      # NATS subscriber (aiops.results -> store)
  app.py             # FastAPI read API
  __main__.py        # uvicorn entrypoint
tests/               # NATS/uvicorn/DB-free unit tests
```
