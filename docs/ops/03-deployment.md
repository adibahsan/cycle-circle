# Deployment

Docker Compose deploy of Vesta (web + admin + self-hosted Postgres + Redis) behind nginx on the Contabo VPS. For SSH access see [01-access.md](./01-access.md); for installing Docker/hardening the host see [02-server-setup.md](./02-server-setup.md); for env var meanings see [04-env-reference.md](./04-env-reference.md); for logs/backups/incidents see [05-operations.md](./05-operations.md).

**Status:** production deploy artifacts live under `ops/deploy/` (see [ops/deploy/README.md](../../ops/deploy/README.md)). Nginx uses **`cycle-circle.bootstrap.conf`** until Let's Encrypt certs exist, then set `NGINX_CONF=cycle-circle.conf` in `ops/deploy/.env` (documented in that README).

---

## 1. Architecture

```
                              Internet
                                 │
                         80/443 │  (only nginx is published)
                                 ▼
                      ┌────────────────────┐
                      │   nginx (edge)     │
                      │   TLS termination  │
                      │   cycle-circle.com     │──┐
                      │   admin.cycle-circle.com│  │ vhost routing on
                      └─────────┬──────────┘  │ Host header
                    proxy_pass  │              │
                     (X-Real-IP/X-Forwarded-For
                      overwritten to $remote_addr —
                      see §2 nginx conf notes)
                    ┌───────────┴────────────┐
                    ▼                        ▼
            ┌───────────────┐        ┌───────────────┐
            │  web :3000    │        │  admin :3001  │
            │  Next.js      │        │  Next.js      │
            │  (internal)   │        │  (internal)   │
            └───────┬───────┘        └───────┬───────┘
                    │                        │
        ┌───────────┴────────────┬───────────┘
        ▼                        ▼
┌───────────────┐        ┌───────────────┐
│ postgres :5432│        │  redis :6379  │
│ self-hosted   │        │  internal     │
│ named volume  │        │  (optional)   │
└───────────────┘        └───────────────┘

All services on one Docker Compose network at /opt/vesta. Only nginx
publishes host ports; web/admin/postgres/redis are internal-only.
```

### Ports

| Service | Container port | Published on host? | Notes |
|---|---|---|---|
| nginx | 80, 443 | Yes — 80, 443 | The **only** service exposed to the internet. |
| web | 3000 | No | Next.js, proxied by nginx at `cycle-circle.com` / `www.cycle-circle.com`. |
| admin | 3001 | No | Next.js, proxied by nginx at `admin.cycle-circle.com`. |
| postgres | 5432 | No | Self-hosted (not Supabase in prod). Named volume `postgres_data`. |
| redis | 6379 | No | Optional — in-memory fallback if the app can't reach it. |

---

## 2. To build before first deploy

Local dev remains under `ops/docker/*` (dev Dockerfile, Mailpit, simulator). Production uses **`ops/deploy/*`** — separate from dev on purpose.

The sections below retain the **reference sketches** aligned with the checked-in files; if they drift, trust the repo copies first.

| Artifact | Purpose |
|---|---|
| `ops/deploy/Dockerfile.web` | Multi-stage prod image for `apps/web`, `next build` + `next start` |
| `ops/deploy/Dockerfile.admin` | Same pattern for `apps/admin` |
| `ops/deploy/compose.prod.yml` | Prod Compose stack: nginx, certbot, web, admin, postgres, redis, monitoring (Prometheus/Grafana + exporters) |
| `ops/deploy/nginx/cycle-circle.conf` | TLS-terminating vhost config, based on `ops/docker/nginx/edge.conf` |
| `ops/deploy/vesta-crontab` | Host crontab: the two app crons + cert renewal |

### Dockerfile.web (proposed)

Node 24, pnpm 10.33.0 (matching `packageManager` in the root `package.json` and the dev Dockerfile). Neither `apps/web/next.config.ts` nor `apps/admin/next.config.ts` currently sets `output: 'standalone'`, so this sketch ships the full `node_modules` into the runtime stage — simplest correct option. Switching both `next.config.ts` files to `output: 'standalone'` later would let the runtime stage copy only `.next/standalone` + `.next/static` and drop the `node_modules` copy — worth doing as a follow-up, but out of scope for these two doc files.

**Critical gotcha:** `NEXT_PUBLIC_DEV_MODE` (and any future `NEXT_PUBLIC_*` var) is inlined into the client JS bundle **at `next build` time**, not read at container start. It must be passed as a build `ARG`, not just set in the container's runtime env — setting it in `.env.web.production` alone has no effect on the built bundle.

```dockerfile
# ops/deploy/Dockerfile.web  (proposed)
FROM node:24-alpine AS deps
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

FROM node:24-alpine AS build
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY --from=deps /workspace/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* vars are baked into the client bundle here — must be false in prod.
ARG NEXT_PUBLIC_DEV_MODE=false
ARG NEXT_PUBLIC_USE_DUMMY_DATA=false
ENV NEXT_PUBLIC_DEV_MODE=$NEXT_PUBLIC_DEV_MODE
ENV NEXT_PUBLIC_USE_DUMMY_DATA=$NEXT_PUBLIC_USE_DUMMY_DATA
RUN pnpm --filter @vesta/shared db:generate
RUN pnpm --filter @vesta/web build

FROM node:24-alpine AS runtime
WORKDIR /workspace
ENV NODE_ENV=production
COPY --from=build /workspace ./
EXPOSE 3000
CMD ["pnpm", "--filter", "@vesta/web", "start"]
```

`Dockerfile.admin` mirrors this exactly, swapping `@vesta/web` → `@vesta/admin` and `EXPOSE 3000` → `EXPOSE 3001`. Admin has no `NEXT_PUBLIC_*` vars to bake in (confirmed by grep — only `apps/web` references `process.env.NEXT_PUBLIC_DEV_MODE`).

### compose.prod.yml (proposed)

```yaml
# ops/deploy/compose.prod.yml  (proposed)
name: vesta

services:
  nginx:
    image: nginx:1.27-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/cycle-circle.conf:/etc/nginx/conf.d/default.conf:ro
      - certbot_www:/var/www/certbot:ro
      - certbot_conf:/etc/letsencrypt:ro
    depends_on: [web, admin]
    restart: unless-stopped

  # Invoked manually via `docker compose run --rm certbot ...` — never
  # auto-started by `up -d` (restart: "no", no long-running command).
  certbot:
    image: certbot/certbot:latest
    volumes:
      - certbot_www:/var/www/certbot
      - certbot_conf:/etc/letsencrypt
    restart: "no"

  web:
    build:
      context: ../..
      dockerfile: ops/deploy/Dockerfile.web
      args:
        NEXT_PUBLIC_DEV_MODE: "false"
        NEXT_PUBLIC_USE_DUMMY_DATA: "false"
    env_file: /opt/vesta/.env.web.production
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  admin:
    build:
      context: ../..
      dockerfile: ops/deploy/Dockerfile.admin
    env_file: /opt/vesta/.env.admin.production
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:17.10-alpine
    env_file: /opt/vesta/.env.postgres.production
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ../docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7.4.9-alpine
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  certbot_www:
  certbot_conf:
```

### nginx/cycle-circle.conf (proposed)

Based on `ops/docker/nginx/edge.conf`'s local template — carries forward its most important line unchanged: **`X-Real-IP` / `X-Forwarded-For` are always overwritten to `$remote_addr`, never passed through from the client.** `validateWebhookSource()` in `packages/shared/src/server/adapters/webhooks.ts` trusts `x-real-ip` (falling back to the first `x-forwarded-for` entry) to enforce `BDAPPS_WEBHOOK_IPS`. If nginx ever passed a client-supplied header through, the allowlist would be trivially spoofable.

TLS approach: **certbot container, webroot HTTP-01 challenge, renewal via host cron** (not a host-installed nginx+certbot — keeps everything inside `/opt/vesta`'s Compose stack, no extra host packages). See §"First deploy" for issuance and §"Routine deploy" area cron file for renewal.

```nginx
# ops/deploy/nginx/cycle-circle.conf  (proposed)
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

upstream vesta_web   { server web:3000; }
upstream vesta_admin { server admin:3001; }

# ACME HTTP-01 challenge + HTTP → HTTPS redirect for all three hostnames
server {
    listen 80;
    server_name cycle-circle.com www.cycle-circle.com admin.cycle-circle.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 301 https://$host$request_uri;
    }
}

# www → apex redirect
server {
    listen 443 ssl;
    server_name www.cycle-circle.com;
    ssl_certificate     /etc/letsencrypt/live/cycle-circle.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cycle-circle.com/privkey.pem;
    return 301 https://cycle-circle.com$request_uri;
}

server {
    listen 443 ssl;
    server_name cycle-circle.com;
    ssl_certificate     /etc/letsencrypt/live/cycle-circle.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cycle-circle.com/privkey.pem;

    location / {
        proxy_pass http://vesta_web;
        proxy_http_version 1.1;
        proxy_set_header Host              $http_host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        $connection_upgrade;
    }
}

server {
    listen 443 ssl;
    server_name admin.cycle-circle.com;
    ssl_certificate     /etc/letsencrypt/live/cycle-circle.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cycle-circle.com/privkey.pem;

    location / {
        proxy_pass http://vesta_admin;
        proxy_http_version 1.1;
        proxy_set_header Host              $http_host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        $connection_upgrade;
    }
}

# Unknown Host → reject, same as the local edge.conf
server {
    listen 80 default_server;
    return 444;
}
server {
    listen 443 ssl default_server;
    ssl_certificate     /etc/letsencrypt/live/cycle-circle.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cycle-circle.com/privkey.pem;
    return 444;
}
```

### vesta-crontab (proposed)

```cron
# ops/deploy/vesta-crontab  (proposed) — install with: crontab -u vesta ops/deploy/vesta-crontab
# Times below are in the SERVER's timezone. Ubuntu 24.04's cron (3.0pl1) ignores CRON_TZ,
# so set the server to UTC first (02-server-setup.md → Timezone: `sudo timedatectl set-timezone UTC`)
# to match apps/web/vercel.json's schedule (08:00 / 02:00 UTC = 14:00 / 08:00 Asia/Dhaka).
# If the server stays on Europe/Berlin, these fire 1–2 h earlier in UTC terms (DST-dependent).

# Mirrors apps/web/vercel.json crons: daily-reminders 08:00 UTC, caas-check 02:00 UTC.
# apps/web/worker/index.ts (BullMQ) is a LOCAL DEV alternative only — do not run it in prod.
0 8 * * * curl -fsS -X POST -H "Authorization: Bearer <CRON_SECRET>" https://cycle-circle.com/api/cron/daily-reminders >> /var/log/vesta/cron-daily-reminders.log 2>&1
0 2 * * * curl -fsS -X POST -H "Authorization: Bearer <CRON_SECRET>" https://cycle-circle.com/api/cron/caas-check >> /var/log/vesta/cron-caas-check.log 2>&1

# TLS renewal, twice daily (certbot's own recommendation; it no-ops unless <30 days remain)
0 3,15 * * * cd /opt/vesta && docker compose -f ops/deploy/compose.prod.yml run --rm certbot renew --webroot -w /var/www/certbot --quiet && docker compose -f ops/deploy/compose.prod.yml exec -T nginx nginx -s reload >> /var/log/vesta/certbot-renew.log 2>&1
```

Both cron routes accept `GET` and `POST` and export the same `withCronAuth`-wrapped handler (`apps/web/src/app/api/cron/{daily-reminders,caas-check}/route.ts`) — `curl -X POST` above matches how Vercel's own cron and the local worker invoke them.

---

## 3. DNS setup + verification

Ticket **03** runbook (env paths, must-match secrets, staging flags, last DNS snapshot): [07-dns-and-env-runbook.md](./07-dns-and-env-runbook.md). Local check: `pnpm vps:preflight`.

| Record | Type | Value |
|---|---|---|
| `cycle-circle.com` | A | `62.171.155.231` |
| `cycle-circle.com` | AAAA (optional) | `2a02:c207:2361:2692::1` |
| `www.cycle-circle.com` | A | `62.171.155.231` (redirect to apex handled by nginx — see §2) |
| `admin.cycle-circle.com` | A | `62.171.155.231` |

DNS is client-owned (`cycle-circle.com`) — the client's registrar/DNS provider adds these records. Verify propagation before issuing TLS certs (certbot's HTTP-01 challenge will fail otherwise):

```bash
dig +short cycle-circle.com
dig +short www.cycle-circle.com
dig +short admin.cycle-circle.com
dig +short AAAA cycle-circle.com

# All should resolve to 62.171.155.231 (A) — confirm from an external resolver too:
dig +short @1.1.1.1 cycle-circle.com
```

---

## 4. First deploy runbook

Run these as the `vesta` user (sudo where noted). Assumes §2's artifacts exist and §3's DNS has propagated.

1. **Create a read-only GitHub deploy key on the server** (never reuse a personal key):
   ```bash
   ssh vesta
   sudo mkdir -p /opt/vesta && sudo chown vesta:vesta /opt/vesta
   ssh-keygen -t ed25519 -C "vesta-deploy@cycle-circle" -f ~/.ssh/vesta_deploy_key -N ""
   cat ~/.ssh/vesta_deploy_key.pub
   ```
   Add the printed public key at **GitHub → repo → Settings → Deploy keys → Add deploy key**, leave "Allow write access" **unchecked**. Then add to `~/.ssh/config` on the server:
   ```
   Host github.com
     IdentityFile ~/.ssh/vesta_deploy_key
     IdentitiesOnly yes
   ```

2. **Clone the repo:**
   ```bash
   cd /opt && git clone git@github.com:adibahsan/cycle-circle.git vesta
   cd /opt/vesta
   # Let plain `docker compose …` find the prod file (05-operations.md relies on this):
   echo 'export COMPOSE_FILE=/opt/vesta/ops/deploy/compose.prod.yml' >> ~/.bashrc && source ~/.bashrc
   ```

3. **Create the env files** from `ops/deploy/env/*.example` (details in [07-dns-and-env-runbook.md §3–§5](./07-dns-and-env-runbook.md); values from [04-env-reference.md](./04-env-reference.md)):
   ```bash
   cp ops/deploy/env/web.production.example    /opt/vesta/.env.web.production
   cp ops/deploy/env/admin.production.example  /opt/vesta/.env.admin.production
   cp ops/deploy/env/postgres.production.example /opt/vesta/.env.postgres.production
   chmod 600 /opt/vesta/.env.*.production
   # Edit each with a real editor (vim/nano) — never echo secrets into shell history.
   ```
   Double-check: `JWT_SECRET` and `CRON_SECRET` identical across web and admin; postgres password in `DATABASE_URL` matches `POSTGRES_PASSWORD` in `.env.postgres.production`. For VPS v1 staging, use `DEV_MODE=true` in web env and `NEXT_PUBLIC_DEV_MODE=true` in `ops/deploy/.env` before web build — see [07-dns-and-env-runbook.md §5](./07-dns-and-env-runbook.md).

4. **Build the images:**
   ```bash
   docker compose -f ops/deploy/compose.prod.yml build
   ```

5. **Start Postgres (and Redis), wait for healthy:**
   ```bash
   docker compose -f ops/deploy/compose.prod.yml up -d --wait postgres redis
   ```

6. **Run migrations** (from `packages/shared/`, per `packages/shared/CLAUDE.md` — all Prisma operations run from there):
   ```bash
   docker compose -f ops/deploy/compose.prod.yml run --rm \
     --entrypoint sh web -c \
     "cd packages/shared && DATABASE_URL=\$DATABASE_URL DIRECT_URL=\$DIRECT_URL pnpm exec prisma migrate deploy --schema ./prisma/schema.prisma"
   ```
   (Or run `pnpm --filter @vesta/shared db:migrate:deploy` directly on the host if Node/pnpm are also installed there — the container form above avoids that dependency.)

7. **Seed the admin account** (admin-only in prod thanks to the `SEED_DEMO` guard — see [04-env-reference.md](./04-env-reference.md)):
   ```bash
   docker compose -f ops/deploy/compose.prod.yml run --rm \
     -e NODE_ENV=production -e ADMIN_EMAIL="<real email>" -e ADMIN_PASSWORD="<strong password>" \
     --entrypoint sh web -c \
     "cd packages/shared && pnpm exec prisma db seed --schema ./prisma/schema.prisma"
   ```
   Save the credentials in a password manager immediately — never commit them.

8. **Start everything:**
   ```bash
   docker compose -f ops/deploy/compose.prod.yml up -d
   docker compose -f ops/deploy/compose.prod.yml ps
   ```
   At this point nginx is serving plain HTTP only (no cert yet) — that's expected.

9. **Issue the TLS certificate** (webroot challenge — nginx must already be up and serving `/.well-known/acme-challenge/` per §3's DNS check):
   ```bash
   docker compose -f ops/deploy/compose.prod.yml run --rm certbot certonly \
     --webroot -w /var/www/certbot \
     -d cycle-circle.com -d www.cycle-circle.com -d admin.cycle-circle.com -d monitoring.cycle-circle.com \
     --email <ops contact email> --agree-tos --no-eff-email
   docker compose -f ops/deploy/compose.prod.yml exec nginx nginx -s reload
   echo 'NGINX_CONF=cycle-circle.conf' >> ops/deploy/.env
   docker compose -f ops/deploy/compose.prod.yml up -d --force-recreate nginx
   ```

10. **Enable the crontab** (app crons + cert renewal, §2):
    ```bash
    sed "s/CRON_SECRET_PLACEHOLDER/$(grep ^CRON_SECRET= /opt/vesta/.env.web.production | cut -d= -f2-)/" ops/deploy/vesta-crontab | crontab -u vesta -
    chmod +x /opt/vesta/ops/deploy/scripts/backup-db.sh
    sudo mkdir -p /var/log/vesta && sudo chown vesta:vesta /var/log/vesta
    sudo mkdir -p /var/lib/vesta/uploads   # article images (see 05-operations.md §4)
    crontab -u vesta -l   # confirm it installed
    ```

11. **Smoke tests:**
    ```bash
    # Health / DB
    curl -fsS https://cycle-circle.com/api/health/db
    # → {"status":"ok","latency":<ms>}

    # Login page renders
    curl -fsS -o /dev/null -w "%{http_code}\n" https://cycle-circle.com/login

    # Admin login page renders
    curl -fsS -o /dev/null -w "%{http_code}\n" https://admin.cycle-circle.com/login

    # Webhook allowlist is live — from the host (not a whitelisted BDApps IP),
    # this MUST 401 once BDAPPS_WEBHOOK_IPS is set (empty = accepts everyone, so
    # confirm this only after BDApps go-live, §6):
    curl -sS -o /dev/null -w "%{http_code}\n" -X POST https://cycle-circle.com/api/webhooks/sms/receive -d '{}'
    ```
    For the full four-endpoint smoke test (expects `S1000` when the allowlist is open), use `BASE_URL=https://cycle-circle.com bash scripts/smoke-bdapps-webhooks.sh` — but only while `BDAPPS_WEBHOOK_IPS` is still empty; once it's set, that script's requests should fail with 401 (proving the allowlist works) rather than succeed.

---

## 5. Routine deploy

Production runs the **`production`** branch. Work merges to `main` through PRs as usual, and a release is `main` → `production`:

```bash
git fetch origin
git push origin origin/main:production   # fast-forward production to main
# or open a PR main → production if you want a review gate
```

The push triggers [`.github/workflows/production.yml`](../../.github/workflows/production.yml):

1. **Checks:** typecheck, lint, `docs:check`, `deploy:verify`, and the web vitest suite against a throwaway Postgres. The same checks run on every PR into `main` or `production`.
2. **Deploy:** if the checks pass, it SSHes to the VPS as `vesta` and runs [`ops/deploy/scripts/deploy.sh`](../../ops/deploy/scripts/deploy.sh) with the pushed SHA. The script:
   - checks out `production`
   - **refuses to deploy a dev-mode or fake-BDApps config** ([`check-prod-env.sh`](../../ops/deploy/scripts/check-prod-env.sh)): `DEV_MODE` / `NEXT_PUBLIC_DEV_MODE` must be off, `BDAPPS_APP_ID` / `BDAPPS_PASSWORD` real (no `PLACEHOLDER` / `SIMULATOR` / `DEV` / `TEST` ids) in `.env.web.production` and `.env.admin.production`, `NEXT_PUBLIC_DEV_MODE` off in `ops/deploy/.env`, no `BDAPPS_SIMULATOR_BASE_URL`. It runs before the backup, so nothing is touched. A staging box can override with `ALLOW_DEV_MODE=1 bash ops/deploy/scripts/deploy.sh`
   - backs up the DB (`backup-db.sh`)
   - builds the images and runs `prisma migrate deploy`
   - restarts web, then admin, checking after each that the site loads over HTTPS (`cycle-circle.com/login`, `admin.cycle-circle.com/login`)
   - brings up the rest of the stack, then checks both sites again (an `up -d` can recreate nginx)
   - **checks the live site is in production mode**: the login page has no "Dev mode" text and `POST /api/auth/dev-login` returns 403; otherwise the run fails
3. One deploy runs at a time; a second push waits.

**Required repo secrets** (GitHub → Settings → Secrets and variables → Actions, attached to a `production` environment):

| Secret | Value |
|---|---|
| `PROD_SSH_HOST` | `62.171.155.231` |
| `PROD_SSH_USER` | `vesta` |
| `PROD_SSH_KEY` | Private key of a **dedicated** CI deploy key (not a personal key); its public half is in `vesta`'s `~/.ssh/authorized_keys` |
| `PROD_SSH_KNOWN_HOSTS` | Output of `ssh-keyscan -t ed25519 62.171.155.231`, checked against the fingerprint from `ssh vesta 'ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub'` |

Create the CI key once, locally: `ssh-keygen -t ed25519 -f ~/.ssh/vesta_ci_deploy -C "github-actions-deploy" -N ""`. Add the `.pub` to the VPS as in [01-access.md §2](./01-access.md), and paste the private key into `PROD_SSH_KEY`.

**Manual deploy** (CI down or a hotfix by hand): run the same script on the VPS.

```bash
ssh vesta
cd /opt/vesta && git fetch origin production && git checkout -B production origin/production
bash ops/deploy/scripts/deploy.sh
```

> **Env files for Compose:** every manual `up`, `run` or `build` must pass both env files, before `-f`:
> `docker compose --env-file ops/deploy/.env --env-file .env.monitoring.production -f ops/deploy/compose.prod.yml …`
> Passing any `--env-file` stops Compose from reading `ops/deploy/.env` on its own. That file sets `NGINX_CONF` (without it, nginx falls back to the HTTP-only bootstrap config and HTTPS goes down) and `NEXT_PUBLIC_DEV_MODE` (a web build argument). The monitoring file sets `POSTGRES_EXPORTER_DSN` (without it, `pg_up` drops to 0). `deploy.sh` passes both itself.

The script performs the following steps, kept here for reference:

```bash
cd /opt/vesta
git checkout -B production origin/production
bash ops/deploy/scripts/backup-db.sh
docker compose -f ops/deploy/compose.prod.yml build web admin
docker compose -f ops/deploy/compose.prod.yml run --rm \
  --entrypoint sh web -c \
  "cd packages/shared && pnpm exec prisma migrate deploy --schema ./prisma/schema.prisma"
docker compose -f ops/deploy/compose.prod.yml up -d
curl -fsS https://cycle-circle.com/api/health/db
```

**Downtime:** `docker compose up -d` recreates `web`/`admin` in place — expect a few seconds of unavailability per service while the new container starts and the old one stops (no rolling/blue-green setup here). To minimize combined downtime, deploy and verify `web` before touching `admin`: `docker compose -f ops/deploy/compose.prod.yml up -d web`, smoke-test, then `... up -d admin`.

### Rollback

```bash
cd /opt/vesta
git log --oneline -5              # find the previous good commit/tag
git checkout <previous-commit-or-tag>
docker compose -f ops/deploy/compose.prod.yml build web admin
docker compose -f ops/deploy/compose.prod.yml up -d web admin
```

**Database migration caveat:** Prisma migrations are forward-only — there is no automatic "down" migration. If the deploy you're rolling back from included a migration, rolling back the *code* while the *schema* stays on the newer version can break the older code against newer columns/tables. **Take a `pg_dump` before any migration** (see [05-operations.md](./05-operations.md) for the backup/restore procedure) so a schema rollback is possible if the code rollback alone isn't enough.

---

## 6. BDApps go-live checklist

Since 2026-10-18 `deploy.sh` refuses dev mode and placeholder BDApps creds (§5), so production can no longer be deployed in the staging state described here by accident. The steps below are how a box gets its real config:

1. Set real `BDAPPS_APP_ID` / `BDAPPS_PASSWORD` in `.env.web.production` (from the BDApps developer portal).
2. Leave `BDAPPS_BASE_URL` **unset** — the Zod schema default (`https://developer.bdapps.com`) is the correct production value (`packages/shared/src/utils/env.ts`).
3. Leave `BDAPPS_SIMULATOR_BASE_URL` **unset**.
4. Ask BDApps support for their webhook egress IP list; set `BDAPPS_WEBHOOK_IPS` (comma-separated) in `.env.web.production`.
5. Register these four listener URLs in the BDApps developer portal (all `POST` JSON, each replies `{"statusCode":"S1000"}`):
   - `https://cycle-circle.com/api/webhooks/sms/receive`
   - `https://cycle-circle.com/api/webhooks/sms/report`
   - `https://cycle-circle.com/api/webhooks/ussd/receive`
   - `https://cycle-circle.com/api/webhooks/subscription/notify`
6. Set `DEV_MODE=false` and `NEXT_PUBLIC_DEV_MODE=false` in `.env.web.production`, then **rebuild** the web image (the `NEXT_PUBLIC_` var is baked at build time — a plain restart does not pick up the change):
   ```bash
   docker compose -f ops/deploy/compose.prod.yml build web
   docker compose -f ops/deploy/compose.prod.yml up -d web
   ```
7. Confirm the allowlist rejects unknown sources and the real flow works:
   ```bash
   # From the host (not a BDApps IP) — expect 401
   curl -sS -o /dev/null -w "%{http_code}\n" -X POST https://cycle-circle.com/api/webhooks/subscription/notify -d '{}'
   ```
   A real BDApps subscription notify should update the user's `Pro`/`Lapsed` status — verify via the admin Subscriptions page after a real event.
8. Confirm `420420`/`840840` no longer log anyone in on `https://cycle-circle.com/login`.
9. Create the app log directory and the retention cron (once): see [08-logging.md](./08-logging.md).
10. Masked subscriber ids, manual status checks and the real-number test: see [09-bdapps-subscriptions.md](./09-bdapps-subscriptions.md).

---

## 7. Resend email webhook registration

`apps/web/src/app/api/webhooks/resend/route.ts` verifies incoming events using Svix-style HMAC (`svix-id`/`svix-timestamp`/`svix-signature` headers against `RESEND_WEBHOOK_SECRET`) and updates `EmailLog.deliveryStatus` for events `email.delivered`, `email.bounced`, `email.complained`, `email.delivery_delayed`.

1. In the Resend dashboard, add a webhook endpoint: `https://cycle-circle.com/api/webhooks/resend`.
2. Subscribe to the four event types above.
3. Copy the signing secret (`whsec_...`) into `RESEND_WEBHOOK_SECRET` in `.env.web.production` (see [04-env-reference.md](./04-env-reference.md)).
4. Restart web (no rebuild needed — this is a runtime-only var, not `NEXT_PUBLIC_`):
   ```bash
   docker compose -f ops/deploy/compose.prod.yml up -d web
   ```
5. Send a test event from the Resend dashboard and confirm a `200` response; without `RESEND_WEBHOOK_SECRET` set, the route falls back to a "headers present" sanity check and accepts unsigned requests — do not run production traffic in that state.

---

## Supabase / RLS finding

`CLAUDE.md` and `STAGING-DEPLOY-PLAN.md` both describe the original target as Supabase Postgres with RLS. A grep of every migration under `packages/shared/prisma/migrations/` (`0_init`, `20260616210000_v1_3_consolidated`, `20260629120000_v1_4_consolidated`) for `auth.`, `anon`, `authenticated`, `service_role`, `ENABLE ROW LEVEL SECURITY`, `GRANT`, `REVOKE` returned **no matches**. RLS policies were never actually built into the schema — isolation is app-layer only (JWT → Prisma `userId` scoping in `middleware.ts`), matching `STAGING-DEPLOY-PLAN.md`'s own "Postgres RLS / pgcrypto — not built" note. Practical result: the existing migrations are plain-Postgres-compatible as-is — `ops/docker/postgres/init.sql` (`CREATE EXTENSION IF NOT EXISTS pgcrypto;`) is all the self-hosted container needs beyond creating the `vesta` role/database (handled by `POSTGRES_USER`/`POSTGRES_DB` env vars on the official Postgres image). No migration edits are required to run on self-hosted Postgres instead of Supabase.

---

## Related docs

- [01-access.md](./01-access.md) — SSH access used for every command above
- [02-server-setup.md](./02-server-setup.md) — Docker install + host hardening, a prerequisite for §4
- [04-env-reference.md](./04-env-reference.md) — every env var referenced in this doc
- [05-operations.md](./05-operations.md) — logs, backup/restore, cron health checks, incident response
