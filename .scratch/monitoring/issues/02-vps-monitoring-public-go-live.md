# 02: VPS — public Grafana go-live

**What to build:** After the repo stack and server hardening are in place, `https://monitoring.cycle-circle.com` is live with TLS and Grafana login—so day-to-day ops does not rely on SSH tunnels.

**Blocked by:** 01 (monitoring stack in repo), VPS rollout [07-host-hardening](../vps-prod-rollout/issues/07-host-hardening.md) (UFW, sshd, fail2ban before exposing the monitoring vhost)

**Status:** resolved

- [x] `monitoring.cycle-circle.com` A record points at the VPS (`62.171.155.231`; verified 2026-09-29)
- [x] Ticket 07 hardening applied on the server
- [x] Staging/production stack health checks green (web/admin/db/redis) before enabling monitoring vhost
- [x] Certbot certificate includes `monitoring.cycle-circle.com`; nginx recreated with production TLS config (LE expiry ~2026-12-28)
- [x] `curl -fsS https://monitoring.cycle-circle.com/api/health` succeeds; Grafana login uses `/opt/vesta/.env.monitoring.production` (password not in git)
- [x] Prometheus not published on host ports (9090 not exposed publicly)
- [x] Runtime smoke: Prometheus ready; scrape targets UP (cadvisor, nginx, node, postgres, prometheus, redis)

## Answer

Deployed 2026-09-29: synced `ops/monitoring/` + prod compose/nginx from `feat/vps-prod-rollout`, created `.env.monitoring.production` on VPS, `docker compose up` monitoring services, cert `--expand` for monitoring SAN, nginx recreate. `/opt/vesta` git still sparse on `main` — rsync deploy until branch merge/pull.
