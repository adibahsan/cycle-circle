# 04: First stack bring-up (staging mode)

**Status:** ready-for-agent

**What to build:** The full Compose stack runs on the VPS with bootstrap HTTP nginx; database migrated and admin seeded; web and admin reachable over HTTP for smoke tests before TLS.

**Blocked by:** 02, 03

- [ ] `docker compose build` succeeds for web and admin on VPS (staging build args if using OTP bypass)
- [ ] Postgres and Redis healthy; Prisma `migrate deploy` applied from web container
- [ ] Admin seed run with non-default `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- [ ] All services `Up` via `docker compose ps`
- [ ] HTTP smoke: login pages respond on hostnames (via bootstrap nginx, port 80)
- [ ] `curl -fsS http://cycle-circle.com/api/health/db` returns ok (or equivalent via Host header if DNS not propagated yet)
