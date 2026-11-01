#!/usr/bin/env bash
# Regenerate the Prisma client when a merge or checkout changed the schema or migrations, so
# typecheck, vitest and E2E builds in this checkout never run against a stale client.
#   scripts/regen-prisma-if-changed.sh <old-rev> <new-rev>
set -euo pipefail
old="${1:-}" new="${2:-HEAD}"
# A brand-new worktree has no previous HEAD; scripts/new-worktree.sh generates the client there.
[[ -z "$old" || "$old" =~ ^0+$ ]] && exit 0
cd "$(git rev-parse --show-toplevel)"
[[ -d node_modules ]] || exit 0
if ! git diff --quiet "$old" "$new" -- packages/shared/prisma/; then
  echo "prisma schema changed: regenerating the client (pnpm db:generate)"
  pnpm db:generate >/dev/null || echo "warning: pnpm db:generate failed; run it by hand" >&2
fi
