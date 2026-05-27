# Vesta

Vesta is a bilingual reproductive health and cycle intelligence workspace for Bangladesh. The active app lives under `apps/web`, while planning, source docs, static-site artifacts, and agent guidance live in dedicated top-level directories.

The full v1 requirements are documented in [docs/vesta/source/SRS.md](docs/vesta/source/SRS.md). Backend integrations such as BDApps OTP/CAAS/SMS, Supabase, Prisma, Upstash, Resend, API route handlers, webhooks, and admin persistence are specified in the docs and partially implemented in the workspace.

## Run Locally

```bash
pnpm install
pnpm dev
```

The web app runs on `http://localhost:3000`.

Useful checks:

```bash
pnpm build
pnpm docs:check
```

If `pnpm build` fails in a restricted sandbox because Turbopack cannot bind its internal worker port, rerun it in a normal local shell.

## Workspace Map

- `apps/web/` - Next.js application and tests.
- `docs/vesta/source/` - canonical Vesta source docs, planning notes, and editable HTML source pages.
- `docs/vesta/exports/` - generated export artifacts such as the DOCX SRS.
- `docs/site/index.html` - source for the client-facing documentation landing page.
- `static-site/` - publishable static documentation site.
- `planning/` - implementation plans, research, and roadmap material.
- `agent-instructions/` - canonical agent instruction files; root `AGENTS.md` and `CLAUDE.md` are thin shims.
- `tools/scripts/` - repo maintenance scripts, including docs sync helpers.
- `docs/archive/flo-research/` - archived Flo research retained for reference only.

## Client Docs Workflow

Author Vesta documentation in `docs/vesta/source/`. Generated exports belong in `docs/vesta/exports/`, and the client-facing site is synced into `static-site/`.

After changing client-facing HTML docs:

```bash
pnpm docs:sync
pnpm docs:check
```

`docs:sync` copies the published Vesta HTML pages and landing page source into `static-site/`. `docs:check` verifies that the static-site copies have not drifted from the source docs.

To rebuild the Word export for the client SRS:

```bash
HTML_TO_DOCX_DIR=/tmp/vesta-html-to-docx node tools/scripts/build-srs-docx.mjs
```

## BDApps Simulator

The simulator stack lives under `ops/simulator/bdapps/` and uses the vendor SDK runtime under `vendor/bdapps/sdk-standalone-1.2.68/`. That bulky bundle is intentionally retained because the simulator image copies it directly.

Use the workspace commands for local orchestration:

```bash
pnpm docker:dev
pnpm docker:down
```

See [ops/simulator/bdapps/README.md](ops/simulator/bdapps/README.md) for ports, smoke tests, and macOS port-7000 notes.
