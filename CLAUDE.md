## Project Overview

**Cycle Circle** (code name **Vesta**) is a bilingual (English + Bengali) reproductive health and cycle intelligence platform for Bangladesh. Users track periods, symptoms, and cycle predictions across up to 6 family profiles, with Pro billing via BDApps CAAS. The rename is user-facing only: internal identifiers (`@vesta/*`, `VESTA_*`, cookies, storage keys, file/component names, infra names) stay `vesta` — do not "fix" them. See `docs/adr/0001-cycle-circle-rename-is-user-facing-only.md`.

## Working Principles

1. **Ask clarification questions** before implementing — never assume when intent is ambiguous.
2. **95% surety threshold** — only proceed with implementation when you are 95% confident the approach is correct. If below that, ask.

---

## Import Conventions

Within each app, `@/` maps to `./src/*` via tsconfig paths.

Shared code uses the `@vesta/shared` package:

| Old path | New path |
|---|---|
| `@/server/db` | `@vesta/shared` (prisma re-exported from index) |
| `@/server/auth` | `@vesta/shared/server/auth` |
| `@/server/adapters/*` | `@vesta/shared/server/adapters/*` |
| `@/lib/types` | `@vesta/shared/types` |
| `@/lib/cycle-utils` | `@vesta/shared/utils/cycle-utils` |
| `@/lib/i18n` | `@vesta/shared/utils/i18n` |
| `@/lib/env` | `@vesta/shared/utils/env` |
| `@/lib/config` | `@vesta/shared/utils/config` |

App-specific files stay as `@/lib/*` and `@/components/*`:
`store`, `api`, `api-mappers`, `hydrate-store`, `post-auth`, `dummy-data`

## Gotchas (not derivable from the code)

- All Prisma operations run from `packages/shared/`.
- Prisma targets PostgreSQL (self-hosted on the VPS in prod). RLS was never built into the schema; isolation is app-layer `userId` scoping (`docs/ops/03-deployment.md`, "Supabase / RLS finding").
- QStash is **not yet wired** — cron email is sent synchronously; prod runs on the VPS and a host crontab calls the cron routes (see `docs/ops/05-operations.md`), not Vercel Cron.

## Key References

| What | Where |
|---|---|
| Local development setup | `docs/LOCAL-DEVELOPMENT.md` |
| Prod VPS access, setup, deploy, ops (Contabo) | `docs/ops/README.md` |
| Implementation status | `DEV_SRS.md` |
| Sprint checklist | `CHECKLIST.md` |
| Full SRS (IEEE 830) | `docs/vesta/source/SRS.md` |
| Web UI review | `review/WEB-UI-REVIEW.md` (2026-05-30) |
| Admin UI review | `review/ADMIN-UI-REVIEW.md` (2026-05-30) |
| Architecture fix plan | `review/FIX-PLAN.md` (2026-05-29) |

Subdirectory memory (loads when you work under that path): `apps/admin/CLAUDE.md` (admin app), `packages/shared/CLAUDE.md` (shared services layer).

- Frontend code: read `CODING_STANDARDS.md` before writing or reviewing it.

---

## Agent skills

### Issue tracker

GitHub Issues on `adibahsan/cycle-circle` via the `gh` CLI; specs are parent issues, tickets are sub-issues with native blocking links. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` at repo root and ADRs in `docs/adr/`. See `docs/agents/domain.md`.

### Cursor orchestration

- Running implement-orchestrated from Cursor: read `docs/agents/implement-orchestrated.md`.
- Ticket worktrees (any orchestrator): `scripts/new-worktree.sh <n> <slug> [base]` creates one ready for typecheck/lint/vitest, with its own E2E slot and vitest DB (briefs need no isolation setup); `--remove <n>` cleans up.

---

## MCP Tools: code-review-graph

When the `code-review-graph` MCP server is connected, reach for it before Grep/Glob/Read: it answers structural questions (callers, dependents, impact radius, test coverage) in fewer tokens than file scanning.

- **Exploring code**: `semantic_search_nodes` or `query_graph`
- **Impact of a change**: `get_impact_radius`
- **Code review**: `detect_changes` + `get_review_context`
- **Relationships**: `query_graph` with callers_of / callees_of / imports_of / tests_for
- **Architecture**: `get_architecture_overview` + `list_communities`

The graph is built per branch and can lag the working tree; when it's disconnected, stale, or doesn't cover the question, use Grep/Glob/Read. `/mcp` lists its tools and shows whether it's connected.
