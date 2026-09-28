# 01: Merge production deploy branch to main

**Status:** ready-for-human

**What to build:** The `main` branch contains `ops/deploy/` and related docs so the VPS clones a single canonical release line.

**Blocked by:** None (can start immediately)

- [ ] PR from `first-testing/bug-fixing` (includes commit `397031a` deploy stack) is reviewed and merged to `main`
- [ ] `main` builds prod images locally or on VPS without missing files (`ops/deploy/compose.prod.yml` present)
- [ ] Team agrees VPS will track `main` (or a release tag cut from it) for first deploy

## Comments

- Branch already pushed to `origin/first-testing/bug-fixing` (2026-09-28).
