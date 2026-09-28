# 02: VPS repo clone and GitHub deploy key

**Status:** ready-for-human

**What to build:** The `vesta` user on the VPS can pull the repo into `/opt/vesta` using a read-only deploy key, with Compose defaulting to the prod file.

**Blocked by:** 01 (merge deploy to main)

- [ ] Ed25519 deploy key created on VPS (`~/.ssh/vesta_deploy_key`), public key added to GitHub repo **Deploy keys** (read-only)
- [ ] `~/.ssh/config` on VPS uses that key for `github.com`
- [ ] Repository cloned to `/opt/vesta` from `main` (or chosen release ref)
- [ ] `export COMPOSE_FILE=/opt/vesta/ops/deploy/compose.prod.yml` in `vesta` user shell profile
- [ ] `sg docker -c 'docker compose version'` succeeds for `vesta`
