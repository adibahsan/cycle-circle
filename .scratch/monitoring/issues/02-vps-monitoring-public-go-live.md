# 02: VPS — public Grafana go-live

**What to build:** After the repo stack and server hardening are in place, `https://monitoring.cycle-circle.com` is live with TLS and Grafana login—so day-to-day ops does not rely on SSH tunnels.

**Blocked by:** 01 (monitoring stack in repo), VPS rollout [07-host-hardening](../vps-prod-rollout/issues/07-host-hardening.md) (UFW, sshd, fail2ban before exposing the monitoring vhost)

**Status:** ready-for-human

- [ ] `monitoring.cycle-circle.com` A record points at the VPS (client DNS)
- [ ] Ticket 07 hardening applied on the server
- [ ] Staging/production stack health checks green (web/admin/db/redis) before enabling monitoring vhost
- [ ] Certbot certificate includes `monitoring.cycle-circle.com`; nginx recreated with production TLS config
- [ ] `curl -fsS https://monitoring.cycle-circle.com/api/health` succeeds; Grafana login works with server-configured admin credentials
- [ ] Prometheus not reachable from the public internet (only Grafana hostname on 443)
- [ ] Runtime smoke documented in ticket 01 ops section executed: Prometheus ready, mandatory scrape targets UP, disk-free panel sane for 30-day retention
