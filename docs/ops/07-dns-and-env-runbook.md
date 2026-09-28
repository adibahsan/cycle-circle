# DNS and production env (ticket 03)

Checklist for **public DNS** and **server-side env files** before the first VPS stack bring-up (ticket 04). No secrets belong in git — copy values from Vercel staging locally onto the server.

**Related:** [03-deployment.md §3–§4](./03-deployment.md), [04-env-reference.md](./04-env-reference.md), [ops/deploy/README.md](../../ops/deploy/README.md), rollout [spec](../../.scratch/vps-prod-rollout/spec.md) (staging parity).

---

## 1. Required DNS records

| Host | Type | Value | Required for |
|---|---|---|---|
| `cycle-circle.com` | A | `62.171.155.231` | Web + ACME |
| `www.cycle-circle.com` | A | `62.171.155.231` | Web (nginx redirects to apex) |
| `admin.cycle-circle.com` | A | `62.171.155.231` | Admin app + ACME for admin vhost |
| `monitoring.cycle-circle.com` | A | `62.171.155.231` | Grafana (HTTPS via nginx; enable after [host hardening](../../.scratch/vps-prod-rollout/issues/07-host-hardening.md)) |
| `cycle-circle.com` | AAAA (optional) | `2a02:c207:2361:2692::1` | IPv6 clients |

DNS is **client-owned** (registrar / Namecheap, etc.). The **admin** subdomain is easy to miss — nginx and certbot expect `admin.cycle-circle.com` to resolve to the VPS (see [03-deployment.md §1](./03-deployment.md)).

---

## 2. Verify DNS (local — no SSH)

Use an **external** resolver so you are not fooled by stale laptop cache:

```bash
VPS_IP=62.171.155.231
for h in cycle-circle.com www.cycle-circle.com admin.cycle-circle.com monitoring.cycle-circle.com; do
  echo "=== $h (A @1.1.1.1) ==="
  dig +short A "$h" @1.1.1.1
done

dig +short AAAA cycle-circle.com @1.1.1.1   # optional
```

**Automated check:** from repo root:

```bash
pnpm vps:preflight
```

Exit code `0` only when all three hostnames return an A record equal to `62.171.155.231`.

### Last repo verification (2026-09-28)

| Host | `dig +short @1.1.1.1` |
|---|---|
| `cycle-circle.com` | `62.171.155.231` |
| `www.cycle-circle.com` | `62.171.155.231` |
| `admin.cycle-circle.com` | *(no A record — add before TLS / admin go-live)* |

Re-run `pnpm vps:preflight` after the client adds the admin record.

---

## 3. Production env file paths (VPS)

| Server path | Template in git | Loaded by |
|---|---|---|
| `/opt/vesta/.env.web.production` | `ops/deploy/env/web.production.example` | `web` service |
| `/opt/vesta/.env.admin.production` | `ops/deploy/env/admin.production.example` | `admin` service |
| `/opt/vesta/.env.postgres.production` | `ops/deploy/env/postgres.production.example` | `postgres` service |

**Permissions (human on server):** owner `vesta`, mode `600`. Never commit filled files.

**Create from templates (on VPS, after clone):**

```bash
cd /opt/vesta
cp ops/deploy/env/web.production.example    .env.web.production
cp ops/deploy/env/admin.production.example    .env.admin.production
cp ops/deploy/env/postgres.production.example .env.postgres.production
chmod 600 .env.web.production .env.admin.production .env.postgres.production
# Edit with vim/nano — paste secrets from Vercel / password manager; do not echo into shell history.
```

If files were created empty earlier, replace contents from the examples above instead of leaving zero-byte files.

---

## 4. Must-match rules (before `docker compose up`)

| Rule | How to verify on VPS |
|---|---|
| `JWT_SECRET` identical in web and admin env files | `diff <(grep ^JWT_SECRET= .env.web.production) <(grep ^JWT_SECRET= .env.admin.production)` (no output = match) |
| `CRON_SECRET` identical in web and admin | Same pattern with `CRON_SECRET` |
| Postgres password aligned | `POSTGRES_PASSWORD` in `.env.postgres.production` must equal the password embedded in `DATABASE_URL` / `DIRECT_URL` in **both** app files (`postgresql://vesta:<password>@postgres:5432/vesta`) |

Full variable meanings: [04-env-reference.md](./04-env-reference.md). Generate new shared secrets with:

```bash
openssl rand -hex 32   # JWT_SECRET (both app files)
openssl rand -hex 16   # CRON_SECRET (both app files)
openssl rand -hex 20   # POSTGRES_PASSWORD (postgres file + DATABASE_URL)
```

Copy **Resend**, **BDApps**, and other staging values from the Vercel dashboard — not from git.

---

## 5. Staging-first flags (VPS v1)

Mirror Vercel staging with **only** these VPS-specific overrides (see rollout spec):

| Setting | Where | Staging value |
|---|---|---|
| `DEV_MODE` | `.env.web.production` | `true` (OTP `420420` / `840840`; restart web to apply) |
| `NEXT_PUBLIC_DEV_MODE` | `ops/deploy/.env` on VPS | `true` — **build-time only** for web image |
| `DATABASE_URL` / `DIRECT_URL` | both app env files | `postgresql://vesta:<pw>@postgres:5432/vesta` |
| `REDIS_URL` | web env | `redis://redis:6379` |
| `APP_URL` | web env | `https://cycle-circle.com` |
| `APP_URL` | admin env | Same **web** URL (not `admin.…`) |
| `NODE_ENV` | app env files | `production` |

**Web rebuild required** after changing `NEXT_PUBLIC_DEV_MODE`:

```bash
cd /opt/vesta
cp ops/deploy/.env.example ops/deploy/.env   # if missing
# Set NEXT_PUBLIC_DEV_MODE=true in ops/deploy/.env (see ops/deploy/.env.example)
docker compose -f ops/deploy/compose.prod.yml build web
```

Go-live later: set `DEV_MODE=false`, rebuild web with `NEXT_PUBLIC_DEV_MODE=false`, then follow [03-deployment.md §6](./03-deployment.md).

---

## 6. Server preflight (human — SSH)

After DNS and env files are ready, on the VPS as `vesta`:

| Check | Command / expectation |
|---|---|
| Repo at `/opt/vesta` | `test -d /opt/vesta/ops/deploy/compose.prod.yml` |
| `COMPOSE_FILE` | `grep COMPOSE_FILE ~/.bashrc` → `/opt/vesta/ops/deploy/compose.prod.yml` |
| Env files exist, mode 600 | `ls -la /opt/vesta/.env.*.production` |
| No secrets in git | `git status` clean under `/opt/vesta` |

Do **not** run `docker compose up` in this ticket — that is ticket 04.

---

## 7. Acceptance mapping (ticket 03)

| Item | Owner |
|---|---|
| A records for apex, www, **admin** → VPS IP | Client DNS + verify with §2 |
| External resolver check (`@1.1.1.1`) | `pnpm vps:preflight` |
| Three `.env.*.production` files from examples, `600`, owner `vesta` | Human on VPS |
| `JWT_SECRET` / `CRON_SECRET` match across web + admin | Human on VPS |
| Postgres password matches `DATABASE_URL` | Human on VPS |
| Staging flags documented | This doc + [ops/deploy/README.md](../../ops/deploy/README.md) |

Next: [03-deployment.md §4 first deploy](./03-deployment.md) (clone, build, migrate) once ticket 04 starts.
