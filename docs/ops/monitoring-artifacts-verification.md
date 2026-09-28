# Monitoring artifacts verification

Use before merging monitoring work and in PR review. Automated check: `pnpm monitoring:verify` from repo root.

## What it checks

1. **Inventory** — Prometheus/Grafana provisioning, compose fragments, nginx TLS variants, stub env for compose render (see [ops/monitoring/README.md](../../ops/monitoring/README.md)).
2. **Prometheus scrape jobs** — `prometheus`, `node_exporter`, `cadvisor`, `nginx`, `postgres`, `redis`.
3. **Merged Compose config** (requires Docker CLI, not a running stack):
   - Local: `ops/docker/compose.yml` + monitoring local overlay → Grafana host port **3030**, retention **7d**.
   - Production: `ops/deploy/compose.prod.yml` (includes monitoring) with stub `VESTA_*_ENV_FILE` paths → no Grafana host ports, retention **30d**.

Production env files on a laptop are **not** required; the verify script sets `VESTA_*_ENV_FILE` to [ops/monitoring/stub/](../../ops/monitoring/stub/).

## Manual checklist (first VPS enable)

- [ ] `.env.monitoring.production` on server (from [ops/monitoring/env/monitoring.production.example](../../ops/monitoring/env/monitoring.production.example))
- [ ] Host hardening complete ([rollout ticket 07](../../.scratch/vps-prod-rollout/issues/07-host-hardening.md))
- [ ] Certbot certificate includes `monitoring.cycle-circle.com` (see [03-deployment.md §TLS](./03-deployment.md))
- [ ] Runtime smoke: Prometheus `/-/ready`, Grafana `/api/health`, targets **UP** in Prometheus UI

**Complementary:** Sentry (errors) and UptimeRobot (public uptime) — [05-operations.md](./05-operations.md).
