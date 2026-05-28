## Project Overview

**Vesta** is a bilingual (English + Bengali) reproductive health and cycle intelligence platform for Bangladesh. Users track periods, symptoms, and cycle predictions across up to 6 family profiles, with Pro billing via BDApps CAAS.

## Working Principles

1. **Ask clarification questions** before implementing — never assume when intent is ambiguous.
2. **95% surety threshold** — only proceed with implementation when you are 95% confident the approach is correct. If below that, ask.
3. **Deploy multiple Sonnet 4.6 subagents** for every planning and implementation task — parallelize independent workstreams.

---

## Monorepo Layout

```
apps/web/            Customer-facing Next.js 16 app (port 3000)
apps/admin/          Admin panel Next.js app (port 3001, scaffold — Phase 04)
packages/shared/     @vesta/shared: Prisma, server logic, auth, adapters, types, utils
ops/                 Docker Compose, BDApps simulator, vendor SDK
docs/                SRS, knowledge base, client site
.planning/           GSD planning (PROJECT.md, ROADMAP.md, REQUIREMENTS.md, STATE.md)
scripts/             Build and sync scripts
```

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

## Development Workflow

| Command | What |
|---|---|
| `just w` | Start web dev server (port 3000) |
| `just a` | Start admin dev server (port 3001) |
| `just wa` | Start both in parallel |
| `just setup` | Copy env, start infra, reset DB, seed |
| `just typecheck` | Type-check web app |
| `just typecheck-all` | Type-check all packages |
| `just db-generate` | Generate Prisma client |
| `just db-migrate` | Create + apply migration |
| `just studio` | Open Prisma Studio |
| `just up` | Start all Docker services |
| `just infra` | Start only postgres, redis, mailpit |
| `just down` | Stop Docker services |

All Prisma operations run from `packages/shared/`.

## Tech Stack

Next.js 16, React 19, TypeScript, Tailwind CSS v4, Zustand (client state), i18next (bilingual EN+BN), Prisma (PostgreSQL on Supabase with RLS), Upstash Redis + QStash, BDApps (OTP, CAAS billing, SMS), Resend (transactional email).

## Key References

| What | Where |
|---|---|
| Implementation status | `DEV_SRS.md` |
| Sprint checklist | `CHECKLIST.md` |
| Full SRS (IEEE 830) | `docs/vesta/source/SRS.md` |
| Project vision | `.planning/PROJECT.md` |
| Roadmap | `.planning/ROADMAP.md` |
| Session continuity | `.planning/STATE.md` |

---

## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
