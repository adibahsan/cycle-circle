# Cycle Circle

Cycle Circle (code name Vesta) is a bilingual reproductive health and cycle intelligence platform for Bangladesh. The project is structured as a pnpm monorepo with a customer-facing app, an admin panel, and a shared code package.

The product was renamed from Vesta to Cycle Circle in v2.0.0. The rename is user-facing only: package scope, env vars, cookies, storage keys, file names and infra names stay `vesta` on purpose. See [ADR 0001](docs/adr/0001-cycle-circle-rename-is-user-facing-only.md) before "fixing" any remaining `vesta` identifier.

The full v1 requirements are documented in [docs/vesta/source/SRS.md](docs/vesta/source/SRS.md). Implementation progress is tracked in [DEV_SRS.md](DEV_SRS.md).

**New contributors:** see [docs/LOCAL-DEVELOPMENT.md](docs/LOCAL-DEVELOPMENT.md) for prerequisites, Docker setup, ports, and troubleshooting.

## Prerequisites

Docker Desktop, Node 22, pnpm 10 (`corepack enable`), and [just](https://github.com/casey/just).

## Run Locally

```bash
pnpm install
just doctor    # optional pre-flight
just setup
just w
```

Or start both apps:

```bash
just wa
```

The web app runs on `http://localhost:3000`, admin on `http://localhost:3001`.

## Quick Commands

| Command | What |
|---|---|
| `just w` | Start web dev server |
| `just a` | Start admin dev server |
| `just wa` | Start both |
| `just setup` | Full local setup (env, infra, DB reset, seed) |
| `just doctor` | Pre-flight checks (tools, ports, env) |
| `just setup-check` | Smoke-test Docker services after setup |
| `just typecheck` | Type-check web app |
| `just studio` | Open Prisma Studio |
| `just up` | Start all Docker services (including web in container) |
| `just infra` | Start infrastructure (postgres, redis, mailpit, bdapps-simulator) |

Run `just` to see all available commands.

## Repository Map

```
apps/web/              Next.js customer app (Prisma, API routes, UI)
apps/admin/            Next.js admin panel (users, subscriptions, content, SMS campaigns, analytics)
packages/shared/       @vesta/shared — Prisma schema, server logic, auth, adapters, types
e2e/                   Playwright E2E against production builds, with a fake BDApps (e2e/README.md)
ops/docker/            Docker Compose stack (postgres, redis, mailpit, worker)
ops/deploy/            Production Compose stack, nginx, deploy scripts
ops/vendor/bdapps/     Read-only BDApps SDK for simulator image
ops/simulator/bdapps/  Local BDApps simulator for testing
docs/vesta/source/     Canonical Vesta source docs (SRS, knowledge base, user stories)
docs/vesta/exports/    Generated artifacts (DOCX SRS)
docs/site/             Client-facing documentation site
docs/ops/              Production runbooks and the release log
docs/archive/          Archived research (Flo competitor analysis)
.planning/             Implementation plans, roadmap, research
scripts/               Repo maintenance scripts (docs sync, SRS export)
```

## Tests and Checks

```bash
pnpm --filter @vesta/web test:changed     # vitest for what you changed (add a ref, e.g. HEAD~2)
pnpm --filter @vesta/shared test:changed
pnpm e2e -- tests/web/<spec>.spec.ts      # one E2E spec (production build, fake BDApps)
pnpm predeploy                            # full set before a production push
```

While developing, run what the change touches, plus the E2E specs [e2e/COVERAGE.md](e2e/COVERAGE.md) lists for a behaviour change. `pnpm predeploy` runs typecheck, lint, docs and drift checks, all vitest suites (also in two time zones) and the full E2E suite. See [docs/LOCAL-DEVELOPMENT.md](docs/LOCAL-DEVELOPMENT.md), "Checks before a deploy".

## Releases

Current release: **[v2.4.2](https://github.com/adibahsan/cycle-circle/releases/tag/2.4.2)** (2026-11-02): reminder SMS to masked subscriber ids, the User's saved language for reminders and emails, corrected OTP and magic-link copy, and the 6-profile limit message. All releases: [GitHub Releases](https://github.com/adibahsan/cycle-circle/releases).

Production runs the `production` branch on the VPS. Work merges to `main` by PR; a release is:

1. `pnpm predeploy` on `main`.
2. Add the release to [docs/ops/10-release-log.md](docs/ops/10-release-log.md), then tag `main` (`git tag -a 2.x.y`).
3. `git push origin origin/main:production`. GitHub Actions run the checks, then `ops/deploy/scripts/deploy.sh` (DB backup, migrations, restart, production-mode checks).
4. Publish the GitHub Release for the tag.

Details and rollback: [docs/ops/03-deployment.md](docs/ops/03-deployment.md) §5.

## Client Docs Workflow

Author docs in `docs/vesta/source/`. The client-facing site lives in `docs/site/`.

```bash
pnpm docs:sync      # Sync source docs to docs/site/
pnpm docs:check     # Verify docs/site/ hasn't drifted from source
```

To rebuild the Word export:

```bash
HTML_TO_DOCX_DIR=/tmp/vesta-html-to-docx node scripts/build-srs-docx.mjs
```

## BDApps Simulator

The simulator stack lives under `ops/simulator/bdapps/` and uses the vendor SDK at `ops/vendor/bdapps/sdk-standalone-1.2.68/`.

```bash
just infra       # Start Docker infra (includes BDApps simulator)
just down        # Stop everything
```

See [ops/simulator/bdapps/README.md](ops/simulator/bdapps/README.md) for ports and smoke tests.
