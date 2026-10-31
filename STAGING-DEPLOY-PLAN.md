# Push Vesta to Staging/Test-Prod — Deploy Runbook

> Execution runbook for shipping **v1.4.0** to the existing staging/"test-prod"
> environment. The code prep is done; this is the deploy. Companion guide:
> [`docs/VERCEL-CRONS.md`](docs/VERCEL-CRONS.md). `DEPLOYMENT-PLAN.md` is older and
> partly stale — trust this file.

## Context

The v1.4.0 round is committed on `claude-experiment`, the build gate is green
(web/admin `tsc`, **vitest 266**, both `next build`), and migrations are squashed to
3 dirs (`0_init`, `v1_3_consolidated`, `v1_4_consolidated`). Goal: run it on the
**existing staging** environment and keep **DEV_MODE OTP login working exactly as
today** (no real BDApps creds).

- **Staging URL:** `https://test-vesta.velirasolutions.com`
- **Supabase project ref:** `acuvzhyerxikdbcadkrr`
- **Vercel projects:** `cycle-circle` (web, root `apps/web`) and `vesta-admin`
  (admin, root `apps/admin`), region `sin1`. **Web project is on the Hobby (free)
  plan.** Crons live on web only. `@vesta/shared` is consumed as TS source via
  `transpilePackages`; migrations run out-of-band (not at build).
- **DEV_MODE:** OTP-bypass stays ON for staging (codes `420420` / `840840`); BDApps
  creds stay placeholder. ⚠️ Turn `DEV_MODE` OFF before any real public launch.

### Scope split

| Prep (done / I do) | User does |
|---|---|
| v1.4.0 code + squashed migration + build gate | Set env vars in both Vercel projects (Production) |
| This runbook + the crons guide | Run Step 1–2 (backup + migrate) with the staging DIRECT_URL |
| Exact, copy-paste commands | Trigger the Vercel deploys (web, then admin) |
| | Run the Step 6 smoke checks |

I cannot reach the staging DB, set Vercel env vars, or trigger deploys (secrets are
in the gitignored `env.prod` files). The steps below are yours to run.

---

## Pre-flight (verify, don't change)

- On `claude-experiment`, HEAD includes the v1.4.0 commits; `git status` clean.
- `packages/shared/prisma/migrations/` = exactly `0_init`,
  `20260616210000_v1_3_consolidated`, `20260629120000_v1_4_consolidated`.
- If anything changed, re-run the gate:
  ```
  just typecheck
  pnpm --filter @vesta/admin exec tsc --noEmit
  pnpm --filter @vesta/web exec vitest run          # expect 266 passing
  pnpm --filter @vesta/shared db:generate
  pnpm --filter @vesta/web build
  pnpm --filter @vesta/admin build
  ```
  (Accepted: `@vesta/shared tsc` has 2 pre-existing `simulator/checker.ts` errors —
  they don't block the app builds.)
- Push the branch so Vercel can deploy the ref.

---

## Step 1 — Back up the staging Supabase DB (always, first)

Supabase Free has no automatic backups. From the repo root, using the staging
**DIRECT_URL** (port 5432, *not* the pooler):

```
just db-backup-url "postgresql://<user>:<pass>@<host>:5432/postgres"
```

→ writes `ops/backups/vesta-backup-<timestamp>.sql` (plain SQL, `--no-acl
--no-owner`). Confirm the file exists and is non-trivial in size before touching the
DB. (Optionally also take a Supabase dashboard snapshot.) Backups under
`ops/backups/` are gitignored — never commit them.

---

## Step 2 — Apply the v1.4 migration to Supabase (state-verified)

The four post-v1.3 migrations were squashed and their folders deleted, so a plain
`migrate deploy` will **not** cleanly handle a DB that already recorded those four —
reconcile instead. **`resolve --applied` does NOT run SQL, so the schema must already
contain every v1.4 object before reconciling.** Verify first, then pick a branch.

Run migration commands from `packages/shared/` with the staging DIRECT_URL:

```
DATABASE_URL="<staging DIRECT_URL>" DIRECT_URL="<staging DIRECT_URL>" \
  pnpm exec prisma migrate status
```

Check whether the schema already has the v1.4 objects (psql against staging):

```sql
SELECT
  to_regclass('"CronSetting"') IS NOT NULL AS has_cronsetting,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name='SmsBroadcast'
       AND column_name IN ('active','messageBn','providerMessageId')) AS sms_cols,
  EXISTS (SELECT 1 FROM pg_indexes
     WHERE tablename='PeriodLog'
       AND indexname='PeriodLog_profileId_startDate_idx') AS has_periodlog_idx;
```

### Branch A — schema already current
(`has_cronsetting = t`, `sms_cols = 3`, `has_periodlog_idx = t`) → staging has all
four applied. Reconcile (this exact procedure was validated locally on `vesta_dev`):

```sql
DELETE FROM "_prisma_migrations" WHERE migration_name IN (
  '20260621120000_otp_users_auto_pro',
  '20260628131041_add_sms_circulation_fields',
  '20260628233111_add_periodlog_profile_startdate_index',
  '20260629112337_add_cron_setting'
);
```
```
DATABASE_URL="<staging DIRECT_URL>" DIRECT_URL="<staging DIRECT_URL>" \
  pnpm exec prisma migrate resolve --applied 20260629120000_v1_4_consolidated
```

### Branch B — schema behind
(any check above is false) → apply the missing DDL first using the pre-squash
migration folders from git, then do Branch A:

```
# restore the 6-dir pre-squash migration set (commit before the squash)
git checkout 6bf59ae~1 -- packages/shared/prisma/migrations/

DATABASE_URL="<staging DIRECT_URL>" DIRECT_URL="<staging DIRECT_URL>" \
  pnpm exec prisma migrate deploy        # applies the pending individual migrations

# return to the squashed 3-dir set
git checkout HEAD -- packages/shared/prisma/migrations/
```
Staging schema is now current → run Branch A's DELETE + `resolve --applied`.

### Verify (both branches)
```
DATABASE_URL="<staging DIRECT_URL>" DIRECT_URL="<staging DIRECT_URL>" \
  pnpm exec prisma migrate status
```
→ "Database schema is up to date!" and `_prisma_migrations` shows only the 3 names.

> A brand-new/empty staging DB is the easy case — just `prisma migrate deploy`
> applies all 3 in order. The Branch A/B dance is only for the existing data DB.

---

## Step 3 — Vercel env vars (user sets in each project's dashboard)

Source of truth = the gitignored `apps/web/env.prod` / `apps/admin/env.prod`. Set in
Settings → Environment Variables (Production). Generate fresh secrets where noted
(`openssl rand -hex 32` for `JWT_SECRET`, `-hex 16` for `CRON_SECRET`). `CRON_SECRET`
must be **byte-identical across web and admin**; `JWT_SECRET` must **differ** (ADR 0007), and set `APP_ENV=staging` in both. Secret values are
never reproduced here.

**Web (`cycle-circle`):** `DATABASE_URL` (pooler :6543 `?pgbouncer=true`),
`DIRECT_URL` (:5432), `JWT_SECRET`, `AUTH_COOKIE_NAME=vesta_token`, `CRON_SECRET`,
`APP_URL=https://test-vesta.velirasolutions.com`, `NODE_ENV=production`,
`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET`. Leave `REDIS_URL`
unset (in-memory fallback); BDApps vars placeholder/empty.

→ **DEV_MODE OTP login (the requirement):** set **`DEV_MODE=true`** and
**`NEXT_PUBLIC_DEV_MODE=true`** (exact string `true`). This makes
`/api/auth/otp/{request,verify}` bypass BDApps and accept codes **`420420` /
`840840`** (server gate `isDevModeEnabled()` → `packages/shared/src/server/dev.ts`),
and the login screen prefills the dev phone. No BDApps creds needed. ⚠️ OFF before a
real launch (otherwise anyone can log in with `420420`).

**Admin (`vesta-admin`):** `DATABASE_URL` (pooler), `DIRECT_URL` (:5432),
`JWT_SECRET` (**different from web**), `AUTH_COOKIE_NAME=vesta_admin_token` (isolates
admin sessions from web on the same host), `APP_URL` (the web URL — the System page
triggers web crons + cache revalidation), `CRON_SECRET` (**identical to web**),
`NODE_ENV=production`, `RESEND_API_KEY` (optional — admin `/emails` delivery status).
Leave `REDIS_URL` unset.

Project settings to confirm: Root Directory `apps/web` / `apps/admin`; Node 22; the
per-app `vercel.json` build/install commands are picked up (they `cd ../..`).

**Seed the admin** if staging has none (admin-only thanks to the `SEED_DEMO` guard):
```
NODE_ENV=production ADMIN_EMAIL="<real>" ADMIN_PASSWORD="<strong>" \
  DATABASE_URL="<staging DIRECT_URL>" DIRECT_URL="<staging DIRECT_URL>" \
  pnpm --filter @vesta/shared db:seed
```
Report the credentials to yourself out-of-band; never commit them.

---

## Step 4 — Deploy (user triggers)

Deploy **web first, then admin** from the pushed `claude-experiment` ref (Vercel
dashboard → Deploy, or `vercel --prod` per project). Build/install come from each
`vercel.json` (`pnpm install --frozen-lockfile`, then `db:generate && next build`).
No worker is deployed — Vercel Cron replaces it (`apps/web/worker/index.ts` is
local-only).

---

## Step 5 — Vercel crons

The two crons (`/api/cron/daily-reminders` `0 8 * * *`, `/api/cron/caas-check`
`0 2 * * *`) are declared in `apps/web/vercel.json` and register automatically on the
web Production deploy. Full setup, the `CRON_SECRET` auth model, dashboard
verification, the DB-backed on/off toggle, and **Hobby-plan limits + fallback** are
in **[`docs/VERCEL-CRONS.md`](docs/VERCEL-CRONS.md)**. The Step 6 check below is the
quick smoke test.

---

## Step 6 — Post-deploy smoke verification

1. `GET https://test-vesta.velirasolutions.com/api/health/db` → `{status:"ok",…}`
   (the only meaningful prod health route; redis/worker/mailpit/bdapps are
   dev-oriented). 503 = DB env wrong.
2. **DEV_MODE OTP login:** login screen → request OTP → enter **`420420`** → reach
   dashboard; create a profile, log a period, open calendar/insights/content.
3. **Admin:** log into the admin `/login` with the Step 3 creds; load dashboard,
   analytics, and the SMS page.
4. **Crons (auth check):**
   `curl -H "Authorization: Bearer $CRON_SECRET" https://<web>/api/cron/daily-reminders`
   → `200` JSON. Repeat for `/api/cron/caas-check`. `401` = `CRON_SECRET` mismatch;
   `405` = GET handler missing (shouldn't happen — both routes export GET+POST).
5. Confirm `DEV_MODE` exposure is acceptable for this staging host (must be **off**
   before any real public launch).

---

## Accepted gaps / explicitly deferred (not blockers for staging)

- **Field encryption (FR-ENC)** — not built (scoped out); `symptom_logs.value` is
  plaintext. Security gate won't pass until added (v2).
- **Postgres RLS / pgcrypto** — not built; isolation is **app-layer only** (JWT →
  Prisma `userId` scoping in `middleware.ts`). Go/no-go before a real launch.
- **Real BDApps OTP / CAAS / SMS + webhook registration** — deferred (no creds).
  When credentials exist, complete this checklist (see also `DEPLOYMENT-PLAN.md` §6):
  1. Set `BDAPPS_APP_ID` / `BDAPPS_PASSWORD` (do not set `BDAPPS_BASE_URL` — prod default applies).
  2. Request BDApps webhook egress IPs; set `BDAPPS_WEBHOOK_IPS` (comma-separated).
  3. Register these four listener URLs in the BDApps portal against public `APP_URL`:
     - `{APP_URL}/api/webhooks/sms/receive`
     - `{APP_URL}/api/webhooks/sms/report`
     - `{APP_URL}/api/webhooks/ussd/receive`
     - `{APP_URL}/api/webhooks/subscription/notify`
  4. Smoke locally/staging with `just webhook-smoke` (or `BASE_URL=https://… just webhook-smoke`).
  5. Confirm non-whitelisted IP → HTTP 401; subscription notify updates Pro/Lapsed.
  6. Register Resend webhook separately (`RESEND_WEBHOOK_SECRET`).
- **QStash async jobs** — not wired; cron sends email synchronously (fine at
  <100 users within the function timeout).
- **CI/CD** — none; the Pre-flight gate is manual.
- **Vercel Hobby** — non-commercial use; move to Pro before a real production launch
  (also lifts the cron/duration limits — see the crons guide).

---

## Definition of done

- Step 1: backup file saved under `ops/backups/`.
- Step 2: `prisma migrate status` against staging = "up to date"; `_prisma_migrations`
  has only the 3 names.
- Step 3: env vars set in both Vercel projects (incl. the DEV_MODE trio on web);
  admin account exists.
- Step 4: both projects deployed from the v1.4.0 ref.
- Step 6: `/api/health/db` ok, DEV_MODE `420420` login reaches the dashboard, admin
  login works, both cron endpoints return 200 with the Bearer secret.
