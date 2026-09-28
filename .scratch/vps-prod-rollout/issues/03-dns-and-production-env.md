# 03: DNS and production environment files

**Status:** ready-for-human

**What to build:** Public hostnames resolve to the VPS and runtime secrets exist on the server (never in git) so containers can start with real configuration.

**Blocked by:** 02 (VPS repo and deploy key)

- [ ] A records (and optional AAAA) for `cycle-circle.com`, `www.cycle-circle.com`, `admin.cycle-circle.com` point to `62.171.155.231`
- [ ] `dig +short @1.1.1.1 cycle-circle.com` returns the VPS IP from an external resolver
- [ ] `/opt/vesta/.env.web.production`, `.env.admin.production`, `.env.postgres.production` created from `ops/deploy/env/*.example`, mode `600`, owner `vesta`
- [ ] `JWT_SECRET` and `CRON_SECRET` byte-identical in web and admin env files
- [ ] Postgres password in env files matches `POSTGRES_PASSWORD` in postgres env
- [ ] Staging choice documented: `DEV_MODE=true` on web for first bring-up; `NEXT_PUBLIC_DEV_MODE` handled via `ops/deploy/.env` at **build** time when applicable
