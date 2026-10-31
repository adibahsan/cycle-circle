# Environment Variable Reference

Every variable the web app, admin app, and self-hosted Postgres container read in production. Sources: `packages/shared/src/utils/env.ts` (the Zod schema both apps validate against), `apps/web/.env.example`, `apps/admin/.env.example`, `apps/web/env.prod.example`, `apps/admin/env.prod.example`, and a repo-wide grep for `process.env.NEXT_PUBLIC_*`.

Never write a real secret value into this file. Use placeholders (`<generate: openssl rand -hex 32>`, `<from BDApps>`, `<from password manager>`).

Production env files live at `/opt/vesta/.env.web.production` and `/opt/vesta/.env.admin.production` — see [03-deployment.md](./03-deployment.md) for how they're created, permissioned, and loaded by Compose.

---

## Shared-must-match rules

| Rule | Why |
|---|---|
| `APP_ENV` — same value in both files | `production` (or `staging` on the staging box). It becomes the token issuer `vesta:<APP_ENV>`; a mismatch makes the two apps reject each other's session checks for no visible reason. |
| `CRON_SECRET` — byte-identical in both files | Admin's System page triggers web cron routes (`withCronAuth`) using this secret; the host crontab also uses it. |
| `JWT_SECRET` — must **differ** | Web and admin sign with their own secret, and every token also carries an audience (`vesta-web` / `vesta-admin`). A web login can never open admin or the reverse ([ADR 0007](../adr/0007-auth-tokens-scoped-per-app-and-environment.md)). |
| `AUTH_COOKIE_NAME` — must **differ** | Web uses `vesta_token`, admin uses `vesta_admin_token`. Both apps share the domain's DNS but not necessarily the same host — differing names stop one session cookie from colliding with or overwriting the other. |
| Admin's `APP_URL` = web's public URL | Not admin's own URL. Admin's System page calls `{APP_URL}/api/cron/*` and revalidates web's cache — it must point at `https://cycle-circle.com`, not `https://admin.cycle-circle.com`. |
| `DATABASE_URL` / `DIRECT_URL` — same value in prod | Self-hosted Postgres has no PgBouncer pooler, so there's no separate pooled vs. direct connection string like Supabase's. Both vars point at the same `postgres:5432` service. |

---

## Secret generation

```bash
# JWT_SECRET (min 32 chars, zod-enforced) — run once per app: web and admin each get their own value
openssl rand -hex 32

# CRON_SECRET — same value in both env files
openssl rand -hex 16

# Postgres password (POSTGRES_PASSWORD, used inside DATABASE_URL/DIRECT_URL)
openssl rand -hex 20

# Verify JWT_SECRET is DIFFERENT across files without printing it
diff <(sha256sum < <(grep ^JWT_SECRET= /opt/vesta/.env.web.production)) \
     <(sha256sum < <(grep ^JWT_SECRET= /opt/vesta/.env.admin.production)) \
  >/dev/null && echo "SAME (wrong: regenerate admin's)" || echo "differ (correct)"
```

---

## Web app (`apps/web` — `/opt/vesta/.env.web.production`)

| Variable | Required? | Prod value / how to generate | Notes |
|---|---|---|---|
| `DATABASE_URL` | Yes | `postgresql://vesta:<pw>@postgres:5432/vesta` | `postgres` is the Compose service hostname. No `?pgbouncer=true` needed (no pooler self-hosted). |
| `DIRECT_URL` | Optional in schema, required in practice | Same value as `DATABASE_URL` | Used by `prisma migrate deploy`/`resolve`. Only differs from `DATABASE_URL` when a pooler is in front (Supabase); not the case here. |
| `REDIS_URL` | No | `redis://redis:6379` | Optional — code falls back to an in-memory store if unset. Recommended in prod so rate limits/caches survive across the two containers (currently only `web` runs, but keep set for future workers). |
| `BDAPPS_APP_ID` | Optional in schema; required for real BDApps login/SMS/CAAS | `<from BDApps>` | Placeholder is fine while `DEV_MODE=true`; required before BDApps go-live (see [03-deployment.md](./03-deployment.md) §6). |
| `BDAPPS_PASSWORD` | Same as above | `<from BDApps>` | |
| `BDAPPS_BASE_URL` | No | Leave **unset** | Zod default is `https://developer.bdapps.com` — the correct prod value. Do not override. |
| `BDAPPS_WEBHOOK_IPS` | No (but functionally required before go-live) | `<from BDApps egress IPs>` (comma-separated) | **Security-critical.** Empty = `validateWebhookSource()` accepts every source IP. Must be set before real BDApps traffic reaches the four webhook routes. |
| `BDAPPS_SIMULATOR_BASE_URL` | No | Leave **unset** | Dev/local-only; points at the Docker simulator. Never set in prod. |
| `JWT_SECRET` | Yes (min 32 chars) | `<generate: openssl rand -hex 32>` | Must **differ** from admin's. Startup fails when `APP_ENV` is `production`/`staging` and it starts with `local-dev`. |
| `AUTH_COOKIE_NAME` | **Yes** (no default) | `vesta_token` | Startup fails if unset, so admin can't fall back to the web name. |
| `APP_ENV` | No (default `local`); set it | `production` (or `staging`) | One of `local`, `staging`, `production`. Token issuer is `vesta:<APP_ENV>`. |
| `APP_URL` | No (but should be set) | `https://cycle-circle.com` | Used for magic-link callback URLs. Schema default is `http://localhost:3000` — wrong in prod if left unset. |
| `RESEND_API_KEY` | No, but required for real email | `<from Resend dashboard>` (`re_...`) | When unset, `packages/shared/src/server/adapters/mail.ts` falls back to Mailpit SMTP — do not leave unset in prod. |
| `RESEND_FROM_EMAIL` | No | `Vesta <noreply@cycle-circle.com>` | Schema default is `noreply@vesta.app` — override to a domain verified in Resend. |
| `RESEND_WEBHOOK_SECRET` | No, but required for delivery-status webhook | `<from Resend webhook dashboard>` (`whsec_...`) | See [03-deployment.md](./03-deployment.md) §7 for registering the webhook. |
| `MAILPIT_SMTP_URL` | No | Leave **unset** | Dev-only fallback SMTP target (schema default `smtp://localhost:1025`, harmless if `RESEND_API_KEY` is set since Resend takes priority). |
| `CRON_SECRET` | Optional in schema, **required** for crons to work | `<generate: openssl rand -hex 16>` | `withCronAuth` returns 401 if unset. Must match admin's `CRON_SECRET` and the host crontab's Bearer token. |
| `NODE_ENV` | No | `production` (schema default `development`) | Set explicitly — also gates `SEED_DEMO` behavior and the `/internal/simulator-check` page. |
| `DEV_MODE` | No | **`false`** | Runtime, server-side gate (`isDevModeEnabled()` in `packages/shared/src/server/dev.ts`) for OTP codes `420420`/`840840` on `/api/auth/otp/*`, `/api/user/phone/*`, and `/api/auth/dev-login`. This is the real security gate — changing it takes effect on container restart, **no rebuild needed**. |
| `NEXT_PUBLIC_DEV_MODE` | No | **`false`** | Client-side only (`apps/web/src/components/TrialCountdownPill.tsx`). Next.js inlines `NEXT_PUBLIC_*` vars into the JS bundle **at `next build` time** — setting this in the container's runtime env does nothing; it must be passed as a Docker build `ARG`/`ENV` before `next build` runs. See [03-deployment.md](./03-deployment.md) §2. |
| `NEXT_PUBLIC_USE_DUMMY_DATA` | No | `false` | Present in `.env.example`; no current code reference found (`grep -rn NEXT_PUBLIC_USE_DUMMY_DATA` returns only the example file). Leave unset/false — same build-time-baking caveat applies if it's ever wired up. |
| `ENABLE_BDAPPS_SIMULATOR_CHECKER` | No | Leave **unset** (or `false`) | Gates `/internal/simulator-check`; that page 404s in production unless this is `"true"`. Dev/staging debugging only. |
| `MAILPIT_UI_URL` | No | Leave **unset** | Only read by `/api/health/mailpit`, a dev-oriented health route. Irrelevant in prod. |

**Seed-only (not part of the running app's env file — passed inline on the seed command; see [03-deployment.md](./03-deployment.md) §4):**

| Variable | Notes |
|---|---|
| `ADMIN_EMAIL` | Defaults to `admin@vesta.health` if unset — always override in prod. |
| `ADMIN_PASSWORD` | Seed only. With `NODE_ENV=production` the seed refuses to run (exits non-zero, before writing anything) unless this is set to a strong value (unset, empty or `admin123` are rejected). Outside production it defaults to `admin123` for local dev. The seed only creates the admin when missing and never changes an existing admin's password or role; the password is never printed. There is no documented rotation route, so changing it needs a manual DB update of `User.passwordHash` with a fresh bcrypt hash (cost 12). |
| `SEED_DEMO` | Seed script (`packages/shared/prisma/seed.ts`): `seedDemo = NODE_ENV !== 'production' || SEED_DEMO === 'true'`. In prod, demo/dummy data is skipped unless you explicitly set `SEED_DEMO=true` (e.g. for a one-off staging smoke seed). Leave unset for a real prod seed (admin account only). |

---

## Admin app (`apps/admin` — `/opt/vesta/.env.admin.production`)

Admin imports the same shared Zod schema, so every field above is technically validated, but most are irrelevant to admin and can stay unset (they carry their schema defaults/optionals). Only these are meaningful:

| Variable | Required? | Prod value / how to generate | Notes |
|---|---|---|---|
| `DATABASE_URL` | Yes | `postgresql://vesta:<pw>@postgres:5432/vesta` | Same Postgres instance as web. |
| `DIRECT_URL` | Optional in schema, required in practice | Same value as `DATABASE_URL` | Used for `prisma migrate deploy`/`resolve` if ever run from the admin context. |
| `JWT_SECRET` | Yes | `<generate: openssl rand -hex 32>` | Its own value: **must differ from web's**. |
| `AUTH_COOKIE_NAME` | **Yes** (no default) | `vesta_admin_token` | Must differ from web's `vesta_token`. |
| `APP_ENV` | No (default `local`); set it | `production` (or `staging`) | Same value as web's. |
| `APP_URL` | No (but should be set) | `https://cycle-circle.com` | The **web** app's public URL — admin's System page calls web's cron routes and revalidates web's cache through this. Not admin's own URL. |
| `CRON_SECRET` | Optional in schema, required for System-page cron triggers | `<generate: openssl rand -hex 16>` | **Byte-identical to web's.** |
| `RESEND_API_KEY` | No | `<from Resend dashboard>` (`re_...`) | Optional — enables delivery-status refresh on the admin `/emails` page (`apps/admin/src/app/actions/email-delivery-actions.ts`). Reuse the same key as web's, or leave unset if that page isn't needed. |
| `NODE_ENV` | No | `production` | |
| `REDIS_URL` | No | Leave unset | Admin doesn't use Redis; in-memory fallback applies. |
| `BDAPPS_*` | No | Leave unset | Admin never calls BDApps directly. |
| `DEV_MODE` / `NEXT_PUBLIC_DEV_MODE` | No | Leave unset (`false`) | Admin auth is bcrypt password login (`verifyAdminLogin`), not OTP — these vars have no effect on admin, but keep them false for consistency and because the shared package parses the same schema. |

---

## Postgres container (`postgres` service in `compose.prod.yml`)

| Variable | Required? | Prod value / how to generate | Notes |
|---|---|---|---|
| `POSTGRES_USER` | Yes | `vesta` | Matches the user in `DATABASE_URL`/`DIRECT_URL` above. |
| `POSTGRES_PASSWORD` | Yes | `<generate: openssl rand -hex 20>` | Must match the password embedded in `DATABASE_URL`/`DIRECT_URL` for both apps. |
| `POSTGRES_DB` | Yes | `vesta` | Matches the db name in `DATABASE_URL`/`DIRECT_URL`. |

These three live in a separate small env file (e.g. `/opt/vesta/.env.postgres.production`, `chmod 600`, owner `vesta`) referenced by `compose.prod.yml`'s `postgres` service — not inside the app env files, since the web/admin containers never read `POSTGRES_*` directly, only the assembled `DATABASE_URL`.

`ops/docker/postgres/init.sql` runs once against a fresh volume: `CREATE EXTENSION IF NOT EXISTS pgcrypto;`. Prisma's `@default(cuid())` IDs don't need `pgcrypto`, but nothing in the schema conflicts with it either — keep it for forward compatibility. See [03-deployment.md](./03-deployment.md) for the Supabase/RLS migration-compatibility finding (short version: no Supabase-specific SQL exists in any migration, so plain Postgres + this `init.sql` is sufficient).

---

## Monitoring (`/opt/vesta/.env.monitoring.production`)

Loaded by Grafana and `postgres-exporter` in prod Compose. Template: [ops/monitoring/env/monitoring.production.example](../../ops/monitoring/env/monitoring.production.example).

| Variable | Required? | Notes |
|---|---|---|
| `GRAFANA_ADMIN_USER` | Yes | Built-in Grafana login user (v1: no SSO). |
| `GRAFANA_ADMIN_PASSWORD` | Yes | `<generate: openssl rand -hex 24>` — never commit. |
| `POSTGRES_EXPORTER_DSN` | Yes | Same credentials as `DATABASE_URL` against Compose `postgres:5432`. |

Prometheus retention on VPS is **30 days** (`PROMETHEUS_RETENTION=30d` in prod overlay). Only nginx publishes **80/443**; Grafana is reached via `https://monitoring.cycle-circle.com`.

---

## Logging

Optional on both apps (see [08-logging.md](./08-logging.md)). Prod Compose sets `LOG_DIR` for `web` and `admin`; no env-file entry is required.

| Variable | Required? | Notes |
|---|---|---|
| `LOG_DIR` | No | Root for `<channel>/YYYY-MM-DD.log` files. Default `<cwd>/logs`; prod `/var/log/vesta/app` (bind-mounted from the host). |
| `LOG_STDOUT` | No | Set `false` to stop mirroring log lines to stdout. Default mirrors. |

---

## Article image uploads

Optional on both apps. Prod Compose sets `UPLOAD_DIR` for `web` (read-only) and `admin` (read-write); no env-file entry is required.

| Variable | Required? | Notes |
|---|---|---|
| `UPLOAD_DIR` | No | Directory holding uploaded article images, served by the apps at `/uploads/<name>`. Default `<cwd>/uploads`; prod `/var/lib/vesta/uploads` (host bind mount). |

---

## Related docs

- [03-deployment.md](./03-deployment.md) — how these files are created, permissioned, and loaded; the Dockerfile build-arg mechanics for `NEXT_PUBLIC_*`
- [05-operations.md](./05-operations.md) — rotating secrets in place, backup/restore
- [README.md](./README.md) — doc index, server inventory
