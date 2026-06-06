# Vesta

Vesta is a bilingual reproductive health and cycle intelligence platform for Bangladesh. The project is structured as a pnpm monorepo with a customer-facing app, an admin panel, and a shared code package.

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
apps/admin/            Next.js admin panel (scaffold for Phase 04)
packages/shared/       @vesta/shared — Prisma schema, server logic, auth, adapters, types
ops/docker/            Docker Compose stack (postgres, redis, mailpit, worker)
ops/vendor/bdapps/     Read-only BDApps SDK for simulator image
ops/simulator/bdapps/  Local BDApps simulator for testing
docs/vesta/source/     Canonical Vesta source docs (SRS, knowledge base, user stories)
docs/vesta/exports/    Generated artifacts (DOCX SRS)
docs/site/             Client-facing documentation site
docs/archive/          Archived research (Flo competitor analysis)
.planning/             Implementation plans, roadmap, research
scripts/               Repo maintenance scripts (docs sync, SRS export)
```

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
