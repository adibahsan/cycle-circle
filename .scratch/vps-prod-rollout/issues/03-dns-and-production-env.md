# 03: DNS and production environment files

**Status:** resolved

**What to build:** Public hostnames resolve to the VPS and runtime secrets exist on the server (never in git) so containers can start with real configuration.

**Blocked by:** 02 (VPS repo and deploy key)

- [x] A records for `cycle-circle.com`, `www.cycle-circle.com` → `62.171.155.231` (@1.1.1.1)
- [ ] A record for `admin.cycle-circle.com` → `62.171.155.231` (missing 2026-09-28)
- [x] `dig +short @1.1.1.1 cycle-circle.com` returns the VPS IP from an external resolver
- [x] `/opt/vesta/.env.*.production` filled from local Vercel mirrors (`apps/*/env.prod`), mode `600`
- [x] `JWT_SECRET` and `CRON_SECRET` byte-identical in web and admin env files
- [x] Postgres password aligned with `DATABASE_URL` (new Docker Postgres password, not Supabase)
- [x] Staging choice documented in `spec.md`: mirror Vercel staging env + Docker Postgres + `DEV_MODE=true`; `NEXT_PUBLIC_DEV_MODE=true` in `ops/deploy/.env` before web build
