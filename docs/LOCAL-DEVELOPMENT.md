# Local Development Guide

Hybrid setup for Vesta: **Docker** runs Postgres, Redis, Mailpit, and the BDApps simulator; **Next.js** apps run on your machine for fast hot reload.

For production deployment, see [DEPLOYMENT-PLAN.md](../DEPLOYMENT-PLAN.md). For QA on deployed environments, see [TESTING.md](../TESTING.md).

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Docker Desktop | Compose v2 | [docker.com](https://www.docker.com/products/docker-desktop/) |
| Node.js | 22.x | [nodejs.org](https://nodejs.org/) or `nvm install 22` |
| pnpm | 10.x | `corepack enable && corepack prepare pnpm@10.33.0 --activate` |
| just | latest | [github.com/casey/just](https://github.com/casey/just) |

**Resources:** ~4 GB RAM recommended when running the BDApps simulator (uses `linux/amd64` emulation on Apple Silicon).

---

## Quick start

```bash
git clone git@github.com:adibahsan/cycle-circle.git
cd cycle-circle
pnpm install
just doctor          # optional pre-flight
just setup           # env files, Docker infra, DB reset + seed
just wa              # web :3000 + admin :3001
```

Open:

- **Web:** http://localhost:3000
- **Admin:** http://localhost:3001/login
- **Mailpit (email):** http://localhost:8025
- **BDApps simulator UI:** http://localhost:10001/mchoice-tap-sdk

After setup, run `just setup-check` to verify Docker services.

---

## Architecture

```
Host                          Docker (just infra)
────                          ──────────────────
pnpm / Next.js web  :3000  →  postgres          :5431
pnpm / Next.js admin :3001 →  redis             :6379
                              mailpit           :8025 (UI), :1025 (SMTP)
                              bdapps-simulator  :10001 (UI), :7002 (REST)
```

Prisma CLI commands (`just db-*`, `just studio`) load env from `apps/web/.env.local` via the root [justfile](../justfile).

---

## Local service map

| Service | Host port | URL / credentials |
|---------|-----------|-------------------|
| Web app | 3000 | http://localhost:3000 |
| Admin panel | 3001 | http://localhost:3001/login |
| PostgreSQL | 5431 | `vesta_user` / `vesta_dev` |
| Redis | 6379 | optional; in-memory fallback if unset |
| Mailpit UI | 8025 | http://localhost:8025 |
| Mailpit SMTP | 1025 | `smtp://localhost:1025` |
| BDApps simulator UI | 10001 | http://localhost:10001/mchoice-tap-sdk |
| BDApps REST | 7002 | maps to container port 7000 |
| Grafana (optional) | 3030 | http://localhost:3030 — see [Monitoring overlay](#monitoring-overlay) |

---

## Monitoring overlay

Optional **Prometheus + Grafana** stack sharing prod dashboards. Start **after** Postgres/Redis are up (`pnpm docker:dev` or `just infra`).

```bash
pnpm docker:monitoring
```

- **URL:** http://localhost:3030 (default login in [ops/monitoring/env/monitoring.local.example](../ops/monitoring/env/monitoring.local.example) only — not production passwords)
- **Retention:** 7 days locally (30 days on VPS)
- **node_exporter** on macOS does not reflect real Mac host CPU/RAM; use container (cAdvisor) and Postgres/Redis panels locally.

Stop: `pnpm docker:monitoring:down`. Verify config in CI/review: `pnpm monitoring:verify`. Details: [ops/monitoring/README.md](../ops/monitoring/README.md).

---

## Environment files

| File | Purpose | Commit? |
|------|---------|---------|
| `apps/web/.env.example` | Web local template | Yes |
| `apps/web/.env.local` | Your web secrets | **No** (gitignored) |
| `apps/admin/.env.example` | Admin local template | Yes |
| `apps/admin/.env.local` | Your admin secrets | **No** (gitignored) |
| `apps/web/env.prod` | Production reference | **No** (gitignored) |

`just setup` copies `.env.example` → `.env.local` for both apps if missing.

**Important:** `JWT_SECRET` must be identical in web and admin `.env.local` (shared auth cookie).

### Notable env vars

| Var | App | Notes |
|-----|-----|-------|
| `MAILPIT_UI_URL` | web | Override Mailpit UI link (default `http://localhost:8025`) |
| `SEED_DEMO` | shared | Set `SEED_DEMO=true` in production to seed demo user + dummy users; omit (or set false) to seed admin only |
| `DIRECT_URL` | admin | Direct Postgres connection (port 5432, bypasses PgBouncer) — required for `prisma migrate resolve` and migrations |

---

## Default test credentials

| Context | Value |
|---------|-------|
| Admin login | `admin@vesta.health` / `admin123` |
| OTP bypass (when `DEV_MODE=true`) | `420420` or `840840` |
| BDApps simulator | `APP_SIMULATOR` / `simulator_password` |

---

## Common commands

| Command | What |
|---------|------|
| `just` | List all recipes |
| `just doctor` | Pre-flight: tools, ports, env files |
| `just setup` | First-time setup (env + infra + DB) |
| `just setup-check` | Smoke-test Docker services |
| `just w` / `just a` / `just wa` | Start web / admin / both |
| `just infra` | Start Docker infra only |
| `just down` | Stop Docker services |
| `just reset` | Flush Redis + reset DB + re-seed |
| `just studio` | Prisma Studio |
| `just typecheck-all` | Type-check entire monorepo |
| `just logs bdapps-simulator` | Follow simulator logs |

Run `just health` after the web app is running to probe API health routes.

### Browser e2e and screenshots (local only, orchestrator-run)

Playwright lives in `apps/web/e2e/`. These commands need Postgres (port 5431) and `DEV_MODE=true` in `apps/web/.env.local`. They start their own `next dev` on a free port, so they do not collide with port 3000. They are **not run in CI and not by ticket implementers**: run one at a time, from one machine.

| Command | What |
|---------|------|
| `pnpm --filter @vesta/web e2e` | Smoke + guard specs in `e2e/tests/`. Logs in once via `/api/auth/dev-login` (no OTP, so no rate limit) and reuses the saved session. First time: `pnpm --filter @vesta/web exec playwright install chromium` |
| `pnpm --filter @vesta/web e2e:shots --route /dashboard [--popup period-log] [--mock trial-expired]` | Light/dark x desktop 1366x900 / 375x667 / 390x844 PNGs in `review/screenshots/e2e/<label>/` (gitignored). Flags and the named pop-up and mock registries are documented in `e2e/screenshots/shoot.ts`. |

Guards for new UI go in `e2e/tests/*.spec.ts` using the helpers in `e2e/guards/helpers.ts`.

---

## Optional: full Docker (web in container)

For environments without local Node, or to mirror production containers:

```bash
just up          # builds and starts all compose services including web :3000
just dev-docker  # alias for just up
```

This is slower for day-to-day UI work (no native HMR). **Hybrid mode** (`just setup` + `just w`) is the recommended default.

---

## Troubleshooting

### Postgres connection refused

- Ensure Docker is running: `just ps`
- Wait for healthy status: `just infra` uses `--wait`
- Confirm `DATABASE_URL` uses port **5431** (not 5432)

### Port already in use

- **7000 on macOS:** AirPlay Receiver uses port 7000. The main compose file maps **7002:7000** — use `BDAPPS_SIMULATOR_BASE_URL=http://127.0.0.1:7002`.
- Check listeners: `lsof -nP -iTCP:5431 -sTCP:LISTEN`

### BDApps simulator not ready

First start can take up to ~90 seconds (healthcheck `start_period`). Check logs:

```bash
just logs bdapps-simulator
```

### Admin login fails

- Confirm `JWT_SECRET` matches between `apps/web/.env.local` and `apps/admin/.env.local`
- Re-seed: `just db-reset-force`

### Apple Silicon / arm64

The simulator image runs as `linux/amd64` under emulation. This is expected and may be slow on first boot.

---

## Related docs

- [README.md](../README.md) — repo overview
- [ops/simulator/bdapps/README.md](../ops/simulator/bdapps/README.md) — simulator details
- [CLAUDE.md](../CLAUDE.md) — agent / contributor conventions
