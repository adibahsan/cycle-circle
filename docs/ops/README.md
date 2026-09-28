# Vesta — Server Operations

This is the operations handbook for Vesta's production VPS: how to reach the server, how it's set up, how deploys work, what env vars it needs, and the day-to-day runbook (logs, backups, restore, updates, incidents). Start here, then follow the doc index below for the task at hand.

---

## Server inventory

| Item | Value |
|---|---|
| Provider | Contabo, Cloud VPS 6 (2026) (no setup), region EU, created 2026-09-26 |
| Instance name / id | vmi3612692 / 203612692 |
| IPv4 | 62.171.155.231 |
| IPv6 | 2a02:c207:2361:2692::1 (/64) |
| OS | Ubuntu 24.04.5 LTS, kernel 6.8, timezone Europe/Berlin |
| Resources | 6 vCPU, 11 GiB RAM, 193 GB disk |
| VNC | 169.58.1.198:63026 (separate VNC password set via the lock icon in the portal; max ~8 chars; unencrypted, emergency only) |
| Domain (client-owned) | cycle-circle.com (planned: `cycle-circle.com`, `www.`, `admin.` → 62.171.155.231; DNS not yet pointed) |
| Users | `vesta` (uid 1001, groups `sudo`, passwordless sudo via `/etc/sudoers.d/90-vesta`, no password, key-only login). `root` (password = Contabo secret "Circle Root"; key also installed) |
| Authorized key | the ed25519 key from the admin Mac (`~/.ssh/id_ed25519.pub`) installed for `vesta` and `root` |
| sshd (current state) | port 22, `PermitRootLogin yes`, `PasswordAuthentication yes` — hardening is documented but **not yet applied**, see [02-server-setup.md](./02-server-setup.md) |
| Firewall | `ufw` installed but inactive |

---

## Doc index

| Doc | Covers |
|---|---|
| [01-access.md](./01-access.md) | SSH, users & keys, Contabo portal, Contabo API, lockout recovery, credential rotation |
| [02-server-setup.md](./02-server-setup.md) | Bootstrap + hardening runbook (not yet applied) |
| [03-deployment.md](./03-deployment.md) | Docker Compose deploy on the VPS |
| [04-env-reference.md](./04-env-reference.md) | Environment variables reference |
| [05-operations.md](./05-operations.md) | Logs, backups, restore, updates, incidents |
| [06-merge-to-main-runbook.md](./06-merge-to-main-runbook.md) | Merge deploy stack PR into `main` (human) |
| [deploy-artifacts-verification.md](./deploy-artifacts-verification.md) | `ops/deploy/` file checklist + `pnpm deploy:verify` |

---

## Quick access

```bash
# Alias (from ~/.ssh/config on the admin Mac)
ssh vesta

# Full form
ssh -i ~/.ssh/id_ed25519 vesta@62.171.155.231

# IPv6
ssh -i ~/.ssh/id_ed25519 vesta@2a02:c207:2361:2692::1
```

Details on GUI clients (Termius, VS Code Remote-SSH), adding/removing keys, and the Contabo portal/API are in [01-access.md](./01-access.md).

---

## Where secrets live

| Secret | Location |
|---|---|
| Root password | Contabo Secret Management, secret "Circle Root" |
| Contabo API credentials | Contabo portal → API page (https://my.contabo.com/api/details); local copy at `~/.config/contabo/creds.env` per [01-access.md](./01-access.md) |
| App / runtime secrets | Server env files `/opt/vesta/*.env.production`, per [03-deployment.md](./03-deployment.md) — values are never committed to git |

Never write a secret value into this repo. Refer to secrets by name (e.g. `<Contabo secret "Circle Root">` or `<from password manager>`), not by value.

---

## Related docs

- [../LOCAL-DEVELOPMENT.md](../LOCAL-DEVELOPMENT.md) — local dev setup (Docker + Next.js hybrid)
- [../../CLAUDE.md](../../CLAUDE.md) — agent / contributor conventions
