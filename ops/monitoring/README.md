# Monitoring (Prometheus + Grafana)

Shared observability module for **local Docker** and **production Compose**. Spec: [.scratch/monitoring/spec.md](../../.scratch/monitoring/spec.md).

## Grafana dashboards (folder **Vesta**)

| Dashboard | Metrics source |
|-----------|----------------|
| **Vesta host system** | node_exporter — CPU, memory, load, disk space/I/O, network, inodes, uptime |
| **Vesta containers** | Docker API exporter (`vesta_container_*`) — CPU, memory, network; cAdvisor kept for host/cgroup where available |
| **Vesta data services** | nginx/postgres/redis exporters + scrape `up` |
| **Vesta infrastructure** | All jobs — scrape target availability |

On macOS local dev, **node_exporter** reflects the Linux VM in Docker, not the Mac host; host dashboards are authoritative on the VPS.

## Layout

| Path | Purpose |
|------|---------|
| `compose.yml` | Prometheus, Grafana, exporters (single source of truth) |
| `compose.local.override.yml` | 7-day retention, Grafana `localhost:3030` |
| `compose.prod.override.yml` | 30-day retention, `/opt/vesta` env files, no host ports |
| `prometheus/prometheus.yml` | Scrape jobs (node, cAdvisor, nginx, Postgres, Redis) |
| `grafana/provisioning/` | Datasource + dashboards |
| `env/*.example` | Local dev credentials (example only) and production env **names** |

Production merges via `include` in [ops/deploy/compose.prod.yml](../deploy/compose.prod.yml). Prometheus is **not** exposed on nginx; Grafana is proxied at `https://monitoring.cycle-circle.com` after TLS go-live ([ticket 02](../../.scratch/monitoring/issues/02-vps-monitoring-public-go-live.md)).

## Local quick start

Prerequisites: base infra running (`pnpm docker:dev` or `just infra` — Postgres + Redis at minimum).

```bash
pnpm docker:monitoring
```

- **Grafana:** http://localhost:3030 (default `admin` / `vesta_dev_grafana` — see `env/monitoring.local.example`)
- **Retention:** 7 days
- **node_exporter:** reflects the Linux VM in production; on macOS Docker it does not show true Mac host metrics — use cAdvisor + DB/cache dashboards locally.

Stop overlay:

```bash
pnpm docker:monitoring:down
```

## Production env (on VPS only)

Copy [env/monitoring.production.example](./env/monitoring.production.example) to `/opt/vesta/.env.monitoring.production` (mode `600`, owner `vesta`). Set `GRAFANA_ADMIN_PASSWORD` (mixed case + symbol; Grafana 11 policy) and `POSTGRES_EXPORTER_DSN` to match Postgres credentials.

On the VPS, run Compose with **`--env-file /opt/vesta/.env.monitoring.production`** so `GRAFANA_ADMIN_PASSWORD` is applied (see `compose.prod.override.yml`). The same file is mounted into Grafana/postgres-exporter via `env_file`. On first start the admin password is written to the Grafana volume; if you only set the file later, reset with `grafana cli admin reset-admin-password` or use the default **`admin` / `changeme`** until fixed.

## Verification

```bash
pnpm monitoring:verify
```

Inventory + merged `docker compose config` for local and production (uses stub env under `stub/`, not live `/opt/vesta` secrets).

## Runtime smoke (manual)

After stack is up:

```bash
docker compose exec prometheus wget -qO- http://127.0.0.1:9090/-/ready
docker compose exec grafana wget -qO- http://127.0.0.1:3000/api/health
# Targets UP: Prometheus UI → Status → Targets (or API /api/v1/targets inside the network)
```

## Complementary tools

**Sentry** (application errors) and **UptimeRobot** (public HTTP uptime) stay separate; see [docs/ops/05-operations.md](../../docs/ops/05-operations.md).

## VPS rollout

Enable the public monitoring vhost only after [host hardening](../../.scratch/vps-prod-rollout/issues/07-host-hardening.md). Cross-link: [.scratch/vps-prod-rollout/spec.md](../../.scratch/vps-prod-rollout/spec.md).
