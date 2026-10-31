# implement-orchestrated on Cursor

Use when running Matt Pocock’s **implement-orchestrated** skill from **Cursor** (not Claude Code agent-bridge). The skill file lives at `~/.claude/plugins/cache/ryoshumei/implement-orchestrated/0.1.6/skills/implement-orchestrated/SKILL.md`; this doc overrides repo-specific mechanics.

### Provider routing (Cursor)

- **Orchestrator:** the main Cursor Agent session. It does not write feature code.
- **Coders:** Cursor **Task** subagents (`generalPurpose`), up to **3** concurrent. Do **not** use `agent-bridge`, `cursor-agent` CLI, or `isolation: "worktree"` (Claude-only).
- **Reviewers:** Cursor **Task** with `subagent_type: "reviewer"` (read-only brief). Fallback: `generalPurpose` with an explicit read-only reviewer brief.
- **Final review:** personal skill at `~/.claude/skills/code-review/SKILL.md` (Matt’s two-axis review), then a `reviewer` Task for the final gate brief.

Skip bridge preflight (`agent-bridge status`, `cursor-agent` / `opencode` / `agy` on PATH).

### Worktrees

Cursor has no built-in per-ticket worktree isolation. The orchestrator creates one worktree per ticket with the repo script, which copies the gitignored `.env.local` files, installs dependencies and generates the Prisma client:

```bash
# From main checkout on feat/<feature-slug>, after prior merges:
scripts/new-worktree.sh <NN> <slug> HEAD
```

- **Base ref:** branch from **current `HEAD`** on the feature branch (same intent as Claude `worktree.baseRef: "head"`). Stay on `feat/<feature-slug>` in the main checkout; do not branch coders from `origin/main` while the feature branch is ahead.
- **Fix rounds:** reuse the same worktree path; do not spawn a second worktree for the same ticket.
- **Cleanup:** after merge, `scripts/new-worktree.sh --remove <NN>`.

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
