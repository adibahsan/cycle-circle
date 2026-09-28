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

## Out of scope (later)

- Off-box backup sync (Contabo Object Storage)
- Grafana/Prometheus stack
- CI-built images (build on VPS is fine for v1)

## Tickets

See `issues/` — work the **frontier** (all blockers `resolved`).
