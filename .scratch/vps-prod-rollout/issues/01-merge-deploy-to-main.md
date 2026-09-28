# 01: Merge production deploy branch to main

**Status:** resolved

**What to build:** The `main` branch contains `ops/deploy/` and related docs so the VPS clones a single canonical release line.

**Blocked by:** None (can start immediately)

- [x] PR from `first-testing/bug-fixing` (includes commit `397031a` deploy stack) is reviewed and merged to `main` — PR #4 @ `1c1d582`
- [x] `main` builds prod images locally or on VPS without missing files (`ops/deploy/compose.prod.yml` present on `origin/main`)
- [x] Team agrees VPS will track `main` (or a release tag cut from it) for first deploy — VPS clone on `main` @ `1c1d582`

## Comments

- Branch already pushed to `origin/first-testing/bug-fixing` (2026-09-28).
- Agent work merged to `feat/vps-prod-rollout` @ `e15e681` (2026-09-28). Human: PR `feat/vps-prod-rollout` → `main` per [06-merge-to-main-runbook.md](../../../docs/ops/06-merge-to-main-runbook.md).

## Answer

**In-repo verification (ticket 01 coder pass):**

- Deploy stack present on merge source branches (`397031a` lineage); **`git show main:ops/deploy/compose.prod.yml` fails** — merge PR still required.
- Added `pnpm deploy:verify`, [docs/ops/deploy-artifacts-verification.md](../../../docs/ops/deploy-artifacts-verification.md), and [docs/ops/06-merge-to-main-runbook.md](../../../docs/ops/06-merge-to-main-runbook.md) with `gh pr` steps for the human.
- No open GitHub PR `first-testing/bug-fixing` → `main` at verification time (`gh pr list --base main --head first-testing/bug-fixing` empty).

**Acceptance (unchanged until human steps):**

- [ ] PR merged to `main` — human
- [ ] `main` builds / compose present — re-run `pnpm deploy:verify` on `main` after merge
- [ ] Team agrees VPS tracks `main` — human (see runbook §4)
