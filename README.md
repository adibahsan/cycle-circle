# Vesta

Vesta is a bilingual reproductive health and cycle intelligence prototype for Bangladesh. The current application is a Next.js 16 / React 19 UI prototype with local Zustand persistence, dummy data, simulated OTP/email login, multi-profile cycle tracking, bilingual UI state, and client-side product flows.

The full v1 product requirements are documented in [docs/vesta/SRS.md](docs/vesta/SRS.md). Backend integrations such as BDApps OTP/CAAS/SMS, Supabase, Prisma, Upstash, Resend, API route handlers, webhooks, and admin persistence are specified but not implemented yet.

## Run Locally

```bash
pnpm install
pnpm dev
```

The dev server runs on `http://localhost:3000`.

Useful checks:

```bash
pnpm build
pnpm docs:check
```

If `pnpm build` fails in a restricted sandbox because Turbopack cannot bind its internal worker port, rerun it in a normal local shell.

## Documentation Map

- `docs/vesta/SRS.md` - canonical Software Requirements Specification.
- `docs/vesta/vesta-prd.md` - product requirements and planning notes.
- `docs/vesta/contract.md` - implementation contract and scope notes.
- `docs/vesta/charging-flow.md` - BDApps charging and subscriber flow.
- `docs/vesta/vesta-kb.md` - working knowledge base.
- `docs/vesta/*.html` - editable/static Vesta documentation pages.
- `netlify-vesta/` - client-facing static documentation site deployed to Netlify.
- `docs/archive/flo-research/` - archived Flo research used as reference material.

## Client Docs Workflow

Use `docs/vesta/` as the source area for Vesta documentation. The Netlify deploy folder is intentionally kept in the repo so clients can view the static documentation site.

After changing client-facing HTML docs:

```bash
pnpm docs:sync
pnpm docs:check
```

`docs:sync` copies the published Vesta HTML pages from `docs/vesta/` into `netlify-vesta/vesta/`. `docs:check` verifies that the deployed Netlify copies have not drifted from the source docs.

## BDApps Simulator

The Docker setup in `docker/bdapps-simulator/` uses the vendor SDK runtime under `Developer_Bundle/sdk-standalone-1.2.68/`. That bulky vendor bundle is intentionally retained because the simulator image copies it directly.

Run from the simulator directory:

```bash
docker compose up --build
```

See [docker/bdapps-simulator/README.md](docker/bdapps-simulator/README.md) for ports, smoke tests, and macOS port-7000 notes.
