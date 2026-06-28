#!/usr/bin/env bash
#
# Bootstrap CyberArk Conjur for AIOps — turns the manual checklist into one
# command. Run from the repo ROOT, after the Conjur containers are up:
#
#   docker compose up -d conjur conjur-db
#   ./infra/conjur/bootstrap.sh
#
# What it does:
#   1. ensure the Conjur account exists and fetch the admin API key
#   2. load infra/conjur/policy/aiops.yml under the root policy
#   3. capture the worker host API key  -> infra/conjur/.worker-api-key (git-ignored)
#   4. load the lab device's credentials from .env (DEVICE_USERNAME/PASSWORD/ENABLE)
#
# Then set in .env:  SECRET_PROVIDER=cyberark  and  CONJUR_API_KEY=<worker key>
# and restart the worker:  docker compose up -d worker
#
# Idempotent: safe to re-run (re-loading policy is a no-op; the worker key is
# rotated on re-run and re-saved).
#
# NOTE: this drives a live Conjur and must be run on the host where the stack
# runs (the Ubuntu VM). Secrets are passed to an ephemeral CLI container; fine
# for the lab, not a substitute for a production secrets-injection pipeline.

set -euo pipefail

ACCOUNT="${CONJUR_ACCOUNT:-default}"
WORKER_HOST="aiops/aiops-worker"
LAB_DEVICE="cat9k-lab-01"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKER_KEY_FILE="$HERE/.worker-api-key"

# Pull DEVICE_* defaults from .env if present.
if [ -f .env ]; then set -a; . ./.env; set +a; fi

dc() { docker compose "$@"; }

# Run a sequence of conjur CLI commands inside an ephemeral, logged-in CLI
# container on the compose network. Args: the shell snippet to run after login.
cli() {
  dc run --rm --no-deps -T --entrypoint /bin/sh conjur-cli -c "
    set -e
    conjur init -u http://conjur:80 -a '$ACCOUNT' --force >/dev/null 2>&1
    conjur login -i admin -p '$ADMIN_KEY' >/dev/null 2>&1
    $1
  "
}

echo "==> 1/4 Ensuring Conjur account '$ACCOUNT' and fetching admin key"
dc exec -T conjur conjurctl account create "$ACCOUNT" >/dev/null 2>&1 || true
ADMIN_KEY="$(dc exec -T conjur conjurctl role retrieve-key "$ACCOUNT:user:admin" 2>/dev/null | tr -d '\r\n')"
if [ -z "$ADMIN_KEY" ]; then
  echo "ERROR: could not retrieve the admin API key. Is the conjur container up?" >&2
  echo "       docker compose ps conjur" >&2
  exit 1
fi

echo "==> 2/4 Loading AIOps policy (infra/conjur/policy/aiops.yml)"
LOAD_OUT="$(cli 'conjur policy load -b root -f /policy/aiops.yml')"
printf '%s\n' "$LOAD_OUT"

echo "==> 3/4 Capturing worker host API key ($WORKER_HOST)"
WORKER_KEY="$(printf '%s' "$LOAD_OUT" | python3 -c '
import sys, json
try:
    doc = json.load(sys.stdin)
except Exception:
    sys.exit(0)
roles = doc.get("created_roles", {})
for v in roles.values():
    if str(v.get("id", "")).endswith("host:aiops/aiops-worker"):
        print(v.get("api_key", "")); break
' 2>/dev/null || true)"

# Policy already loaded on a prior run => no created_roles; rotate to get a key.
if [ -z "$WORKER_KEY" ]; then
  echo "    policy already present; rotating the worker API key"
  WORKER_KEY="$(cli "conjur host rotate-api-key -i $WORKER_HOST" | tr -d '\r\n')"
fi
if [ -z "$WORKER_KEY" ]; then
  echo "ERROR: could not obtain the worker API key." >&2
  exit 1
fi
umask 077; printf '%s' "$WORKER_KEY" > "$WORKER_KEY_FILE"
echo "    saved to $WORKER_KEY_FILE"

echo "==> 4/4 Loading credentials for lab device '$LAB_DEVICE' from .env"
cli "
  conjur variable set -i aiops/lab/$LAB_DEVICE/username -v '${DEVICE_USERNAME:-admin}'
  conjur variable set -i aiops/lab/$LAB_DEVICE/password -v '${DEVICE_PASSWORD:-changeme}'
  conjur variable set -i aiops/lab/$LAB_DEVICE/enable   -v '${DEVICE_ENABLE:-}'
"

cat <<EOF

Done. Conjur is bootstrapped.

Next:
  1. Put the worker API key in .env:
       SECRET_PROVIDER=cyberark
       CONJUR_API_KEY=$(cat "$WORKER_KEY_FILE")
  2. Restart the worker:
       docker compose up -d worker
  3. Test end-to-end:
       python scripts/enqueue_job.py health --device $LAB_DEVICE
EOF
