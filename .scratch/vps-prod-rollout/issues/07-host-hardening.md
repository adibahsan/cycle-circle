# 07: VPS security hardening

**Status:** ready-for-human

**What to build:** SSH, firewall, and intrusion prevention match the ops runbook before the stack accepts untrusted internet traffic at scale.

**Blocked by:** 04 (stack proven; nginx may be on 80/443)

- [ ] `00-hardening.conf` applied; password SSH login fails; key login works (rollback session used during change)
- [ ] `ufw` active: allow 22, 80, 443; default deny incoming
- [ ] `fail2ban` sshd jail enabled
- [ ] Confirmed Compose publishes **only** nginx on 80/443 (postgres/redis not host-published)
