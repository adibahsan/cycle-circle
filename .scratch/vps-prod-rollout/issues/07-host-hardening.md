# 07: VPS security hardening

**Status:** resolved

**What to build:** SSH, firewall, and intrusion prevention match the ops runbook before the stack accepts untrusted internet traffic at scale.

**Blocked by:** 04 (stack proven; nginx may be on 80/443)

- [x] `00-hardening.conf` applied; password SSH login fails; key login works (2026-09-29)
- [x] `ufw` active: allow 22, 80, 443; default deny incoming
- [x] `fail2ban` sshd jail enabled
- [x] Confirmed Compose publishes **only** nginx on 80/443 (postgres/redis not host-published)

## Answer

Applied per `docs/ops/02-server-setup.md` §6. Verify: `sudo sshd -T`, `sudo ufw status`, `sudo fail2ban-client status sshd`.
