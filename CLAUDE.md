## Project Overview

**Cycle Circle** (code name **Vesta**) is a bilingual (English + Bengali) reproductive health and cycle intelligence platform for Bangladesh. Users track periods, symptoms, and cycle predictions across up to 6 family profiles, with Pro billing via BDApps CAAS. The rename is user-facing only: internal identifiers (`@vesta/*`, `VESTA_*`, cookies, storage keys, file/component names, infra names) stay `vesta` — do not "fix" them. See `docs/adr/0001-cycle-circle-rename-is-user-facing-only.md`.

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

## Agent skills

### Issue tracker

GitHub Issues on `adibahsan/cycle-circle` via the `gh` CLI; specs are parent issues, tickets are sub-issues with native blocking links. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` at repo root and ADRs in `docs/adr/`. See `docs/agents/domain.md`.

---

## implement-orchestrated

Use when running Matt Pocock’s **implement-orchestrated** skill from **Cursor** (not Claude Code agent-bridge). The skill file lives at `~/.claude/plugins/cache/ryoshumei/implement-orchestrated/0.1.6/skills/implement-orchestrated/SKILL.md`; this section overrides repo-specific mechanics.

### Provider routing (Cursor)

- **Orchestrator:** the main Cursor Agent session. It does not write feature code.
- **Coders:** Cursor **Task** subagents (`generalPurpose`), up to **3** concurrent. Do **not** use `agent-bridge`, `cursor-agent` CLI, or `isolation: "worktree"` (Claude-only).
- **Reviewers:** Cursor **Task** with `subagent_type: "reviewer"` (read-only brief). Fallback: `generalPurpose` with an explicit read-only reviewer brief.
- **Final review:** personal skill at `~/.claude/skills/code-review/SKILL.md` (Matt’s two-axis review), then a `reviewer` Task for the final gate brief.

Skip bridge preflight (`agent-bridge status`, `cursor-agent` / `opencode` / `agy` on PATH).

### Worktree bootstrap

Before the first typecheck in a **new** worktree:

```bash
pnpm install
pnpm db:generate
```

### Worktrees (manual)

Cursor has no built-in per-ticket worktree isolation. The orchestrator creates one worktree per ticket:

```bash
# From main checkout on feat/<feature-slug>, after prior merges:
git worktree add ../cycle-circle-wt-<NN> -b ticket/<NN>-<slug> HEAD
```

- **Base ref:** branch from **current `HEAD`** on the feature branch (same intent as Claude `worktree.baseRef: "head"`). Stay on `feat/<feature-slug>` in the main checkout; do not branch coders from `origin/main` while the feature branch is ahead.
- **Fix rounds:** reuse the same worktree path; do not spawn a second worktree for the same ticket.
- **Cleanup:** after merge, `git worktree remove ../cycle-circle-wt-<NN>` and delete `ticket/<NN>-<slug>`.

Put orchestration state under `/tmp/implement-orchestrated/<feature-slug>/state.md` (or the session scratchpad if one exists).

### Stateful checks

Only the orchestrator runs these, **one at a time** across all tickets:

- `pnpm docker:dev` / anything binding **5432, 6379, 3000, 3001** (local Compose stack).

Coders run **non-stateful** checks only.

### Full suite

From repo root on the feature branch (main checkout or after each merge):

```bash
pnpm typecheck && pnpm lint && pnpm docs:check
```

Optional before VPS-facing tickets: `pnpm docker:prod:build` (orchestrator only; can be slow).

### VPS rollout tickets

The VPS rollout spec (#5) and its sub-issues mix **human** steps (SSH, DNS, merge to `main`, UFW) with **agent** runbook/doc/script work. Coders must not pretend server steps are done—update checklists, ops docs, and repo scripts only unless the ticket explicitly includes verifiable local automation.

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
