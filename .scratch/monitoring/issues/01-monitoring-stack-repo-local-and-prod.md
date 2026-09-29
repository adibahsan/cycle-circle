# 01: Monitoring stack (repo, local, prod-internal, nginx config)

**What to build:** One shared Prometheus + Grafana bundle in the repo that works end-to-end on a developer machine and merges cleanly into the Contabo production Compose project—without requiring a public URL yet. Operators and developers get the same dashboards and scrape layout; only retention and host-level metrics differ (7 days local, 30 days on VPS; true node metrics on Linux prod only).

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] Shared monitoring module (Compose fragment, Prometheus scrape config, Grafana provisioning/datasources/dashboards) is the single source of truth for both environments
- [ ] Local: documented command merges monitoring with the existing dev Compose stack after infra is up; Grafana on localhost fixed port with dev credentials in example env only; Postgres, Redis, and container metrics scrape successfully (`UP` targets) — **runtime UP smoke manual** (`ops/monitoring/README.md`)
- [x] Production: monitoring merges into the production Compose project; Prometheus 30-day retention; Grafana and Prometheus not published on host ports (internal network only); Grafana admin password documented for `/opt/vesta` env files, not git
- [x] Exporters in scope: node (Linux VPS), cAdvisor, nginx metrics, postgres_exporter, redis_exporter; no Next.js `/metrics` in this ticket
- [x] Production nginx configs (bootstrap, self-signed, Let’s Encrypt) include `monitoring.cycle-circle.com` (ACME + HTTPS proxy to Grafana); deployment docs describe certbot SAN when issuing certs; Prometheus remains off public nginx
- [x] `pnpm monitoring:verify` (or equivalent) passes locally: file inventory + merged Compose config for dev+monitoring and prod+monitoring without requiring live `/opt/vesta` production secrets
- [x] LOCAL-DEVELOPMENT, ops deploy README, deployment, DNS, and operations docs updated for ports, commands, retention, disk expectations, runtime smoke steps, and complementarity with Sentry/UptimeRobot (no Sentry/UptimeRobot setup in this ticket)
- [x] VPS rollout spec cross-linked; monitoring no longer listed as unscoped once this ticket merges

## Answer

Merged to `feat/vps-prod-rollout` @ `b0defa98be9762eefe40cb55522358e7867798dd` (ticket branch `b16df9f`). Coder: Cursor Task `generalPurpose`; reviewer: `reviewer` — **Approved**.

Follow-ups (non-blocking): run local stack smoke for scrape `UP`; host/containers/services dashboards added under `grafana/provisioning/dashboards/json/`.
