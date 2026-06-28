# AIOps connectivity worker (Phase 1 spine)

The first real backend service: it resolves device credentials from a
**SecretProvider** (CyberArk Conjur), connects through a vendor **DeviceDriver**
(Cisco Catalyst / IOS-XE first), and serves read jobs off the **NATS** bus.

It implements decisions #2 (CyberArk first), #4 (Docker on Ubuntu), and #5
(Catalyst first) from
[`../../docs/architecture/AGENT_TEAM_ARCHITECTURE.md`](../../docs/architecture/AGENT_TEAM_ARCHITECTURE.md).

## Layout

```
aiops_worker/
  models.py            # vendor-neutral domain models
  config.py            # env/.env settings
  secrets/             # SecretProvider: base + cyberark (Conjur) + env (lab)
  drivers/             # DeviceDriver: base (+ write-gating) + catalyst + registry
  handlers.py          # JobRequest -> driver call -> JobResult
  bus.py               # NATS subscribe/reply loop
  __main__.py          # entrypoint
tests/                 # network-free unit tests
```

## Design rules enforced here

- **Read freely, writes gated.** `get_config` / `backup` / `health` run
  autonomously. `apply_config` / `rollback` raise `WriteGatedError` until the
  Phase 4 change-management approval path exists.
- **Vendor-neutral above the driver.** Drivers map into `models.py` types; the
  bus/handlers never see vendor specifics. New vendor = one class in
  `drivers/registry.py`.
- **Secrets never persisted.** The Conjur token lives only for one credential
  fetch; nothing is written to disk.

## Run it (from the repo root)

```bash
cp .env.example .env          # set DEVICE_USERNAME / DEVICE_PASSWORD for first run
docker compose up -d --build bus worker
docker compose logs -f worker
```

First run uses `SECRET_PROVIDER=env` (one shared lab credential), so you can pull
from an EVE-NG Catalyst before Conjur is set up. Point
`config/inventory.example.yaml` at your lab device, then:

```bash
pip install nats-py pyyaml          # client deps for the test script
python scripts/enqueue_job.py health  --device cat9k-lab-01
python scripts/enqueue_job.py backup  --device cat9k-lab-01
```

## Switch to CyberArk Conjur

One command, via the bootstrap in [`../../infra/conjur/`](../../infra/conjur/):

```bash
docker run --rm cyberark/conjur:1.21 data-key generate   # -> .env CONJUR_DATA_KEY
docker compose up -d conjur conjur-db
./infra/conjur/bootstrap.sh                              # account + policy + creds
# put the printed worker key in .env (SECRET_PROVIDER=cyberark, CONJUR_API_KEY=...)
docker compose up -d worker
```

See [`infra/conjur/README.md`](../../infra/conjur/README.md) for the policy
layout and how to add more devices.

## Tests

```bash
cd services/worker
pip install -r requirements.txt pytest
python -m pytest
```

The unit tests need no network — they cover the driver registry, the pure
config `diff`, and write-gating.
