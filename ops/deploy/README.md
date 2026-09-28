# Production deploy (`ops/deploy`)

Docker Compose stack for the Contabo VPS. Full runbook: [docs/ops/03-deployment.md](../../docs/ops/03-deployment.md).

## Merge readiness (VPS v1)

Before the first VPS deploy, **`main` must include this directory** (especially `compose.prod.yml`). That stack landed on **`first-testing/bug-fixing`** (deploy commit **`397031a`**); open a PR from that branch into **`main`**, review, and merge.

| Check | Action |
|---|---|
| Canonical clone branch | VPS v1 clones and tracks **`main`** (or a release tag cut from it after merge) |
| Prod compose file on `main` | Confirm `test -f ops/deploy/compose.prod.yml` after merge |
| Local prod image build | From repo root: `pnpm docker:prod:build` (runs `docker compose -f ops/deploy/compose.prod.yml build web admin`) |

CI on the merge source branch should pass `pnpm typecheck`, `pnpm lint`, and `pnpm docs:check` before merge.

## Layout

| Path | Purpose |
|---|---|
| `compose.prod.yml` | nginx, certbot, web, admin, postgres, redis |
| `Dockerfile.web` / `Dockerfile.admin` | Multi-stage prod images |
| `nginx/cycle-circle.bootstrap.conf` | HTTP-only until TLS certs exist (default) |
| `nginx/cycle-circle.selfsigned.conf` | HTTPS with OpenSSL self-signed cert (staging) |
| `nginx/cycle-circle.conf` | HTTPS + redirects (after certbot) |
| `scripts/generate-selfsigned-cert.sh` | Create `/opt/vesta/ssl/*.pem` for self-signed nginx |
| `env/*.example` | Templates for `/opt/vesta/.env.*.production` |
| `vesta-crontab` | App crons, cert renewal, backups |
| `scripts/backup-db.sh` | Nightly `pg_dump` (referenced by crontab) |

## TLS bootstrap

Nginx cannot load `cycle-circle.conf` until Let's Encrypt files exist. The compose file defaults to **`cycle-circle.bootstrap.conf`** (port 80 only, no HTTPS redirect).

### Self-signed HTTPS (staging, before Let's Encrypt)

Use when you want **port 443** working immediately (browser security warning is expected):

```bash
cd /opt/vesta
mkdir -p ssl && chmod 700 ssl   # before first nginx recreate (avoids Docker creating ssl/ as root)
chmod +x ops/deploy/scripts/generate-selfsigned-cert.sh
./ops/deploy/scripts/generate-selfsigned-cert.sh   # writes /opt/vesta/ssl/{fullchain,privkey}.pem

# ops/deploy/.env — keep NEXT_PUBLIC_DEV_MODE if staging; switch nginx config:
grep -q '^NGINX_CONF=' ops/deploy/.env && \
  sed -i 's/^NGINX_CONF=.*/NGINX_CONF=cycle-circle.selfsigned.conf/' ops/deploy/.env || \
  echo 'NGINX_CONF=cycle-circle.selfsigned.conf' >> ops/deploy/.env

docker compose up -d --force-recreate nginx
curl -kfsS https://cycle-circle.com/api/health/db
```

Replace `cycle-circle.selfsigned.conf` with `cycle-circle.conf` after certbot (below). Self-signed certs are not trusted by browsers or webhooks — use Let's Encrypt before go-live.

After successful certbot:

```bash
cd /opt/vesta
echo 'NGINX_CONF=cycle-circle.conf' >> ops/deploy/.env
docker compose -f ops/deploy/compose.prod.yml up -d --force-recreate nginx
```

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
