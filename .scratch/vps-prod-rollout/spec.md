# VPS production rollout (Contabo)

## Goal

Run Vesta (web + admin + Postgres + Redis) on the Contabo VPS behind nginx with TLS, staging-first (`DEV_MODE`), then go-live for real BDApps/Resend traffic.

## Primary sources

- [docs/ops/README.md](../../docs/ops/README.md) — inventory and doc index
- [ops/deploy/README.md](../../ops/deploy/README.md) — compose, TLS bootstrap, staging flags
- [docs/ops/03-deployment.md](../../docs/ops/03-deployment.md) — first deploy and routine release
- [docs/ops/04-env-reference.md](../../docs/ops/04-env-reference.md) — secrets and must-match rules
- [docs/ops/02-server-setup.md](../../docs/ops/02-server-setup.md) — hardening (§6)

## Server (already partially prepared)

- IPv4: `62.171.155.231`
- Docker, 4G swap, UTC timezone installed (2026-09-28)
- `/opt/vesta` directories exist; **repo not cloned**, **no prod env files**

## Staging parity (VPS v1)

Mirror **Vercel staging** env values from gitignored `apps/web/env.prod` / `apps/admin/env.prod` (see `STAGING-DEPLOY-PLAN.md` Step 3), with these overrides only:

| Area | VPS value |
|------|-----------|
| `DATABASE_URL` / `DIRECT_URL` | `postgresql://vesta:<password>@postgres:5432/vesta` (Compose hostname `postgres`) |
| `REDIS_URL` | `redis://redis:6379` (optional on Vercel; set on VPS) |
| `APP_URL` (web) | Public web origin, e.g. `https://cycle-circle.com` |
| `APP_URL` (admin env) | Same **web** URL (not admin hostname) |
| `DEV_MODE` | `true` (OTP `420420` / `840840`) |
| `NEXT_PUBLIC_DEV_MODE` | `true` via `ops/deploy/.env` at **web build** time |
| `NODE_ENV` | `production` (same as staging Vercel) |
| BDApps | Placeholder / empty like staging — no simulator in prod compose |
| Mailpit / simulator vars | Unset |

No Resend / JWT / CRON values belong in git — copy from Vercel dashboard locally onto the server.

## Out of scope (later)

- Off-box backup sync (Contabo Object Storage)
- CI-built images (build on VPS is fine for v1)

## Monitoring (in repo)

Prometheus + Grafana stack: [.scratch/monitoring/spec.md](../monitoring/spec.md) — landed in repo ([ticket 01](../monitoring/issues/01-monitoring-stack-repo-local-and-prod.md), `pnpm monitoring:verify`). **Public** `https://monitoring.cycle-circle.com` go-live is [ticket 02](../monitoring/issues/02-vps-monitoring-public-go-live.md) and requires [07-host-hardening](./issues/07-host-hardening.md) first.

## Tickets

See `issues/` — work the **frontier** (all blockers `resolved`).
