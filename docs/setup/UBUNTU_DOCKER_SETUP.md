# Ubuntu VM + Docker — Phase 1 host setup

> Stands up the runtime host for the AIOps NetOps agent platform: an **Ubuntu
> Linux VM** running **Docker Engine + Compose**. This is the locked Phase 1
> runtime (decision #4 in
> [`../architecture/AGENT_TEAM_ARCHITECTURE.md`](../architecture/AGENT_TEAM_ARCHITECTURE.md#8-decisions-locked--2026-06-28)).
> Production graduates to k3s later; everything here stays valid as the lab.

---

## 0. VM sizing & prerequisites

Provision the Ubuntu VM (on the Dell server, via your hypervisor — Proxmox/ESXi/
KVM/Hyper-V) with headroom for the Phase 1 stack **plus** an EVE-NG-reachable
management NIC.

| Resource | Phase 1 minimum | Comfortable |
|----------|-----------------|-------------|
| OS       | Ubuntu Server 22.04 / 24.04 LTS | 24.04 LTS |
| vCPU     | 4               | 8          |
| RAM      | 8 GB            | 16 GB      |
| Disk     | 60 GB           | 120 GB SSD |
| NICs     | 1 (mgmt/data)   | 2 (one bridged to the device mgmt network) |

> The **emulated devices** (EVE-NG) are heavy and run on their **own** host — do
> not size this VM to also host the fleet. This VM only runs the platform stack
> and must be able to reach device mgmt IPs over SSH/HTTPS/SNMP.

Confirm you're on a 64-bit Ubuntu and have sudo:

```bash
lsb_release -a      # expect Ubuntu 22.04 or 24.04
uname -m            # expect x86_64
sudo -v             # confirm sudo works
```

---

## 1. Install Docker Engine + Compose (official apt repo)

Use Docker's official repository — **not** the older `docker.io` Ubuntu package —
so you get the current Engine and the `docker compose` v2 plugin.

```bash
# 1a. Remove any old/conflicting packages (safe if none are installed)
for p in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do
  sudo apt-get remove -y "$p" 2>/dev/null || true
done

# 1b. Prerequisites + Docker's GPG key
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# 1c. Add the repository (matches your Ubuntu codename automatically)
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 1d. Install Engine, CLI, containerd, buildx and the Compose plugin
sudo apt-get update
sudo apt-get install -y \
  docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

> **Behind a proxy?** If this VM reaches the internet only through the egress
> proxy, set `HTTP_PROXY`/`HTTPS_PROXY` for both apt and the Docker daemon
> (`/etc/systemd/system/docker.service.d/http-proxy.conf`) before `apt-get
> update`. Ask and I'll generate those drop-ins for your exact proxy.

---

## 2. Post-install (run Docker without sudo, enable on boot)

```bash
# Run docker as your user (avoids sudo on every command)
sudo groupadd docker 2>/dev/null || true
sudo usermod -aG docker "$USER"
newgrp docker            # apply group in current shell (or log out/in)

# Start on boot
sudo systemctl enable --now docker containerd
```

---

## 3. Verify

```bash
docker --version            # Docker version 27.x ...
docker compose version      # Docker Compose version v2.x ...
docker run --rm hello-world # pulls + runs; prints "Hello from Docker!"
```

If `hello-world` prints the greeting, Docker is working. If you hit a
`permission denied ... /var/run/docker.sock`, you didn't pick up the `docker`
group — log out and back in (or re-run `newgrp docker`).

---

## 4. Lay out the project on the VM

```bash
sudo mkdir -p /opt/aiops && sudo chown "$USER":"$USER" /opt/aiops
cd /opt/aiops
git clone <your-AIOps-repo-url> .     # or copy the repo here
```

A Phase 1 `compose.yaml` will live at the repo root and bring up the spine:
**CyberArk Conjur (OSS, for the SecretProvider), Postgres (inventory/state),
NATS (job bus)**, and a placeholder **connectivity worker**. Skeleton shape:

```yaml
# compose.yaml — Phase 1 spine (skeleton; built out in Phase 1)
services:
  conjur:                 # CyberArk Conjur OSS — issues short-lived device creds
    image: cyberark/conjur:latest
    command: server
    environment:
      DATABASE_URL: postgres://postgres@conjur-db/postgres
      CONJUR_DATA_KEY: ${CONJUR_DATA_KEY}   # generate once, keep out of git
    depends_on: [conjur-db]

  conjur-db:
    image: postgres:16
    environment: { POSTGRES_HOST_AUTH_METHOD: trust }
    volumes: [conjur-db:/var/lib/postgresql/data]

  state-db:               # platform inventory / state / CMDB
    image: postgres:16
    environment:
      POSTGRES_DB: aiops
      POSTGRES_PASSWORD: ${STATE_DB_PASSWORD}
    volumes: [state-db:/var/lib/postgresql/data]

  bus:                    # async job bus between API and connectivity workers
    image: nats:latest
    ports: ["4222:4222"]

  worker:                 # connectivity worker (Netmiko/NAPALM/Scrapli)
    build: ./services/worker
    environment:
      NATS_URL: nats://bus:4222
      CONJUR_URL: http://conjur:80
    depends_on: [bus, conjur, state-db]

volumes: { conjur-db: {}, state-db: {} }
```

Bring it up (once the file exists):

```bash
docker compose up -d        # start the spine
docker compose ps           # check status
docker compose logs -f worker
docker compose down         # stop (add -v to also drop volumes)
```

> Secrets like `CONJUR_DATA_KEY` and `STATE_DB_PASSWORD` go in a `.env` file that
> is **git-ignored** — never commit them.

---

## 5. Network reachability check (to the device fleet)

The platform is only useful if the VM can reach device mgmt IPs. From the VM:

```bash
ping -c2 <device-mgmt-ip>                 # L3 reachability
nc -vz <device-mgmt-ip> 22                # SSH open?
nc -vz <device-mgmt-ip> 443               # HTTPS/REST open?
```

If these fail, the VM's NIC isn't on (or routed to) the device management network
— bridge a second NIC onto the EVE-NG `Cloud`/`pnet` mgmt segment (or the real
OOB mgmt VLAN in production).

---

## What's next

With Docker up on the Ubuntu VM, **Phase 1** is: author the real `compose.yaml`,
implement `CyberArkProvider` against the Conjur container, and write the first
`DeviceDriver` (Cisco Catalyst) so a worker pulls a config end-to-end from an
EVE-NG Catalyst. Say the word and I'll scaffold those services in the repo.
