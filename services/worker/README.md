# AIOps execution worker

The lab-side execution service: it resolves device credentials from a
**SecretProvider** (CyberArk Conjur) and runs the **Ansible** playbooks under
[`../../ansible/`](../../ansible/) via **ansible-runner** — the same playbooks
AWX runs in production. It serves capability jobs off the **NATS** bus.

> Execution engine = Ansible (decision #6), run by AWX in production and by
> `ansible-runner` here in the lab. The old NAPALM `DeviceDriver` is retired.

## Layout

```
aiops_worker/
  models.py            # vendor-neutral domain models (Device, Job*, creds)
  config.py            # env/.env settings
  secrets/             # SecretProvider: base + cyberark (Conjur) + env (lab)
  execution/           # ExecutionBackend: base (op->playbook, inventory/extravars)
                       #   + local_runner (ansible-runner) + awx (job templates)
  handlers.py          # JobRequest -> creds -> backend.run -> JobResult
  bus.py               # NATS subscribe/reply loop
  __main__.py          # entrypoint
tests/                 # Ansible-free unit tests
```

## How a job flows

1. A `JobRequest{op, device, params}` arrives on `aiops.jobs.<op>`.
2. The worker fetches the device's creds from CyberArk (its `SecretProvider`).
3. The configured **ExecutionBackend** runs the capability:
   - `local` → `ansible-runner` runs `playbooks/<op>.yml` with a one-host
     inventory (group = device OS) and the creds injected as extravars.
   - `awx` → launches the mapped AWX job template and polls it to completion.
4. The reply is a `JobResult` with the playbook/job status + stdout.

Capabilities (`op` → playbook): `backup` / `get_config` → `backup.yml`,
`health` → `health.yml`, `compliance` → `compliance.yml`.

## Run it (from the repo root)

```bash
cp .env.example .env          # set DEVICE_USERNAME / DEVICE_PASSWORD for first run
docker compose up -d --build bus worker
docker compose logs -f worker

pip install nats-py pyyaml    # client deps for the test script
python scripts/enqueue_job.py backup     --device cat9k-lab-01
python scripts/enqueue_job.py compliance --device cat9k-lab-01
```

First run uses `SECRET_PROVIDER=env` and `EXECUTION_BACKEND=local` — works
against an EVE-NG Catalyst with no Conjur and no AWX. Point
`config/inventory.example.yaml` at your lab device first.

## Switch to CyberArk Conjur

One command, via [`../../infra/conjur/`](../../infra/conjur/):

```bash
docker run --rm cyberark/conjur:1.21 data-key generate   # -> .env CONJUR_DATA_KEY
docker compose up -d conjur conjur-db
./infra/conjur/bootstrap.sh                              # account + policy + creds
docker compose up -d worker                              # SECRET_PROVIDER=cyberark
```

See [`infra/conjur/README.md`](../../infra/conjur/README.md) for the policy
layout and how to add more devices.

## Switch to AWX (production engine)

Stand up AWX, create the job templates, then set `EXECUTION_BACKEND=awx` and the
`AWX_*` vars in `.env`. See [`../../docs/setup/AWX_SETUP.md`](../../docs/setup/AWX_SETUP.md).

## Tests

```bash
cd services/worker
pip install pydantic pydantic-settings structlog pytest
python -m pytest
```

Tests need no Ansible/AWX — they cover the op→playbook map, inventory/extravars
building, and the AWX template-map parsing.
