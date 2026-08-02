## Project Overview

**Vesta** is a bilingual (English + Bengali) reproductive health and cycle intelligence platform for Bangladesh. Users track periods, symptoms, and cycle predictions across up to 6 family profiles, with Pro billing via BDApps CAAS.

## Working Principles

1. **Ask clarification questions** before implementing — never assume when intent is ambiguous.
2. **95% surety threshold** — only proceed with implementation when you are 95% confident the approach is correct. If below that, ask.
3. **Deploy multiple Sonnet 4.6 subagents** for every planning and implementation task — parallelize independent workstreams.

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
- Prisma targets PostgreSQL on Supabase with **RLS** enabled.
- QStash is **not yet wired** — cron email is sent synchronously; Vercel Cron handles scheduling in prod.

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

Subdirectory memory (loads when you work under that path): `apps/admin/CLAUDE.md` (admin app), `packages/shared/CLAUDE.md` (shared services layer).

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

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need. Run `code-review-graph` with no args (or see `/mcp`) for the full tool list.
