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
  store.py        # in-memory change + audit store (lab-grade; see caveat)
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

## Caveat: storage is lab-grade

`InMemoryChangeStore` is ephemeral and process-local. A production deployment
**must** use durable storage (Postgres / object store). The audit ledger in
particular must be durable, append-only, and tamper-evident — it is the record of
who approved what, and losing or mutating it defeats the point of an approval
authority.
