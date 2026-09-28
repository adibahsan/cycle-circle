# 02: VPS repo clone and GitHub deploy key

**Status:** resolved

**What to build:** The `vesta` user on the VPS can pull the repo into `/opt/vesta` using a read-only deploy key, with Compose defaulting to the prod file.

**Blocked by:** 01 (merge deploy to main)

- [x] Ed25519 deploy key created on VPS (`~/.ssh/vesta_deploy_key`), public key added to GitHub repo **Deploy keys** (read-only)
- [x] `~/.ssh/config` on VPS uses that key for `github.com`; `ssh -T git@github.com` → `Hi adibahsan/cycle-circle!`
- [x] Repository cloned to `/opt/vesta` from `main` (or chosen release ref) — `main` @ `1c1d582` (2026-09-28)
- [x] `export COMPOSE_FILE=/opt/vesta/ops/deploy/compose.prod.yml` in `vesta` user shell profile
- [x] `sg docker -c 'docker compose version'` succeeds for `vesta`

## Comments

- Clone used `git init` + shallow `fetch origin main` in existing `/opt/vesta` (preserves `backups/`).
