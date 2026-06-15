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
apps/admin/          Admin panel Next.js app (port 3001)
packages/shared/     @vesta/shared: Prisma, server logic, auth, adapters, types, utils
ops/                 Docker Compose, BDApps simulator, vendor SDK
docs/                SRS, knowledge base, client site
scripts/             Build and sync scripts
review/              UI audits, fix plans, architecture reviews
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
| `just doctor` | Pre-flight checks for local development |
| `just setup-check` | Smoke-test Docker services |
| `just typecheck` | Type-check web app |
| `just typecheck-all` | Type-check all packages |
| `just db-generate` | Generate Prisma client |
| `just db-migrate` | Create + apply migration |
| `just studio` | Open Prisma Studio |
| `just up` | Start all Docker services (web in container) |
| `just infra` | Start postgres, redis, mailpit, bdapps-simulator |
| `just down` | Stop Docker services |

All Prisma operations run from `packages/shared/`.

## Tech Stack

Next.js 16, React 19, TypeScript, Tailwind CSS v4, Zustand (client state), i18next (bilingual EN+BN), Prisma (PostgreSQL on Supabase with RLS), Upstash Redis + QStash, BDApps (OTP, CAAS billing, SMS), Resend (transactional email).

## Key References

| What | Where |
|---|---|
| Local development setup | `docs/LOCAL-DEVELOPMENT.md` |
| Implementation status | `DEV_SRS.md` |
| Sprint checklist | `CHECKLIST.md` |
| Full SRS (IEEE 830) | `docs/vesta/source/SRS.md` |
| Web UI review | `review/WEB-UI-REVIEW.md` (2026-05-30) |
| Admin UI review | `review/ADMIN-UI-REVIEW.md` (2026-05-30) |
| Architecture fix plan | `review/FIX-PLAN.md` (2026-05-29) |

---

## Admin App

Single Super Admin account (email/password login at `/login`). Seeded via `packages/shared/prisma/seed.ts` with env vars `ADMIN_EMAIL` / `ADMIN_PASSWORD` (defaults: `admin@vesta.health` / `admin123`).

**Auth flow:** bcrypt password verification in `@vesta/shared/server/auth` (`verifyAdminLogin`), same JWT/cookie system as web app with `role=ADMIN` check in Edge proxy + server-side `requireAdminAuth()`.

**Pages:** Dashboard, Users (list + detail), Subscriptions, Content/CMS (Tiptap 3.x rich-text editor with EN/BN side-by-side), Analytics (Recharts 3.x), SMS Broadcasts, Feedback.

**Pattern:** RSC pages fetch data via `queries/*.ts` (thin `cache()` wrappers over shared services), pass to `*Client.tsx` components. Mutations go through `actions/*.ts` (thin `'use server'` wrappers over shared services + `revalidatePath`).

**Env:** Admin needs only `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` — does not need BDApps or CRON_SECRET (these are optional in shared env.ts).

---

## Shared Services Layer

11 pure async service modules in `packages/shared/src/server/services/` — no Next.js dependencies. Both apps use thin wrappers (auth + validation + revalidatePath/cache).

| Service | Scope |
|---------|-------|
| `profile-service` | CRUD, 6-profile cap, ownership checks |
| `tracking-service` | Period logs, symptoms, dashboard/calendar data |
| `content-service` | Article/category CRUD, published article listing |
| `feedback-service` | Create, list, export feedback |
| `notification-service` | Notification preference upsert |
| `user-service` | Profile completion, suspend/reactivate/soft-delete |
| `subscription-service` | Grant/revoke Pro, list subscriptions |
| `audit-service` | Admin audit log creation |
| `analytics-service` | Dashboard stats, trends, distributions, retention |
| `sms-service` | Broadcast CRUD |
| `export-service` | CSV generation (feedback, users) |

Import via `@vesta/shared/server/services`.

---

## UI/Accessibility Guidelines

Both apps share the same UI primitives (`Button`, `Input`, `Card`, etc.) and `globals.css`. When writing or modifying frontend code, follow these rules:

### Must-follow rules

- **No `transition-all`** — list specific properties (`transition-colors`, `transition-transform`)
- **`focus-visible:ring-*`** on every interactive element — never remove outline without visible replacement
- **`aria-hidden="true"`** on decorative icons (Lucide icons used as visual indicators)
- **`aria-label`** on icon-only buttons (icon + no visible text = needs label)
- **`<label htmlFor>`** linked to inputs via matching `id` — labels must be clickable
- **`aria-live="polite"`** on regions that update asynchronously (toasts, confirmations, errors)
- **`<Link>`** for navigation, `<button>` for actions — never `<div onClick>` for either
- **Sanitize HTML** before `dangerouslySetInnerHTML` (use DOMPurify or equivalent)
- **`role="dialog"` + `aria-modal` + ESC-to-close** on all modal/drawer overlays
- **`overscroll-behavior: contain`** inside modals and drawers

### Prefer

- `focus-visible:` over `focus:` (avoids focus ring on mouse click)
- `Intl.DateTimeFormat` / `Intl.NumberFormat` over hardcoded locale strings
- `font-variant-numeric: tabular-nums` on number columns and counters
- `@media (prefers-reduced-motion: reduce)` to disable/reduce animations
- `color-scheme: dark` on `<html>` when dark theme is active
- Semantic HTML (`<dialog>`, `<nav aria-label>`, `role="tablist"`) before custom ARIA
- Placeholders ending with `…` (ellipsis character, not three dots)
- `autocomplete` and `name` on all form inputs
- `spellCheck={false}` on emails, codes, usernames

### Review documents

Full file-by-file audits with line numbers are in `review/`:
- `review/WEB-UI-REVIEW.md` — web app audit (2026-05-30)
- `review/ADMIN-UI-REVIEW.md` — admin app audit (2026-05-30)
- `review/FIX-PLAN.md` — architecture migration plan (2026-05-29)

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
