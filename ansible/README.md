# AIOps Ansible project

The **execution plane**. Ansible (run by AWX in production, by `ansible-runner`
inside the worker in the lab) is how the platform performs all task-based device
operations: backup, compliance, health, config, change, audit, automation.
Streaming monitoring (SNMP/synthetic) stays on a telemetry stack, not here.

## Layout

```
ansible.cfg
collections/requirements.yml   # vendor coverage (add a vendor = add a collection)
inventory/lab.yml              # static lab inventory; groups keyed by network OS
group_vars/
  all.yml                      # config_store path
  ios.yml, nxos.yml            # per-OS connection vars + credential sourcing
playbooks/
  backup.yml                   # pull running-config, version in git, report drift
  health.yml                   # gather facts -> health snapshot
  compliance.yml               # assert a hardening baseline
```

## How it's invoked

- **Lab:** the worker resolves device creds from CyberArk (its `SecretProvider`),
  injects them as extravars, generates a one-host inventory (group = device OS),
  and runs the matching playbook via `ansible-runner`.
- **Production:** AWX runs the same playbooks as **job templates**, with a Machine
  credential + a CyberArk Conjur credential plugin supplying secrets, plus AWX's
  RBAC, audit, scheduling, and approval workflow. See
  [`../docs/setup/AWX_SETUP.md`](../docs/setup/AWX_SETUP.md).

## Credentials

Device creds resolve in priority order (see `group_vars/ios.yml`):
1. `device_username` / `device_password` / `device_enable` extravars (worker → CyberArk),
2. `DEVICE_*` env fallback (for running playbooks by hand),
3. in AWX, a Conjur credential plugin or `cyberark.conjur.conjur_variable` lookup.

## Run a playbook by hand

```bash
cd ansible
ansible-galaxy collection install -r collections/requirements.yml -p collections
export DEVICE_USERNAME=admin DEVICE_PASSWORD=... CONFIG_STORE=/tmp/configs
ansible-playbook playbooks/backup.yml -e target=cat9k-lab-01
```

## Add a vendor

1. Add its collection to `collections/requirements.yml`.
2. Add a `group_vars/<os>.yml` with the connection vars.
3. Add a per-OS block to the playbooks (copy the IOS/NX-OS pattern).
