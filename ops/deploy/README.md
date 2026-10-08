# Production deploy (`ops/deploy`)

Docker Compose stack for the Contabo VPS. Full runbook: [docs/ops/03-deployment.md](../../docs/ops/03-deployment.md).

## Merge readiness (VPS v1)

Before the first VPS deploy, **`main` must include this directory** (especially `compose.prod.yml`). That stack landed on **`first-testing/bug-fixing`** (deploy commit **`397031a`**); open a PR from that branch into **`main`**, review, and merge.

| Check | Action |
|---|---|
| Canonical clone branch | The VPS tracks **`production`**, and a push to it deploys through `.github/workflows/production.yml` → `scripts/deploy.sh` (see `docs/ops/03-deployment.md` §5) |
| Prod compose file on `main` | Confirm `test -f ops/deploy/compose.prod.yml` after merge |
| Local prod image build | From repo root: `pnpm docker:prod:build` (runs `docker compose -f ops/deploy/compose.prod.yml build web admin`) |

CI on the merge source branch should pass `pnpm typecheck`, `pnpm lint`, and `pnpm docs:check` before merge.

## Layout

| Path | Purpose |
|---|---|
| `compose.prod.yml` | nginx, certbot, web, admin, postgres, redis, monitoring (via `include`) |
| `Dockerfile.web` / `Dockerfile.admin` | Multi-stage prod images |
| `nginx/cycle-circle.bootstrap.conf` | HTTP-only until TLS certs exist (default) |
| `nginx/cycle-circle.conf` | HTTPS + redirects (after certbot) |
| `env/*.example` | Templates for `/opt/vesta/.env.*.production` |
| `vesta-crontab` | App crons, cert renewal, backups |
| `scripts/backup-db.sh` | Nightly `pg_dump` (referenced by crontab) |

## TLS bootstrap

Nginx cannot load `cycle-circle.conf` until Let's Encrypt files exist. The compose file defaults to **`cycle-circle.bootstrap.conf`** (port 80 only, no HTTPS redirect).

After successful certbot, switch nginx to the Let's Encrypt config (nginx reads the certbot volume directly):

```bash
cd /opt/vesta
chmod +x ops/deploy/scripts/apply-letsencrypt-nginx.sh
./ops/deploy/scripts/apply-letsencrypt-nginx.sh
```

Non-secret cert metadata for the repo: run `./ops/deploy/scripts/dump-le-metadata.sh` and merge into `ops/deploy/tls/production-inventory.json`. **Never commit `privkey.pem`.**

## Staging vs go-live

| Concern | Staging | Production |
|---|---|---|
| `DEV_MODE` in `.env.web.production` | `true` | `false` |
| `NEXT_PUBLIC_DEV_MODE` | Set `NEXT_PUBLIC_DEV_MODE=true` in `ops/deploy/.env`, then **rebuild web** | `false` (compose default) |

## Quick commands

```bash
export COMPOSE_FILE=/opt/vesta/ops/deploy/compose.prod.yml
cd /opt/vesta

docker compose build
docker compose up -d --wait postgres redis
docker compose run --rm --entrypoint sh web -c \
  'cd packages/shared && pnpm exec prisma migrate deploy --schema ./prisma/schema.prisma'
docker compose up -d
```

Routine release: [docs/ops/03-deployment.md §5](../../docs/ops/03-deployment.md#5-routine-deploy).

## Monitoring

Prometheus + Grafana merge via `include` in `compose.prod.yml` ([ops/monitoring/README.md](../monitoring/README.md)). Issue or renew TLS with **`monitoring.cycle-circle.com`** on the certbot `-d` list (see deployment doc). Do not expose Prometheus on nginx — Grafana only.
