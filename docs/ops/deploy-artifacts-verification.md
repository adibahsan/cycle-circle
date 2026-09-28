# Production deploy artifacts — verification checklist

Use this before merging deploy work to `main` and before the first VPS `docker compose build`. Automated check: `pnpm deploy:verify` from repo root.

**Last verified (agent, ticket 01):** on branch lineage containing commit `397031a` (`first-testing/bug-fixing` / `feat/vps-prod-rollout`). **`main` does not yet contain `ops/deploy/`** until the merge PR lands — re-run after merge on `main`.

---

## Required paths (`ops/deploy/` stack)

| Path | Role |
|------|------|
| `ops/deploy/compose.prod.yml` | Production Compose stack |
| `ops/deploy/Dockerfile.web` | Web prod image |
| `ops/deploy/Dockerfile.admin` | Admin prod image |
| `ops/deploy/README.md` | Compose/TLS/staging flags |
| `ops/deploy/.env.example` | Optional nginx / build overrides |
| `ops/deploy/env/*.production.example` | Host env templates (web, admin, postgres) |
| `ops/deploy/nginx/cycle-circle.conf` | TLS vhost |
| `ops/deploy/nginx/cycle-circle.bootstrap.conf` | Pre-cert bootstrap vhost |
| `ops/deploy/scripts/backup-db.sh` | DB backup helper |
| `ops/deploy/vesta-crontab` | Host cron template |
| `ops/docker/postgres/init.sql` | Postgres init (bind-mounted from compose) |
| `.dockerignore` | Docker build context |

## Related docs (should merge with the stack)

| Path | Role |
|------|------|
| `docs/ops/README.md` | Ops index |
| `docs/ops/03-deployment.md` | First deploy and releases |
| `docs/ops/04-env-reference.md` | Env var reference |
| `docs/ops/06-merge-to-main-runbook.md` | Human merge steps to `main` |

---

## Manual checks (after merge to `main`)

1. **Repo root on `main`:** `git checkout main && git pull && pnpm deploy:verify`
2. **Compose syntax (VPS or machine with Docker):** host env files at `/opt/vesta/.env.*.production` per [03-deployment.md](./03-deployment.md), then:
   ```bash
   docker compose -f ops/deploy/compose.prod.yml config
   ```
3. **Image build (optional, slow):** `pnpm docker:prod:build` — orchestrator or VPS; requires Docker and sufficient disk/RAM.

---

## Notes

- `docker compose config` on a dev laptop **fails** until `/opt/vesta/.env.web.production` (and siblings) exist — that is expected; file inventory is what `pnpm deploy:verify` covers locally.
