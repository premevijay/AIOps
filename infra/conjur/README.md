# CyberArk Conjur bootstrap

Makes the CyberArk secrets path **one command**. After this runs, the worker can
flip from the lab `env` provider to real per-device secrets from Conjur.

## Files

- `policy/aiops.yml` — the Conjur policy: the worker identity
  (`host aiops/aiops-worker`), the device-secret tree
  (`aiops/lab/<device>/{username,password,enable}`), and a readers group that
  grants the worker `read`/`execute` on those secrets.
- `bootstrap.sh` — drives account creation, policy load, worker-key capture, and
  loads the lab device's credentials from `.env`.

## Run it (on the Ubuntu VM, from the repo root)

```bash
# 0. one-time data key for Conjur itself, into .env as CONJUR_DATA_KEY
docker run --rm cyberark/conjur:1.21 data-key generate

# 1. bring up Conjur
docker compose up -d conjur conjur-db

# 2. bootstrap (creates account, loads policy, sets the lab device's creds)
./infra/conjur/bootstrap.sh
```

The script prints the worker API key (also saved to the git-ignored
`infra/conjur/.worker-api-key`). Put it in `.env`:

```ini
SECRET_PROVIDER=cyberark
CONJUR_API_KEY=<worker key>
```

Then restart the worker and test:

```bash
docker compose up -d worker
python scripts/enqueue_job.py health --device cat9k-lab-01
```

## Add another device

1. In `policy/aiops.yml`, copy the three `!variable <name>/...` lines (under the
   `lab` policy) and the three `!permit` resources for the new device name.
2. Re-run `./infra/conjur/bootstrap.sh` to load the updated policy, then set the
   new device's values:

```bash
docker compose run --rm --no-deps --entrypoint /bin/sh conjur-cli -c '
  conjur init -u http://conjur:80 -a default --force
  conjur login -i admin -p "<admin key>"
  conjur variable set -i aiops/lab/<name>/username -v "<user>"
  conjur variable set -i aiops/lab/<name>/password -v "<pass>"
'
```

## Notes / limitations

- Lab-oriented: secrets are passed to an ephemeral CLI container on the command
  line. Fine for the EVE-NG lab; production should inject secrets through a
  proper pipeline (and Conjur over HTTPS, not the `http://conjur:80` lab URL).
- The script is idempotent — re-running reloads the policy (a no-op) and rotates
  the worker key (re-saved to the key file; update `.env` if you re-run).
