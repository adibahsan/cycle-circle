# Server Setup

Fresh Ubuntu 24.04 → ready to run Vesta. Everything runs as `vesta` (passwordless
`sudo`) — see [01-access.md](./01-access.md) for how to reach the box.
[03-deployment.md](./03-deployment.md) picks up from here (Docker Compose stack in
`/opt/vesta`). See [README.md](./README.md) for the full server inventory.

Every section below was checked against the live server on **2026-09-28** via
read-only `ssh vesta '...'` commands. Status markers reflect what's actually on the
box, not a generic checklist:

- **✅ done** — verified present/applied on the server
- **⏳ not yet applied** — planned, nothing has been run yet
- **◐ partially done** — some of it is already there, rest is listed below

---

## 1. Base packages, locale, timezone

Status: ◐ partially done

| Package | State (verified 2026-09-28) |
|---|---|
| `curl`, `ca-certificates`, `gnupg`, `htop`, `jq` | ✅ installed |
| `unzip` | ⏳ not installed |
| `git`, `ufw` | ✅ installed |
| Pending apt upgrades | 0 (`apt list --upgradable` empty after `apt update`) |

Bring it fully current:

```bash
sudo apt update && sudo apt -y upgrade
sudo apt install -y unzip
```

### Locale

`en_US.utf8` is already generated (`locale -a` lists it) — no `locale-gen` needed.
The `perl: warning: Setting locale failed` you see over SSH from a Mac is a
**client-side** artifact: macOS Terminal/iTerm forwards `LC_CTYPE=UTF-8`, which
isn't a valid Ubuntu locale name (it wants `en_US.UTF-8`). Harmless — full
explanation and optional fix already documented in
[01-access.md § Troubleshooting](./01-access.md#troubleshooting--gotchas). Nothing
to do here.

### Timezone

Status: ⏳ decision pending — server is currently **Europe/Berlin** (Contabo
default, unchanged).

| Option | Tradeoff |
|---|---|
| Keep `Europe/Berlin` | No action needed. Host crontab times (`crontab -l`) and log timestamps are in CEST/CET, which is *not* the app's own cron convention. |
| **`UTC` (recommended)** | Matches the convention already used in `docs/VERCEL-CRONS.md` and the app's own schedule comments (`0 8 * * *` = 08:00 UTC = 14:00 Asia/Dhaka). Keeping the server clock in UTC means host crontab entries, `journalctl` timestamps, and the app's documented UTC schedules all read the same way — no mental offset. |
| `Asia/Dhaka` | Matches end users, but then *nothing* in logs/crontab matches the UTC times already written into the app's docs — pick this only if you're also rewriting those docs. |

If UTC is chosen:

```bash
sudo timedatectl set-timezone UTC
timedatectl show -p Timezone   # confirm: Timezone=Etc/UTC
```

Whichever timezone you land on, **choose it consciously before writing host
crontab entries** — see [05-operations.md § Crons](./05-operations.md#6-crons).

---

## 2. Admin user (`vesta`)

Status: ✅ done — verified 2026-09-28

Exact commands used to create it:

```bash
# as root
adduser --disabled-password --gecos "" vesta
usermod -aG sudo vesta

# passwordless sudo, scoped to this user only
echo "vesta ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/90-vesta
visudo -cf /etc/sudoers.d/90-vesta   # must print: parsed OK
chmod 0440 /etc/sudoers.d/90-vesta

# key-only login
mkdir -p /home/vesta/.ssh
echo "<admin Mac's ed25519 public key>" > /home/vesta/.ssh/authorized_keys
chown -R vesta:vesta /home/vesta/.ssh
chmod 700 /home/vesta/.ssh
chmod 600 /home/vesta/.ssh/authorized_keys
```

Verified live state matches exactly:

| Check | Result |
|---|---|
| `id vesta` | `uid=1001(vesta) gid=1001(vesta) groups=1001(vesta),27(sudo),100(users)` |
| `/etc/sudoers.d/90-vesta` | mode `440`, owner `root:root`, content `vesta ALL=(ALL) NOPASSWD:ALL`, `visudo -cf` → parsed OK |
| `passwd -S vesta` | `L` (locked — no password hash, key-only) |
| `/home/vesta/.ssh` | mode `700`, owner `vesta:vesta` |
| `/home/vesta/.ssh/authorized_keys` | mode `600`, owner `vesta:vesta` |

To add another teammate's key or a second sudo user, see
[01-access.md § Users & keys](./01-access.md#2-users--keys) — that's the
day-2 recipe; this section is the original bootstrap.

---

## 3. Docker Engine + Compose plugin

Status: ⏳ not yet applied — no `docker` binary on the box (verified: `command -v
docker` → not found; `docker.io`/`docker-ce` not installed).

Install from Docker's official apt repo (Ubuntu 24.04 = `noble`):

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update

sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Add `vesta` to the `docker` group so `sudo` isn't needed for every compose command:

```bash
sudo usermod -aG docker vesta
```

> **Warning:** membership in the `docker` group is root-equivalent — a container can
> bind-mount the host filesystem (`-v /:/host`) and read/write anything root can.
> Treat `docker` group membership exactly like `sudo` access; don't add it to any
> account you wouldn't also give passwordless sudo.

Log out and back in (or `newgrp docker`) for the group change to apply, then enable
and verify:

```bash
sudo systemctl enable --now docker
docker run --rm hello-world
docker compose version
```

### Log rotation

Without this, container logs grow unbounded on disk. Set a cap before running
anything real:

```bash
sudo tee /etc/docker/daemon.json > /dev/null <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
sudo systemctl restart docker
```

This applies to containers started *after* the restart — existing containers keep
their old log config until recreated.

---

## 4. Swap

Status: ⏳ not yet applied — `swapon --show` returns nothing, 0B swap configured.
11 GiB RAM, 193 GB disk at 2% used (plenty of room).

Optional given the RAM headroom, but a 4G swapfile is cheap insurance against an
OOM-killed `next build` (Next.js production builds can spike memory) rather than a
substitute for RAM:

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# prefer swap only under real memory pressure, not for routine caching
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf
sudo sysctl --system
```

Verify: `swapon --show` and `free -h` should both show 4.0G.

---

## 5. `unattended-upgrades` and reboot policy

Status: ◐ partially done

Verified 2026-09-28:

| Setting | Value |
|---|---|
| `unattended-upgrades` package | ✅ installed |
| `APT::Periodic::Update-Package-Lists` | `"1"` (daily apt update) |
| `APT::Periodic::Unattended-Upgrade` | `"1"` (security updates auto-install) |
| `Unattended-Upgrade::Automatic-Reboot` | commented out → **off** |
| `/var/run/reboot-required` | not present (no reboot currently pending) |

So security patches already install themselves daily — nothing to configure there.
What's *not* decided is auto-reboot.

**Recommendation: leave `Automatic-Reboot` off.** This is a single VPS running the
whole stack (nginx, web, admin, postgres, redis) with no failover — an unattended
reboot at 02:00 local time would drop everything mid-flight with no one watching.
Instead, check for a pending reboot as part of the routine health check and reboot
manually in a maintenance window:

```bash
test -f /var/run/reboot-required && echo "reboot pending: $(cat /var/run/reboot-required)" || echo "no reboot pending"
```

Reboot procedure and what auto-starts afterward (`restart: unless-stopped`) is in
[05-operations.md § Restart / stop / start](./05-operations.md#3-restart--stop--start-services).

If you later want scheduled reboots anyway, uncomment in
`/etc/apt/apt.conf.d/50unattended-upgrades`:

```
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "02:00";
```

Note that's server-local time (§1 Timezone) — pick the time with that in mind.

---

## 6. Hardening runbook

> ⚠️ **NOT YET APPLIED — decision pending.**
> Verified live on 2026-09-28: `PermitRootLogin yes`, `PasswordAuthentication yes`
> (effective, via `sshd -T`), `ufw` installed but **inactive**, no `fail2ban`. Root
> has a working password login *and* a key. Nothing below has been run — this is the
> plan. A mistake here can lock out SSH entirely, so read the whole section before
> typing anything, and keep a rollback path open the entire time (step (b) below).

### The `sshd_config.d` trap — verified on this box

`/etc/ssh/sshd_config` includes `/etc/ssh/sshd_config.d/*.conf` (line 12), and sshd
uses **first-obtained-value-wins**: it reads the glob in lexical filename order and
the first directive it hits for a given keyword sticks — later files are ignored for
that keyword, even ones that come after the `Include` in read order. This box
already has two conflicting drop-ins:

```
/etc/ssh/sshd_config.d/50-cloud-init.conf       → PasswordAuthentication yes
/etc/ssh/sshd_config.d/60-cloudimg-settings.conf → PasswordAuthentication no
```

`50-` sorts before `60-`, so **cloud-init's `yes` wins** — confirmed by `sudo sshd -T`
showing `passwordauthentication yes` even though a file on the same box says `no`.
This is exactly the failure mode to avoid: a hardening drop-in named `99-` (or
anything ≥ `60-`) would **lose** to `50-cloud-init.conf` and silently do nothing.

**Fix: name the hardening file `00-hardening.conf`** — sorts before everything,
including any file cloud-init regenerates on a future boot. (Editing
`50-cloud-init.conf` in place works too, but cloud-init can overwrite that file on
`cloud-init clean` + reboot; a lower-numbered file survives that.)

### Safe order (avoid lockout)

Do this in three separate terminals/tabs. Don't skip (a) or (b) — they're the
rollback path if (c) breaks something.

**(a) Confirm key login works, in a second terminal**, separate from the one you'll
make changes in:

```bash
ssh vesta   # must succeed before continuing
```

**(b) Keep a root (or `vesta`) session open in a third terminal** for the whole
process and do not close it until (d) passes:

```bash
ssh root@62.171.155.231   # password = Contabo secret "Circle Root"
```

**(c) In the first terminal, create the hardening drop-in:**

```bash
sudo tee /etc/ssh/sshd_config.d/00-hardening.conf > /dev/null <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF

sudo sshd -t                    # must print nothing (syntax OK)
sudo systemctl reload ssh       # NOT restart — reload keeps existing sessions alive
```

`PermitRootLogin prohibit-password` (not `no`) keeps root's key-based emergency
login working, matching the current setup (root has a key installed per
[README.md](./README.md)). Use `no` instead only if you intend to remove root SSH
access entirely — in which case VNC/portal (below) become the *only* fallback.

**(d) From the second terminal (still open from step a), open a brand-new session
and verify:**

```bash
ssh vesta                                                              # must still work
ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no vesta   # must now FAIL
sudo sshd -T | grep -E 'passwordauthentication|permitrootlogin|kbdinteractiveauthentication'
# expect: passwordauthentication no / permitrootlogin prohibit-password / kbdinteractiveauthentication no
```

Only after this passes, close the rollback session from (b). If anything fails,
use the still-open rollback session to `rm /etc/ssh/sshd_config.d/00-hardening.conf`
and `systemctl reload ssh` to revert.

### `ufw`

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

> **Warning: Docker published ports bypass `ufw`.** Docker manipulates `iptables`
> directly (its `DOCKER` chain, inserted ahead of `ufw`'s rules), so a container
> started with e.g. `ports: ["5432:5432"]` is reachable from the internet **even
> with `ufw` denying incoming**. `ufw` only protects ports the host itself listens
> on, not Docker's.
>
> Rule for the compose file in [03-deployment.md](./03-deployment.md): **only
> `nginx` publishes ports** (`80:80`, `443:443`). `postgres` and `redis` must have
> no `ports:` mapping to `0.0.0.0` — they should only be reachable over the
> compose-internal network, from other containers.

### `fail2ban`

```bash
sudo apt install -y fail2ban
sudo tee /etc/fail2ban/jail.local > /dev/null <<'EOF'
[sshd]
enabled = true
port = ssh
backend = systemd
maxretry = 5
bantime = 1h
findtime = 10m
EOF
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```

### If you get locked out anyway

VNC console and the Contabo portal (Reset password / Rescue system) don't depend on
SSH at all — full recovery decision tree in
[01-access.md § Lockout recovery](./01-access.md#5-lockout-recovery-decision-tree).

---

## 7. Verification checklist

Run after completing the sections above:

```bash
ssh vesta
apt list --upgradable 2>/dev/null                 # → empty
which unzip                                        # → present
timedatectl show -p Timezone                       # → matches your §1 decision
docker run --rm hello-world                         # → "Hello from Docker!"
docker compose version                              # → v2.x
groups vesta | grep -o docker                      # → docker
swapon --show                                        # → /swapfile, 4G (if applied)
systemctl is-active unattended-upgrades.service     # → active (or timer-based, check `systemctl status`)
sudo sshd -T | grep -E 'passwordauthentication|permitrootlogin'
                                                      # → no / prohibit-password (after §6)
sudo ufw status verbose                             # → active, 22/80/443 allowed, default deny incoming
sudo fail2ban-client status sshd                    # → jail exists, currently banned: 0
```

Once this checklist passes, continue to [03-deployment.md](./03-deployment.md) to
stand up the app stack in `/opt/vesta`.
