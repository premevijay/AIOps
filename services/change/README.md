# AIOps Change Management

The **human-approval authority** for device-mutating changes (Phase 4). It is the
only path by which a config change reaches the execution worker. The supervisor
agent can *propose* a change but never apply one; this service owns the gate
between "proposed" and "touched a device".

## The flow

```
propose ─▶ policy-as-code ─▶ risk score ─▶ human approve/reject ─▶ change-window ─▶ token-gated apply ─▶ audit
            (deny rules)      (0-100)        (the gate)             (maintenance)    (HMAC -> worker)   (ledger)
```

A change is created, evaluated against policy and risk, and parked `proposed`
(or immediately `rejected` if policy denies it). A human approves or rejects it.
On apply, the service checks the change window, signs an HMAC approval token, and
dispatches the apply job to the worker over NATS. Every transition appends to an
append-only audit trail.

## The HMAC gate

Apply is cryptographically gated. On approve+apply the service signs:

```
token = HMAC-SHA256(CHANGE_SIGNING_KEY, change_id).hexdigest()
```

and sends it to the worker on `aiops.jobs.apply`. The worker recomputes the token
from the **same** `CHANGE_SIGNING_KEY` and **refuses the apply** unless it matches.
So a forged or tokenless apply request cannot mutate a device, even if it reaches
the bus — approval is enforced cryptographically, not just by API convention.

Wire contract (the worker matches this exactly):

```json
{"op":"apply","device":{...},"params":{"change_id":"<id>","approval_token":"<hex>","config":["line1","line2"]}}
```

## Endpoints

| Method | Path                       | Purpose                                   |
|--------|----------------------------|-------------------------------------------|
| GET    | `/healthz`                 | liveness                                  |
| POST   | `/changes`                 | propose a change (body: device, intent, config, requested_by, window?) |
| GET    | `/changes`                 | list changes                              |
| GET    | `/changes/{id}`            | get one change (404 if missing)           |
| POST   | `/changes/{id}/approve`    | human approve (body: approver)            |
| POST   | `/changes/{id}/reject`     | human reject (body: approver, reason)     |
| POST   | `/changes/{id}/apply`      | token-gated apply via the worker          |
| GET    | `/audit`                   | flattened audit ledger (query: change_id, actor, action, limit) |
| GET    | `/risk/posture`            | risk/governance rollup across all changes |

`GET /audit` returns a newest-first list of ledger rows:

```json
[{"change_id":"<id>","device":"cat9k-lab-01","intent":"add description",
  "ts":"<iso>","actor":"bob","action":"approved","detail":""}]
```

`GET /risk/posture` returns:

```json
{"total": 3,
 "by_status": {"proposed":1,"approved":0,"rejected":1,"applied":1,"failed":0},
 "by_risk_level": {"low":2,"medium":0,"high":1,"critical":0},
 "open_high_risk": [{"id":"<id>","device":"core-sw","intent":"...","level":"high","score":70}],
 "recent_denied": [{"id":"<id>","device":"sw","intent":"...","violations":["..."]}]}
```

Invalid transitions (e.g. approving a policy-denied or already-approved change,
applying outside the change window) return `400`.

## Layout

```
change_service/
  config.py       # env/.env settings (CHANGE_SIGNING_KEY, REQUIRE_CHANGE_WINDOW)
  models.py       # pydantic models (ChangeRequest, RiskResult, PolicyResult, ...)
  policy.py       # policy-as-code engine (pure, no IO)
  risk.py         # heuristic risk scorer (pure)
  window.py       # change-window check (pure; now is passed in)
  signing.py      # HMAC approval tokens (sign/verify) — matches the worker
  store.py        # in-memory store (dev default) + build_store() factory
  store_postgres.py # durable Postgres store + append-only change_audit ledger
  audit.py        # flatten_ledger() — pure audit read view
  governance.py   # risk_posture() — pure risk/governance rollup
  service.py      # the propose->approve->apply state machine
  bus_client.py   # NATS request/reply to the worker (aiops.jobs.apply)
  app.py          # FastAPI surface
  __main__.py     # uvicorn entrypoint
tests/            # NATS/uvicorn-free unit tests
```

## Run it (from the repo root)

```bash
# .env: set CHANGE_SIGNING_KEY (shared with the worker)
docker compose up -d --build bus worker change
```

## Tests

```bash
cd services/change
pip install pydantic pydantic-settings structlog pytest
python -m pytest
```

Tests need no NATS, uvicorn, or FastAPI — they cover the policy rules, risk
levels, the window check, the signing roundtrip, and the service state machine
driven against an in-memory store and a fake bus.

## Storage

Two backends, selected by `CHANGE_STORE`:

- **`memory`** (default) — `InMemoryChangeStore`, ephemeral and process-local.
  Fine for dev and tests; nothing survives a restart.
- **`postgres`** — `PostgresChangeStore` (set `CHANGE_STORE=postgres` and a libpq
  `CHANGE_DB_URL`). The durable path. It upserts the full change document to a
  `changes` table and writes every audit entry to an **append-only**
  `change_audit` ledger (`UNIQUE(change_id, audit_index)`, insert-only — rows are
  never updated or deleted). That ledger is the durable, tamper-evident record of
  who approved what, which is the whole point of an approval authority. Needs
  `psycopg2-binary` (in requirements.txt).

`build_store()` picks the backend from config; the store contract is just
`put(change)` / `get(id)` / `list()`. Each transition mutates the change and the
service persists it with a single `put`.
