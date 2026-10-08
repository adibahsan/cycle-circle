# Merge deploy stack to `main` (human runbook)

VPS production v1 expects a **single canonical branch**: clone `/opt/vesta` from `main` (or a release tag cut from `main`). The deploy stack lives on feature branches until this merge completes.

**Source branches (same deploy commits as of 2026-09-28):**

- `origin/first-testing/bug-fixing` — includes deploy stack commit **`397031a`** (`Add VPS production deploy stack…`)
- `feat/vps-prod-rollout` — rollout tickets + same deploy lineage (may be ahead with docs only)

### Which branch to merge (read this first)

Commit **`397031a`** (`ops/deploy/`) is on both `first-testing/bug-fixing` and `feat/vps-prod-rollout`. **Ticket 01 adds this runbook, `pnpm deploy:verify`, and `scripts/verify-deploy-assets.mjs` on the rollout line only** — they are **not** on `origin/first-testing/bug-fixing` until you integrate them.

The PR into `main` must include **both**:

1. The deploy stack under `ops/deploy/` (anchor `397031a`)
2. Ticket 01 verification tooling (`deploy:verify` script + docs in this file and [deploy-artifacts-verification.md](./deploy-artifacts-verification.md))

**Recommended:** merge `ticket/01-merge-deploy-to-main` (or its commits) into **`feat/vps-prod-rollout`**, push, then open **`feat/vps-prod-rollout` → `main`**.

**Alternative:** cherry-pick ticket 01 onto **`first-testing/bug-fixing`**, push, then open **`first-testing/bug-fixing` → `main`**.

Do **not** merge `first-testing/bug-fixing` alone if that branch lacks `deploy:verify` — `main` would miss the inventory check documented in §3.

---

## Preconditions

- [ ] Review [deploy-artifacts-verification.md](./deploy-artifacts-verification.md) — `pnpm deploy:verify` passes on the PR branch
- [ ] Review diff under `ops/deploy/` and `docs/ops/` (no secrets in git)
- [ ] CI green on the PR (if configured)

---

## 1. Open or find the PR

```bash
cd /path/to/cycle-circle
git fetch origin

# Compare what main is missing
git log main..origin/first-testing/bug-fixing --oneline

# List open PRs into main
gh pr list --base main --head feat/vps-prod-rollout
gh pr list --base main --head first-testing/bug-fixing
```

If no PR exists (use the head branch that includes ticket 01 — see above):

```bash
gh pr create \
  --base main \
  --head feat/vps-prod-rollout \
  --title "Merge VPS production deploy stack to main" \
  --body "$(cat <<'EOF'
## Summary
- Adds `ops/deploy/` (Compose, Dockerfiles, nginx, env examples) and ops handbook updates for Contabo VPS v1.
- Deploy stack anchor commit: `397031a`.

## Test plan
- [ ] `pnpm deploy:verify` on PR branch
- [ ] Optional: `pnpm docker:prod:build` on a machine with Docker
- [ ] After merge: VPS will clone `main` (ticket 02+)

EOF
)"
```

Review in browser: `gh pr view --web`

---

## 2. Review focus

| Area | What to check |
|------|----------------|
| `ops/deploy/compose.prod.yml` | Services, volumes, `/opt/vesta` env_file paths |
| Dockerfiles | `NEXT_PUBLIC_*` build args on web image |
| nginx configs | bootstrap vs TLS config names |
| `docs/ops/03-deployment.md` | Matches checked-in files |
| Secrets | Only `*.example` env templates in git |

---

## 3. Merge to `main`

```bash
gh pr merge <number> --merge   # or --squash per team preference
git checkout main
git pull origin main
pnpm install && pnpm db:generate
pnpm deploy:verify
```

Record the merge SHA for VPS first clone (ticket 02):

```bash
git rev-parse --short HEAD
```

---

## 4. Team decision: VPS tracks `main`

> **Superseded (2026-10-09):** the VPS now tracks the **`production`** branch, which is deployed by GitHub Actions on push. See [03-deployment.md §5](./03-deployment.md). The original decision is kept below for history.

Agree in writing (Slack/issue comment):

- **Default:** VPS `git pull` on **`main`** for routine releases ([03-deployment.md](./03-deployment.md) § routine release).
- **Alternative:** tag `vps-v1.0.0` (or similar) at the merge commit and pin clone/checkout to that tag until process matures.

Document the choice in the rollout spec ([#5](https://github.com/adibahsan/cycle-circle/issues/5) or team channel). Ticket 01 acceptance item stays human-checked until confirmed.

---

## 5. After merge (not ticket 01 — forward pointers)

- Ticket **02:** clone repo on VPS, deploy key, `COMPOSE_FILE=/opt/vesta/ops/deploy/compose.prod.yml`
- Ticket **03+:** DNS, production env files on server, first stack bring-up

See [README.md](./README.md) doc index.
