# Monitoring stack (Prometheus + Grafana)

**Status:** ready-for-agent

**Primary sources:** Grilling session 2026-09-29; [docs/ops/README.md](../../docs/ops/README.md); [ops/deploy/compose.prod.yml](../../ops/deploy/compose.prod.yml); [ops/docker/compose.yml](../../ops/docker/compose.yml).

**Related rollout:** VPS hardening ([../vps-prod-rollout/issues/07-host-hardening.md](../vps-prod-rollout/issues/07-host-hardening.md)) must precede exposing `monitoring.cycle-circle.com`.

---

## Problem Statement

Operators running Vesta on the Contabo VPS (and developers running the local Docker stack) cannot see host health, container resource use, reverse-proxy behaviour, or database/cache pressure in one place. Today, “is it up?” relies on ad-hoc health HTTP endpoints and planned lightweight tools (Sentry, UptimeRobot) that do not expose time-series infra metrics or a unified dashboard. When latency spikes, disks fill, or containers restart, there is no retained history to answer what changed over the last days or weeks.

## Solution

Add a standard **Prometheus + Grafana** observability bundle to the repo, shared between **production Compose** and **local dev Compose** via a common monitoring module. Prometheus scrapes exporters for the host (Linux VPS only), Docker containers, nginx, Postgres, and Redis; data is kept **30 days** on the VPS. Grafana is reachable at **`https://monitoring.cycle-circle.com`** with **Grafana-native login** after server hardening; Prometheus stays on the internal Docker network only. Locally, the same dashboards and config run as an optional overlay (`pnpm docker:monitoring`) with Grafana on **localhost** and **7-day** retention. Sentry and UptimeRobot remain complementary for errors and external uptime.

## User Stories

1. As a **VPS operator**, I want a single dashboard for CPU, memory, disk, and load, so that I can tell if the Contabo instance is saturated before users complain.
2. As a **VPS operator**, I want per-container CPU and memory charts, so that I can see whether web, admin, postgres, or redis is the bottleneck.
3. As a **VPS operator**, I want nginx request and error signals, so that I can correlate traffic spikes with 5xx responses without reading raw access logs.
4. As a **VPS operator**, I want Postgres connection and basic health metrics, so that I can detect connection pool exhaustion or a unhealthy database early.
5. As a **VPS operator**, I want Redis memory and client metrics, so that I can spot evictions or runaway memory before cache failures affect sessions or queues.
6. As a **VPS operator**, I want **30 days** of metric history on the server, so that I can investigate incidents that happened up to a month ago.
7. As a **VPS operator**, I want Grafana on a dedicated hostname with login, so that I can review production health from a browser without SSH tunnels for day-to-day ops.
8. As a **VPS operator**, I want Prometheus **not** exposed on the public internet, so that scrapers and TSDB are not an attack surface.
9. As a **security-conscious operator**, I want monitoring enabled only after SSH/UFW/fail2ban hardening, so that a new public vhost does not outpace baseline server lockdown.
10. As a **developer**, I want to start monitoring locally with one documented command after infra is up, so that I can learn dashboards and validate config before touching production.
11. As a **developer**, I want the **same** Grafana dashboards and Prometheus rules in local and prod, so that what I see on my laptop matches production layout (even if some targets differ).
12. As a **developer**, I want Grafana on a fixed local port, so that I can bookmark it without editing hosts files.
13. As a **developer**, I accept shorter retention locally, so that my laptop disk is not consumed by a 30-day TSDB I rarely need.
14. As a **on-call operator**, I want UptimeRobot to keep checking public health endpoints, so that total site outage is detected even if I am not looking at Grafana.
15. As a **on-call operator**, I want Sentry for application errors, so that stack traces and release context are not duplicated inside Prometheus in v1.
16. As a **release engineer**, I want monitoring assets verified in CI-like checks without a live VPS, so that broken compose merges or missing config are caught in PR review.
17. As a **release engineer**, I want DNS and TLS steps documented for `monitoring.cycle-circle.com`, so that certbot and nginx changes follow the same pattern as `admin.cycle-circle.com`.
18. As a **contributor**, I want secrets (Grafana admin password, exporter DSNs) documented by **name** in ops docs only, so that no credentials are committed to git.
19. As a **VPS operator**, I want monitoring services to restart with the stack, so that a reboot does not leave a blind spot until manual intervention.
20. As a **VPS operator**, I want disk usage visible for the root filesystem, so that Prometheus or Postgres growth does not silently fill the 193 GB volume.
21. As a **developer** using hybrid `just wa` (Next on host, Postgres/Redis in Docker), I still want postgres and redis exporters to reflect the dev database when the monitoring overlay is running, so that local dashboards remain meaningful.
22. As a **product owner**, I defer business KPIs (signups, OTP success rates) to a later phase, so that v1 ships quickly without instrumenting Next.js routes.
23. As a **VPS operator**, I want optional room to add Grafana email alerts later (disk threshold, target down), so that v1 dashboards are not blocked on SMTP setup.
24. As a **maintainer**, I want monitoring documented in the ops handbook and local development guide, so that future agents and humans do not rediscover ports and commands.

## Implementation Decisions

### Architectural shape

- Introduce a **shared monitoring module** (Compose fragment + Prometheus scrape config + Grafana provisioning) consumed by **two merges**: production stack and local Docker stack. One source of truth for dashboards, datasources, and scrape jobs; environment-specific overrides only for retention, external URLs, and which optional targets exist (e.g. host node metrics on Linux VPS vs limited host view on macOS Docker).
- **Do not** add application `/metrics` endpoints to Next.js in v1; HTTP behaviour on prod is inferred from **nginx** metrics where available.
- Monitoring containers join the **same Compose project network** as existing services so scrape targets use service DNS names, not host-published ports (except where node-level collection requires host mounts on Linux).

### Production (Contabo VPS)

- Extend the production Compose project with: **Prometheus**, **Grafana**, **node_exporter** (Linux host), **cAdvisor**, **nginx Prometheus exporter** (or equivalent stub_status scrape), **postgres_exporter**, **redis_exporter**.
- Prometheus retention: **30 days**; size limits documented so operators can watch disk.
- Grafana: reverse-proxied by existing nginx container on **`monitoring.cycle-circle.com`**; TLS via existing certbot flow (additional SAN on certificate issuance).
- Grafana authentication: **built-in** admin account; password supplied via server-side env file under `/opt/vesta`, never in git.
- Prometheus UI/API: **not** published through nginx; reachable only inside the Compose network (and optionally via SSH port-forward documented for emergencies).
- **Blocked on** VPS security hardening (UFW 22/80/443, fail2ban, sshd hardening) before enabling the public monitoring vhost.
- Enable on server **after** staging health checks for web/admin/postgres/redis succeed; repo land can happen in parallel with broader VPS rollout.

### Local development

- Optional overlay started **after** base dev Compose is up; root **pnpm** script documents the exact `docker compose` merge invocation.
- Grafana published on **localhost** at a fixed high port (e.g. 3030); default dev credentials only in example env, not production values.
- Prometheus retention locally: **7 days**.
- **node_exporter** on macOS Docker does not provide true Mac host metrics; document that **host** dashboards are production-shaped and local focus is containers + postgres + redis (+ dev nginx on edge port when present).

### nginx integration (production)

- Add `monitoring.cycle-circle.com` to HTTP ACME challenge server_name set and HTTPS server block proxying to Grafana upstream.
- Self-signed and bootstrap nginx variants updated consistently so staging TLS paths do not break.
- Confirm Compose still publishes **only** nginx on 80/443 after adding monitoring (Grafana not host-port mapped in prod).

### DNS and ops documentation

- Document new **A record** for `monitoring.cycle-circle.com` alongside existing apex, www, and admin records in the DNS runbook.
- Extend deployment and operations docs: how to start/stop monitoring, where env vars live, how to rotate Grafana password, how to verify scrape targets, disk implications of 30-day retention.
- Update local development guide with monitoring quick start (prerequisites: base compose up; URL and port; retention note).

### Verification tooling (see Testing Decisions)

- Add a **monitoring artifacts verify** step (standalone script or extension of deploy verify) that asserts the monitoring inventory exists and that **merged Compose config renders** without requiring `/opt/vesta` production env files on a laptop (use stub env or compose profiles if needed).
- Optionally document a **runtime smoke** procedure (Prometheus ready, Grafana health, all targets up) for post-deploy human or scripted check on VPS; not required to pass in GitHub CI if Docker is unavailable.

### Complementary tools (unchanged scope)

- **Sentry** and **UptimeRobot** remain separate; spec does not configure them but references DEPLOYMENT-PLAN Phase 8 alignment.

### VPS rollout spec alignment

- Remove “Grafana/Prometheus stack” from **out of scope** in the VPS production rollout spec once this effort is ticketed; cross-link from rollout spec **Further notes** until implemented.

## Testing Decisions

### What makes a good test here

- Assert **observable outcomes** at the deployment boundary: compose merges parse, required files exist, Prometheus configuration is syntactically valid, and (when run against a live stack) health endpoints respond and scrape targets report **UP** for expected jobs.
- Avoid testing internal Grafana dashboard JSON structure line-by-line; smoke-test that provisioning loaded (datasource resolves, at least one dashboard list non-empty) if runtime tests are added later.

### Primary seam (recommended)

- **Single automated gate:** merged Compose config validation + static inventory check (mirroring existing deploy artifact verification philosophy). This is the highest seam that protects both prod and local merges without needing Next.js or Prisma.

### Secondary seams (manual or follow-up automation)

- **Runtime smoke on VPS or local:** HTTP GET Prometheus `/-/ready`, Grafana `/api/health`, Prometheus API `/api/v1/targets` with all mandatory jobs healthy.
- **Docs check:** ops and LOCAL-DEVELOPMENT links remain valid (existing `pnpm docs:check` where applicable).

### Prior art

- `pnpm deploy:verify` and `scripts/verify-deploy-assets.mjs` — inventory + compose-derived paths, no live Docker requirement for file presence.
- Production compose healthchecks on postgres and redis — pattern for optional healthchecks on prometheus/grafana services.
- Existing health HTTP routes on web (`/api/health/db`, `/api/health/redis`) — remain UptimeRobot targets, not Prometheus scrape sources in v1.

### Modules exercised by verification

- Shared monitoring module (config + compose fragment).
- Production compose merge.
- Local docker compose merge.
- Ops documentation (human-verified checklist on first VPS enable).

## Out of Scope

- Next.js application RED metrics (`/metrics`, OpenTelemetry exporters, custom business counters).
- Log aggregation (Loki, ELK) and trace collection (Tempo, Jaeger).
- Grafana Cloud remote write or long-term archival beyond 30-day on-VPS retention.
- Grafana OAuth / SSO (deferred; built-in login only in v1).
- nginx `auth_basic` double gate in front of Grafana (optional future hardening).
- IP allowlisting at nginx for monitoring hostname (optional future).
- Prometheus alerting rules and Grafana notification channels as a **requirement** for v1 (dashboards + UptimeRobot sufficient; email alerts optional follow-up).
- Replacing Sentry or UptimeRobot with Prometheus-only equivalents.
- Monitoring the Supabase-hosted database path (VPS stack uses Compose Postgres; Supabase metrics stay in Supabase dashboard if hybrid ever exists).
- CI running full monitoring stack on every PR (too heavy); static verify only unless explicitly added later.
- Separate monitoring VPS or HA Prometheus pair.

## Further Notes

- **Resource budget:** Contabo VPS has ~11 GiB RAM; monitoring stack should use modest limits; 30-day retention warrants a dashboard panel or alert on disk free space.
- **Certbot:** Re-run certificate issuance to include `monitoring.cycle-circle.com` when cutting over from bootstrap/self-signed configs.
- **Dependency graph:** Public Grafana vhost ticket should **block on** VPS hardening ticket 07; DNS ticket can proceed in parallel with repo work.
- **Seams confirmation:** Implementation should treat **merged Compose config + monitoring artifact verify** as the one required automated test seam unless the user explicitly requests runtime smoke in CI.
