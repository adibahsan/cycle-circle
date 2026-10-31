#!/usr/bin/env bash
# Create a ready-to-use worktree for one ticket:
#   git worktree at ../cycle-circle-wt-<n> on branch ticket/<n>-<slug>, based on <base>,
#   with the gitignored .env.local files copied in, dependencies installed and the
#   Prisma client generated. Typecheck, lint and vitest work there straight away.
#
# Usage: scripts/new-worktree.sh <n> <slug> [base]      (base defaults to HEAD)
#        scripts/new-worktree.sh --remove <n>           (remove worktree + its ticket branch)
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"
ENV_FILES=(apps/web/.env.local apps/admin/.env.local packages/shared/.env.local)

if [[ "${1:-}" == "--remove" ]]; then
  n="${2:?usage: $0 --remove <n>}"
  wt="../cycle-circle-wt-$n"
  branch="$(git -C "$wt" rev-parse --abbrev-ref HEAD)"
  git worktree remove --force "$wt"
  git branch -D "$branch"
  echo "removed $wt and $branch"
  exit 0
fi

n="${1:?usage: $0 <n> <slug> [base]}"
slug="${2:?usage: $0 <n> <slug> [base]}"
base="${3:-HEAD}"
wt="../cycle-circle-wt-$n"
branch="ticket/$n-$slug"

git worktree add -q "$wt" -b "$branch" "$base"
for f in "${ENV_FILES[@]}"; do
  if [[ -f "$f" ]]; then cp "$f" "$wt/$f"; else echo "warning: $f not found, skipped" >&2; fi
done
(cd "$wt" && pnpm install --frozen-lockfile >/dev/null && pnpm db:generate >/dev/null)
echo "ready: $wt on $branch @ $(git -C "$wt" rev-parse --short HEAD)"
