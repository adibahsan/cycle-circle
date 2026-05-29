# Production Deployment Plan — Vesta v1

> Generated: 2026-05-29
> Branch: adib/backend-integration
> Target: Vercel Hobby + Supabase Free + Upstash Free + Resend Free ($0/month)

---

## Pre-Release Blockers

### Security Blockers

| # | Blocker | Severity | Location |
|---|---------|----------|----------|
| S-1 | **FR-ENC not implemented** — `prisma-field-encryption` is not installed; `symptom_logs.value` is stored as plaintext in PostgreSQL. This directly fails DoD gate "Security #1" (NFR-SEC-01). | CRITICAL P0 | `packages/shared/package.json` |
| S-2 | **Prisma version mismatch** — SRS pins Prisma to 6.13.x for `prisma-field-encryption` compatibility; current version is 6.19.3. Installing `prisma-field-encryption` may require a downgrade to 6.13.x. Verify library compatibility before releasing. | HIGH | `packages/shared/package.json` |
| S-3 | **RLS migration is a stub** — `20260526235330_add_rls/migration.sql` contains only a comment ("RLS deferred: policies will be re-added in a future migration"). RLS is not active. Data isolation depends entirely on application-layer `userId` checks, with no database-level enforcement. | HIGH | `packages/shared/prisma/migrations/20260526235330_add_rls/migration.sql` |
| S-4 | **BDAPPS_WEBHOOK_IPS not enforced in dev** — `validateWebhookSource` is permissive when the env var is absent. Ensure it is set and enforced in production before registering webhook URLs in BDApps portal. | MEDIUM | `packages/shared/src/server/adapters/webhooks.ts` |
| S-5 | **Missing HSTS header** — `next.config.ts` sets `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `X-DNS-Prefetch-Control` but does NOT set `Strict-Transport-Security`. Add this before going live. | MEDIUM | `apps/web/next.config.ts` |
| S-6 | **No Content Security Policy** — There is no CSP header in `next.config.ts` or middleware. Add a strict CSP to prevent XSS and satisfy NFR-SEC-04 (no third-party analytics touching health data). | MEDIUM | `apps/web/next.config.ts` |
| S-7 | **JWT_SECRET must be rotated** — Local dev secret (`local-dev-jwt-secret-minimum-32-characters-long`) must never appear in production. Generate a cryptographically random 64-character secret. | HIGH | Vercel env vars |

### Data Integrity Blockers

| # | Blocker | Severity | Location |
|---|---------|----------|----------|
| D-1 | **RLS policies missing** — The RLS migration exists but contains no actual `CREATE POLICY` or `ENABLE ROW LEVEL SECURITY` statements. This must be implemented and applied to `period_logs`, `symptom_logs`, and `profiles` before launch. | HIGH | New migration needed |
| D-2 | **Profile count TOCTOU race** — No DB-level `CHECK` constraint or advisory lock prevents concurrent creates exceeding the 6-profile limit. Under concurrent load, a user could exceed the limit. | MEDIUM | `packages/shared/prisma/schema.prisma` |
| D-3 | **Seed must not run in production** — The Prisma seed script (`packages/shared/prisma/seed.ts`) must not be invoked during production `migrate deploy`. Verify the build command does not call `db:seed`. | HIGH | CI/CD pipeline |
| D-4 | **No Article or SmsBroadcastMessage model** — Both models are required by FR-CONTENT/FR-CMS and FR-SMS respectively. The content platform and SMS broadcast admin queue have no persistent storage. These are P1/P2 gaps but block complete DoD compliance. | MEDIUM | `packages/shared/prisma/schema.prisma` |

### Infrastructure Blockers

| # | Blocker | Severity | Notes |
|---|---------|----------|-------|
| I-1 | **Supabase project not provisioned** — No production Supabase project exists yet. Must be created and migrations applied before launch. | CRITICAL | See Infrastructure Setup §1 |
| I-2 | **Vercel project not connected to repo** — No `vercel.json` exists in the repository. Must be created to configure cron jobs. | CRITICAL | See Infrastructure Setup §2 |
| I-3 | **QStash not wired** — The SRS requires prediction recalc and email delivery to be dispatched to QStash workers. Currently, prediction recalc uses a local `JobEvent` table + standalone worker process (not available on Vercel), and email notifications are sent synchronously in the cron handler. No QStash account is provisioned and no QStash publish call exists in the codebase. | HIGH | `apps/web/src/app/api/cron/daily-reminders/route.ts` |
| I-4 | **BDApps production credentials not obtained** — Current config uses simulator credentials. Must register a production BDApps application and obtain `applicationId`/`password`. | HIGH | BDApps developer portal |
| I-5 | **Resend domain not verified** — Transactional email from a custom domain requires DNS verification in the Resend dashboard. Without this, emails may be rejected or land in spam. | MEDIUM | Resend dashboard |
| I-6 | **Upstash Redis/QStash not provisioned** — No production Upstash accounts exist. Must be created and connection strings obtained. | HIGH | Upstash console |

### Admin Panel Blockers

| # | Blocker | Severity | Location |
|---|---------|----------|----------|
| A-1 | **Admin models not in schema** — `Article`, `ArticleCategory`, `SmsBroadcast`, `AdminAuditLog` models are required by FR-CONTENT/FR-CMS and FR-SMS but do not exist in `schema.prisma`. Cannot deploy a functional admin panel without them. | HIGH | `packages/shared/prisma/schema.prisma` |
| A-2 | **Admin user seeding** — There is no self-registration for admin accounts. The first admin must be created via a DB seed or direct SQL before the admin panel is usable in production. | HIGH | `packages/shared/prisma/seed.ts` |
| A-3 | **Admin app not on Vercel** — A separate Vercel project for `apps/admin/` has not been created or connected to the GitHub repo. | HIGH | Vercel dashboard |
| A-4 | **Admin cookie isolation on subdomains** — `vesta_token` cookies set on `app.vesta-app.com` are not shared with `admin.vesta-app.com` by default. The admin app has its own magic-link login flow but this has not been end-to-end tested in a real subdomain context. | MEDIUM | `apps/admin/src/` |
| A-5 | **Tiptap bundle size** — The Tiptap rich-text editor adds approximately 200 KB to the admin bundle. Dynamic imports are not yet configured. | LOW | `apps/admin/` |

### Code Blockers

| # | Blocker | Notes |
|---|---------|-------|
| C-1 | **ProfileCompletionModal not wired** — The modal collects `fullName`, `phone`, `DOB` but does not call `completeProfile` Server Action. The backend action exists. This is a straightforward 5-line wiring task. | `apps/web/src/components/ProfileCompletionModal.tsx` |
| C-2 | **OTP 60-second resend cooldown not server-side validated** — Only UI enforces cooldown; backend only enforces the 3/minute rate limit. A client bypassing the UI can request more frequently than intended. | `apps/web/src/app/api/auth/otp/request/route.ts` |
| C-3 | **Profile completion not re-prompted on subsequent logins** — `profileCompleted` field exists but `middleware.ts` does not redirect incomplete-profile users. | `apps/web/src/middleware.ts` |
| C-4 | **QStash not used for notification dispatch** — The daily-reminders cron calls `sendPeriodAlert`, `sendFertileAlert`, `sendLoggingReminder` synchronously in a `for` loop. With many users this could exceed the 10-second Vercel Hobby timeout. Must be refactored to dispatch each notification as a QStash job. | `apps/web/src/app/api/cron/daily-reminders/route.ts` |
| C-5 | **Worker process not deployable on Vercel** — `packages/shared/src/server/worker-process.ts` is a long-running Node process that polls `JobEvent`. This cannot run on Vercel serverless. Prediction recalculation must be moved to QStash or triggered differently. | `packages/shared/src/server/worker-process.ts` |
| C-6 | **env.ts does not include Upstash REST vars** — `REDIS_URL` assumes a native Redis connection string (`redis://`). Upstash on Vercel requires REST API vars (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`). The Redis adapter must switch to `@upstash/redis` (HTTP client). | `packages/shared/src/utils/env.ts` |

---

## Infrastructure Setup

### 1. Supabase — PostgreSQL Database

**Step 1.1 — Create project**
1. Go to [supabase.com](https://supabase.com) → New Project.
2. Name: `vesta-prod`. Region: `Southeast Asia (Singapore)` — closest available to Bangladesh.
3. Set a strong database password (save it; used for direct connections).
4. Wait for project to initialise (~2 minutes).

**Step 1.2 — Obtain connection strings**
In Project Settings → Database:
- **Direct URL** (for migrations): `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
- **Pooler URL** (for app runtime — Transaction mode, port 6543): `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true`

Use the pooler URL as `DATABASE_URL` in production. Use the direct URL as `DIRECT_URL` only for `prisma migrate deploy`.

**Step 1.3 — Enable pgcrypto extension**
In the Supabase SQL editor:
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

**Step 1.4 — Run migrations**
```bash
# From packages/shared/
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" \
  pnpm db:migrate:deploy
```

This applies both existing migrations:
- `20260526235248_init` — Full schema
- `20260526235330_add_rls` — Currently a stub (see blocker D-1)

**Step 1.5 — Apply RLS policies (manually until migration is written)**

Before this step, you must author a real RLS migration. The placeholder migration must be replaced with:

```sql
-- Enable RLS on sensitive tables
ALTER TABLE "period_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "symptom_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;

-- Policy: users can only access their own profiles
CREATE POLICY "profiles_user_isolation" ON "profiles"
  USING (
    "user_id" = current_setting('app.current_user_id', true)::text
  );

-- Policy: period_logs scoped to profiles owned by the user
CREATE POLICY "period_logs_user_isolation" ON "period_logs"
  USING (
    "profile_id" IN (
      SELECT id FROM "profiles"
      WHERE "user_id" = current_setting('app.current_user_id', true)::text
    )
  );

-- Policy: symptom_logs scoped to profiles owned by the user
CREATE POLICY "symptom_logs_user_isolation" ON "symptom_logs"
  USING (
    "profile_id" IN (
      SELECT id FROM "profiles"
      WHERE "user_id" = current_setting('app.current_user_id', true)::text
    )
  );
```

The application must set `app.current_user_id` on each DB session for RLS to take effect. This requires adding a Prisma middleware or `$executeRaw` call after authentication. This is currently not implemented.

**Step 1.6 — Auto-pause prevention**
Supabase Free pauses databases after 7 days of inactivity. Options (in priority order):

- **Option A (recommended):** Use the existing `caas-check` cron (02:00 UTC) to also ping the DB. A simple `SELECT 1` via Prisma adds negligible cost and uses a cron slot you already own.
- **Option B:** Merge all scheduled work into a single "combined cron" handler that runs at 02:00 UTC, freeing the 08:00 slot — but this changes the notification delivery time.
- **Option C (cost):** Upgrade to Supabase Pro ($25/month) — eliminates auto-pause risk entirely.

The keep-alive ping should be added to the `caas-check` cron because it already runs at 02:00 UTC:
```typescript
// Add at the top of caas-check handler
await prisma.$queryRaw`SELECT 1` // keep-alive ping
```

**Step 1.7 — Configure connection pooling**
- Use PgBouncer in **Transaction mode** (port 6543) for production `DATABASE_URL`.
- Do NOT use Session mode — Prisma with serverless functions requires Transaction mode.
- Add `?pgbouncer=true&connection_limit=1` to the pooler URL.

**Step 1.8 — Monitor storage**
Bookmark the Supabase dashboard → Storage → Database size. Set a calendar reminder to check weekly. The 500 MB cap becomes a concern once encrypted `symptom_logs.value` fields accumulate across many users (each blob is larger than plaintext).

---

### 2. Vercel — Frontend + API + Cron

**Step 2.1 — Create project**
1. Go to [vercel.com](https://vercel.com) → Add New → Project.
2. Import the `cycle-circle` GitHub repository.
3. Framework preset: **Next.js**.
4. Root directory: `apps/web` (monorepo root is `cycle-circle`).

**Step 2.2 — Build settings**
In Vercel project settings:
- Root directory: `apps/web`
- Build command: `cd ../.. && pnpm --filter @vesta/web build` (or `next build` if Vercel resolves deps via workspace)
- Output directory: `.next` (auto-detected)
- Install command: `pnpm install --frozen-lockfile`
- Node version: 20.x

**Step 2.3 — Create `vercel.json`**
Place this file at the repository root (`/cycle-circle/vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-reminders",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/caas-check",
      "schedule": "0 2 * * *"
    }
  ]
}
```

This uses both Hobby-plan cron slots. No additional crons can be added without upgrading to Vercel Pro or consolidating jobs.

**Step 2.4 — Function region**
In `vercel.json`, configure the function region closest to Bangladesh (AWS ap-south-1 Mumbai or ap-southeast-1 Singapore):
```json
{
  "regions": ["sin1"],
  "crons": [...]
}
```

Available regions near Bangladesh: `sin1` (Singapore), `bom1` (Mumbai). Singapore is Vercel's recommended Southeast Asia region.

**Step 2.5 — Environment variables**
Set all variables listed in the Environment Variables section below. Use the Vercel dashboard → Project Settings → Environment Variables. Set each for **Production** environment (and Preview if desired).

**Step 2.6 — Production domain**
After first deploy, configure the custom domain in Vercel → Domains. Vercel auto-provisions and renews SSL certificates via Let's Encrypt.

---

### 3. Upstash Redis

**Step 3.1 — Create database**
1. Go to [console.upstash.com](https://console.upstash.com) → Create Database.
2. Name: `vesta-prod`. Region: `ap-southeast-1` (Singapore).
3. Type: Regional (not Global — saves cost at free tier).
4. Enable TLS (required).

**Step 3.2 — Obtain credentials**
From the database details page:
- `UPSTASH_REDIS_REST_URL` — the `https://` REST endpoint
- `UPSTASH_REDIS_REST_TOKEN` — the REST token

**Step 3.3 — Update Redis adapter**
The current `redis.ts` adapter uses `ioredis` (TCP connection via `redis://` URL). Vercel serverless does not support persistent TCP connections well; Upstash recommends the HTTP REST client. Update the adapter to use `@upstash/redis`:

```bash
pnpm --filter @vesta/shared add @upstash/redis
```

Update `packages/shared/src/server/adapters/redis.ts` to use `new Redis({ url, token })` from `@upstash/redis`.

Update `packages/shared/src/utils/env.ts` to replace `REDIS_URL` with:
```typescript
UPSTASH_REDIS_REST_URL: z.string().min(1),
UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
```

---

### 4. Upstash QStash

**Step 4.1 — Access QStash**
QStash is available from the same Upstash console. No separate account needed.

**Step 4.2 — Obtain credentials**
- `QSTASH_URL` — `https://qstash.upstash.io/v2/publish/`
- `QSTASH_TOKEN` — signing token for publishing messages
- `QSTASH_CURRENT_SIGNING_KEY` + `QSTASH_NEXT_SIGNING_KEY` — for verifying inbound QStash requests at your endpoints

**Step 4.3 — Wire QStash for notification dispatch (pre-release task)**
Currently the daily-reminders cron sends all emails synchronously. This must change:

1. The cron handler (`/api/cron/daily-reminders`) should iterate profiles, then for each profile that needs a notification, publish a QStash message to a new endpoint (e.g., `/api/jobs/send-notification`).
2. The `/api/jobs/send-notification` handler receives the job payload, validates the QStash signature, and calls Resend.
3. QStash handles retry on failure, decoupling Resend delivery from the 10-second cron window.

```bash
pnpm --filter @vesta/shared add @upstash/qstash
```

**Step 4.4 — Wire QStash for prediction recalculation (pre-release task)**
The standalone worker process (`worker-process.ts`) polls `JobEvent` and cannot run on Vercel. Replace it:

1. In `tracking-actions.ts`, after creating/updating a period log, publish a QStash message to `/api/jobs/recalculate-prediction`.
2. The `/api/jobs/recalculate-prediction` handler validates the QStash signature and calls `recalculatePrediction`.

This eliminates the need for the Docker `worker` service in production.

---

### 5. Resend — Transactional Email

**Step 5.1 — Create account**
Go to [resend.com](https://resend.com) → Sign up.

**Step 5.2 — Add and verify sending domain**
1. Resend → Domains → Add Domain. Enter your production domain (e.g., `mail.vesta.app`).
2. Add the required DNS records (DKIM, SPF, DMARC) to your domain registrar.
3. Wait for verification (usually < 30 minutes).

**Step 5.3 — Create API key**
Resend → API Keys → Create API Key → set permissions to "Sending access". Copy the key for `RESEND_API_KEY`.

**Step 5.4 — Update from address**
Ensure the `from` address in `packages/shared/src/server/adapters/mail.ts` uses the verified domain (e.g., `noreply@vesta.app`), not a test address.

**Step 5.5 — Bengali email template verification**
Review `packages/shared/src/server/email-templates.ts` for the Bengali (`BN`) branches. Confirm all text is correct Bangla and renders correctly. Send test emails to a Bengali-locale device before launch.

**Step 5.6 — Free-tier budget**
Free tier: 3,000 emails/month, 100/day. At launch with a small user base this is sufficient. Monitor via the Resend dashboard. The upgrade trigger is approaching 2,500 emails/month (buffer for spikes).

---

### 6. BDApps — OTP, CAAS, SMS, Webhooks

**Step 6.1 — Register production application**
1. Go to the BDApps developer portal and register a production application (not the simulator).
2. Obtain `applicationId` (maps to `BDAPPS_APP_ID`) and `password` (maps to `BDAPPS_PASSWORD`).
3. Request access to: OTP API, CAAS API, SMS Send API.

**Step 6.2 — Register `paymentInstrumentName`**
The CAAS direct-debit API requires `paymentInstrumentName` to be pre-registered in the BDApps dashboard. Complete this before testing billing end-to-end.

**Step 6.3 — Register webhook URLs**
Once Vercel deploy is live, register the following URLs in the BDApps portal:

| Event | URL |
|-------|-----|
| Inbound SMS | `https://[your-domain]/api/webhooks/sms/receive` |
| SMS delivery report | `https://[your-domain]/api/webhooks/sms/report` |
| USSD event | `https://[your-domain]/api/webhooks/ussd/receive` |
| Subscription notification | `https://[your-domain]/api/webhooks/subscription/notify` |

**Step 6.4 — Obtain BDApps IP whitelist**
Request the list of IP addresses BDApps uses to send webhook callbacks. Set these as `BDAPPS_WEBHOOK_IPS` (comma-separated). Without this, webhook IP validation is permissive.

**Step 6.5 — Remove simulator config**
Ensure `BDAPPS_BASE_URL` is NOT set in production (it will default to `https://developer.bdapps.com`). Ensure `BDAPPS_SIMULATOR_BASE_URL` and `ENABLE_BDAPPS_SIMULATOR_CHECKER` are not present in the Vercel environment.

**Step 6.6 — Test end-to-end with real credentials**
Before announcing launch:
- OTP flow with a real Bangladeshi number
- CAAS charge with a real subscriber account
- Webhook receipt: trigger a test event from BDApps and confirm it appears in `webhook_events` table

---

### 7. Admin Panel — Separate Vercel Project

The admin app (`apps/admin/`) must be deployed as its own Vercel project, independent of the web app project created in §2.

**Step 7.1 — Create admin Vercel project**
1. Go to [vercel.com](https://vercel.com) → Add New → Project.
2. Import the same `cycle-circle` GitHub repository.
3. Framework preset: **Next.js**.
4. Root directory: `apps/admin` (this is how Vercel distinguishes the two apps within the monorepo).
5. Use the **same Vercel account** — both projects share Hobby-tier limits (bandwidth, invocation count, cron slots). The admin app has no cron jobs, so this does not consume the web app's 2 cron slots.

**Step 7.2 — Admin build settings**
In the admin Vercel project settings:
- Root directory: `apps/admin`
- Build command: `pnpm --filter @vesta/admin build` (or `next build` if Vercel resolves workspace deps automatically)
- Install command: `pnpm install --frozen-lockfile`
- Node version: 20.x

**Step 7.3 — Admin environment variables**
Set the following in the admin Vercel project → Environment Variables → Production:

| Variable | Description | Notes |
|----------|-------------|-------|
| `DATABASE_URL` | Same Supabase PostgreSQL pooler connection string as web app | Must be identical — same database |
| `UPSTASH_REDIS_REST_URL` | Same Upstash Redis REST endpoint | Shared session store |
| `UPSTASH_REDIS_REST_TOKEN` | Same Upstash Redis REST token | Shared session store |
| `JWT_SECRET` | **Must be identical to the web app's `JWT_SECRET`** | Shared so both apps can verify each other's tokens |
| `NEXT_PUBLIC_ADMIN_URL` | Admin app's production URL (e.g., `https://admin.vesta-app.com`) | Used in magic-link callback URLs |
| `RESEND_API_KEY` | Same Resend API key | Admin sends magic-link emails |
| `NODE_ENV` | `production` | Auto-set by Vercel |

**Step 7.4 — Admin domain**
Configure a subdomain for the admin app: `admin.vesta-app.com` (or `admin.[your-domain].com`). In your domain registrar:

| Type | Name | Value | Purpose |
|------|------|-------|---------|
| CNAME | `admin` | `cname.vercel-dns.com` | Admin Vercel project |

Vercel auto-provisions SSL for the subdomain.

**Step 7.5 — Cookie isolation on subdomains**

> **Critical:** Cookies set on `app.vesta-app.com` (or `vesta-app.com`) without an explicit `domain` attribute are NOT shared with `admin.vesta-app.com`. This is browser Same-Origin policy.

The admin app handles this correctly by design: it has its own magic-link login flow and sets its own `vesta_token` cookie on the admin subdomain after verifying the JWT. Both apps can verify each other's tokens because they share the same `JWT_SECRET`. Concretely:

- A user authenticated on `app.vesta-app.com` is **not** automatically authenticated on `admin.vesta-app.com`.
- An admin must log in via the admin magic-link flow (`/admin/login`) on the admin domain.
- The JWT payload includes the `role` field — admin middleware rejects tokens where `role !== 'ADMIN'`.
- `JWT_SECRET` must be identical across both Vercel projects so tokens signed in one app can be verified in the other if needed.

**Step 7.6 — Shared services layer**

Both apps import business logic from `@vesta/shared/server/services`. This has deployment implications:

- Any change to a shared service affects **both** the web app and admin app simultaneously.
- Always test both apps after changing shared service code.
- Schema changes require `prisma generate` (run `just db-generate`) before rebuilding either app.
- **Deployment order**: always run database migrations (`prisma migrate deploy`) BEFORE deploying either app. Both apps must be compatible with the same schema version.

---

### 8. Domain and DNS

**Step 8.1 — Purchase domain** (if not already owned)
Recommended: a `.app` or `.io` TLD. `.app` domains enforce HTTPS at the registry level.

**Step 8.2 — Configure DNS**
In your domain registrar's DNS panel:
- Add Vercel nameservers OR add the A/CNAME records Vercel provides after connecting the custom domain.
- Vercel provides: `76.76.21.21` (A record) for apex domains, `cname.vercel-dns.com` (CNAME) for subdomains.

**Step 8.3 — SSL**
Vercel automatically provisions and renews Let's Encrypt SSL certificates. No manual action needed after domain is connected.

**Step 8.4 — Email subdomain** (for Resend)
Add a `mail.` subdomain (or similar) for Resend DKIM/SPF. Recommend a subdomain so your root domain's email reputation is separate from transactional mail.

---

## Environment Variables

All variables must be set in Vercel → Project Settings → Environment Variables for the **Production** environment. Never commit `.env.local` or any file with production secrets.

### Required in Production

| Variable | Description | How to generate / obtain |
|----------|-------------|--------------------------|
| `DATABASE_URL` | Supabase PostgreSQL pooler connection string (PgBouncer Transaction mode, port 6543) | Supabase → Settings → Database → Connection Pooling |
| `JWT_SECRET` | Cryptographically random secret, minimum 64 characters | `openssl rand -base64 48` or `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
| `PRISMA_FIELD_ENCRYPTION_KEY` | AES-256-GCM key for `prisma-field-encryption` | Generated by `prisma-field-encryption` CLI: `npx prisma-field-encryption generate-key` |
| `CRON_SECRET` | Shared secret for authenticating Vercel Cron requests | `openssl rand -base64 32` |
| `BDAPPS_APP_ID` | BDApps production application identifier | BDApps developer portal |
| `BDAPPS_PASSWORD` | BDApps production application password | BDApps developer portal |
| `BDAPPS_WEBHOOK_IPS` | Comma-separated list of BDApps IP addresses allowed to call webhook endpoints | Request from BDApps support |
| `RESEND_API_KEY` | Resend transactional email API key | Resend dashboard → API Keys |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint (`https://...`) | Upstash console → Redis database |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token | Upstash console → Redis database |
| `QSTASH_TOKEN` | Upstash QStash publish token | Upstash console → QStash |
| `QSTASH_CURRENT_SIGNING_KEY` | QStash signing key for verifying inbound messages | Upstash console → QStash |
| `QSTASH_NEXT_SIGNING_KEY` | QStash next signing key (rotation) | Upstash console → QStash |
| `NODE_ENV` | Must be `production` | Set literally |

### Optional / Conditional

| Variable | Description | Notes |
|----------|-------------|-------|
| `BDAPPS_BASE_URL` | BDApps API base URL | Defaults to `https://developer.bdapps.com`; do NOT set in production |
| `BDAPPS_SIMULATOR_BASE_URL` | Simulator URL | Do NOT set in production |
| `DEV_MODE` | Enables dev-login bypass | Must be `false` (or absent) in production; `dev-login` route returns `notFound()` in production regardless |
| `MAILPIT_SMTP_URL` | Local email capture | Do NOT set in production |

### Variables NOT Needed in Production

- `REDIS_URL` — Replace with `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (see Infrastructure §3)

### Admin App Environment Variables

The admin Vercel project requires its own set of environment variables. Set these in the **admin** Vercel project settings (not the web app project):

| Variable | Description | Notes |
|----------|-------------|-------|
| `DATABASE_URL` | Same Supabase pooler URL as web app | Must point to the same database |
| `UPSTASH_REDIS_REST_URL` | Same as web app | Shared cache/session store |
| `UPSTASH_REDIS_REST_TOKEN` | Same as web app | Shared cache/session store |
| `JWT_SECRET` | **Identical to web app `JWT_SECRET`** | Critical — see cookie note below |
| `NEXT_PUBLIC_ADMIN_URL` | `https://admin.[your-domain].com` | Used for magic-link callback URLs |
| `RESEND_API_KEY` | Same as web app (or a separate key) | Admin sends magic-link emails |
| `NODE_ENV` | `production` | Auto-set by Vercel |

> **JWT_SECRET must match across both apps.** If `JWT_SECRET` differs between the web app and admin app, tokens issued by one cannot be verified by the other. Use the same cryptographically random value in both Vercel projects.

### Important Security Notes

- `JWT_SECRET` must be at least 32 characters (enforced by `env.ts`). Recommend 64+ characters. **The same value must be used in both the web app and admin app Vercel projects.**
- `PRISMA_FIELD_ENCRYPTION_KEY` must be stored securely. Rotating this key requires re-encrypting all existing encrypted fields. Do not rotate without a migration plan.
- Never expose `CRON_SECRET` publicly. Vercel sends it as the `Authorization: Bearer` header when invoking cron endpoints.
- `BDAPPS_PASSWORD` is equivalent to an API key. Treat with the same security as a private key.
- The admin app does not need `BDAPPS_*` or `QSTASH_*` variables unless admin SMS broadcast is wired to QStash.

---

## Database Migration Strategy

### Running the Initial Migration

Prisma `migrate deploy` (not `migrate dev`) is used for production:

```bash
# Requires direct (non-pooled) connection for DDL
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" \
  pnpm --filter @vesta/shared db:migrate:deploy
```

If using PgBouncer pooler, update `schema.prisma` to add `directUrl`:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")      // pooler URL for runtime
  directUrl = env("DIRECT_URL")        // direct URL for migrations
}
```

### Vercel Build Hook for Migrations

Add to `apps/web/package.json`:
```json
{
  "scripts": {
    "build": "prisma migrate deploy && next build"
  }
}
```

But `prisma migrate deploy` must run from `packages/shared/`, not `apps/web/`. Set the Vercel build command to:
```
pnpm --filter @vesta/shared db:migrate:deploy && pnpm --filter @vesta/web build
```

Or use a root `package.json` build script that chains both.

### RLS Policy Setup

The current RLS migration is a stub. Before launch, author a new migration:
```bash
# From packages/shared/
pnpm db:migrate -- --name add_rls_policies
```

Edit the generated SQL file to include the actual `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `CREATE POLICY` statements (see Infrastructure §1.5).

Additionally, the Prisma client must inject `SET LOCAL app.current_user_id = '[user_id]'` at the start of each database session for RLS to evaluate correctly. This requires a Prisma middleware:

```typescript
prisma.$use(async (params, next) => {
  // Set the user context for RLS
  await prisma.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${userId}'`)
  return next(params)
})
```

This is a non-trivial change that requires careful integration with the auth layer.

### Admin Panel Schema Migration

The admin panel requires a new migration before it can be deployed. The following additions to `schema.prisma` must be authored and applied:

**New models:**
- `Article` — CMS content with `title`, `slug`, `content` (Tiptap JSON), `status` (ArticleStatus enum), `categoryId`, `authorId`, `publishedAt`
- `ArticleCategory` — taxonomy for articles
- `SmsBroadcast` — bulk SMS job queue with `status` (SmsBroadcastStatus enum), target segment, message body, sent/failed counts
- `AdminAuditLog` — immutable audit trail for admin actions (who did what, when, on which entity)

**Additions to existing models:**
- `User`: `suspendedAt DateTime?`, `suspendedBy String?`, `deletedAt DateTime?` (soft-delete), `lastLoginAt DateTime?`
- `Subscription`: admin override fields (`adminOverrideNote String?`, `adminOverriddenAt DateTime?`, `adminOverriddenBy String?`)

**New enums:**
- `ArticleStatus`: `DRAFT`, `PUBLISHED`, `ARCHIVED`
- `CyclePhase`: `MENSTRUAL`, `FOLLICULAR`, `OVULATION`, `LUTEAL` (for article tagging and analytics)
- `SmsBroadcastStatus`: `PENDING`, `SENDING`, `COMPLETED`, `FAILED`, `CANCELLED`

**Create and apply the migration:**
```bash
# From packages/shared/
pnpm db:migrate -- --name add_admin_models
```

Edit the generated migration SQL as needed, then apply to production:
```bash
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" \
  pnpm --filter @vesta/shared db:migrate:deploy
```

### Admin Seed Data

Unlike the main user seed (which must NOT run in production), admin user creation is required:

```typescript
// packages/shared/prisma/seed-admin.ts (separate from the dev seed)
await prisma.user.upsert({
  where: { phone: '+8801XXXXXXXXX' }, // or email for magic-link
  update: { role: 'ADMIN' },
  create: {
    phone: '+8801XXXXXXXXX',
    role: 'ADMIN',
    subscriptionStatus: 'FREE',
  },
})
```

Run this targeted seed once after the initial migration:
```bash
DIRECT_URL="postgresql://..." pnpm --filter @vesta/shared exec ts-node prisma/seed-admin.ts
```

Alternatively, create the admin user directly via Supabase SQL editor:
```sql
INSERT INTO "users" (id, phone, role, "subscriptionStatus", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), '+8801XXXXXXXXX', 'ADMIN', 'FREE', now(), now());
```

### Seed Data

Do NOT run `pnpm db:seed` in production. The seed script is for local development only. Ensure the Vercel build command does not invoke it.

### Backup Strategy

- Supabase Free provides **no automatic backups**. Manual backups only.
- Before any migration, take a manual backup: Supabase dashboard → Project → Backups → Generate backup.
- **Upgrade trigger for backups:** Supabase Pro ($25/month) provides daily Point-in-Time Recovery (PITR) backups. Strongly recommended once paying users exist.

### Migration Rollback

Prisma does not support automatic rollback. If a migration fails in production:
1. Identify the failing statement in Supabase logs.
2. Write a new "down" migration manually and apply via `db:migrate:deploy`.
3. For catastrophic failures: restore from last manual backup.

---

## Vercel Configuration

### `vercel.json` (place at repository root)

```json
{
  "buildCommand": "pnpm --filter @vesta/shared db:migrate:deploy && pnpm --filter @vesta/web build",
  "installCommand": "pnpm install --frozen-lockfile",
  "outputDirectory": "apps/web/.next",
  "framework": "nextjs",
  "regions": ["sin1"],
  "crons": [
    {
      "path": "/api/cron/daily-reminders",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/cron/caas-check",
      "schedule": "0 2 * * *"
    }
  ]
}
```

Note: Vercel's monorepo detection may handle the root directory automatically if you set "Root Directory" to `apps/web` in the project settings. If so, the `buildCommand` in `vercel.json` may conflict. Test with a preview deploy first.

### Function Timeout

The default 10-second timeout applies to all functions on Hobby. Functions that may approach this limit:
- `POST /api/billing/subscribe` — makes a BDApps network call
- `POST /api/cron/daily-reminders` — currently synchronous email loop (must be moved to QStash)
- `POST /api/cron/caas-check` — uses `Promise.allSettled` across all Pro subscribers

The `caas-check` cron uses `Promise.allSettled` which parallelises correctly. The `daily-reminders` cron loops sequentially — this is the primary timeout risk at scale.

### Cron Authentication

Vercel automatically sends `Authorization: Bearer [CRON_SECRET]` when invoking cron endpoints. The `withCronAuth` middleware in `packages/shared/src/server/middleware.ts` validates this header. Ensure `CRON_SECRET` is set in Vercel env vars.

### Preview Deployments

Vercel creates a preview deployment for every PR. To avoid running cron jobs or sending real emails in preview:
- Set `RESEND_API_KEY` to empty/absent in Preview environment (email sending is null-safe in dev).
- Set `BDAPPS_APP_ID` and `BDAPPS_PASSWORD` to simulator values in Preview.
- Cron jobs in preview deployments are not triggered automatically by Vercel (they only run on Production).

---

## DNS and Domain Setup

### DNS Records Required

| Type | Name | Value | Purpose |
|------|------|-------|---------|
| A | `@` (apex) | `76.76.21.21` | Vercel production (web app) |
| CNAME | `www` | `cname.vercel-dns.com` | Vercel www redirect |
| CNAME | `admin` | `cname.vercel-dns.com` | Vercel admin app subdomain |
| TXT | `@` | SPF record from Resend | Email authentication |
| CNAME | `mail._domainkey` | DKIM from Resend | Email signing |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@[domain]` | DMARC policy |

### SSL Configuration

Vercel provisions SSL automatically. No manual action needed. Certificates renew automatically 30 days before expiry.

### HSTS Preload

After SSL is verified and stable for 30+ days, add HSTS header and consider submitting to the HSTS preload list:
```typescript
{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' }
```
Add this to `next.config.ts` headers.

---

## Pre-Launch Checklist

Work through this list in order. Each item is a gate; do not skip forward.

### Phase 1 — Code Complete

- [ ] **S-1 CRITICAL**: Install `prisma-field-encryption`, add `@encrypted` annotation to `SymptomLog.value`, generate and store `PRISMA_FIELD_ENCRYPTION_KEY`, verify a direct SQL query returns ciphertext (not plaintext)
- [ ] **S-2**: Verify Prisma 6.19.3 is compatible with the installed `prisma-field-encryption` version, or downgrade to 6.13.x per SRS constraint (NFR-MAINT-02)
- [ ] **C-1**: Wire `ProfileCompletionModal` to call `completeProfile` Server Action
- [ ] **C-4 / I-3**: Refactor `daily-reminders` cron to dispatch notifications via QStash instead of synchronous loop
- [ ] **C-5 / I-3**: Replace `worker-process.ts` with QStash-triggered `/api/jobs/recalculate-prediction` endpoint
- [ ] **C-6**: Update Redis adapter to use `@upstash/redis` HTTP client; update `env.ts` to use `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
- [ ] **S-5**: Add `Strict-Transport-Security` header to `next.config.ts`
- [ ] **S-6**: Add Content-Security-Policy header to `next.config.ts`
- [ ] All 22 Vitest tests pass: `just test`
- [ ] Zero TypeScript errors: `just typecheck-all`

### Phase 2 — Infrastructure Provisioned

- [ ] Supabase production project created (Singapore region)
- [ ] `pgcrypto` extension enabled in Supabase
- [ ] Upstash Redis database created (Singapore region)
- [ ] Upstash QStash configured
- [ ] Resend account created, domain verified, API key generated
- [ ] BDApps production application registered, credentials obtained
- [ ] BDApps `paymentInstrumentName` registered
- [ ] Custom domain purchased and DNS configured
- [ ] Vercel project created and connected to GitHub repo

### Phase 3 — Database Migrated

- [ ] Real RLS migration authored (replacing stub) and committed
- [ ] `schema.prisma` updated with `directUrl` for migration support
- [ ] Initial migrations applied to Supabase production via `prisma migrate deploy`
- [ ] RLS policies verified: direct SQL query with a different `app.current_user_id` cannot read another user's period_logs
- [ ] Encryption verified: `symptom_logs.value` column shows ciphertext in raw SQL query
- [ ] Keep-alive ping added to `caas-check` cron (`SELECT 1` via Prisma)
- [ ] No seed data in production DB

### Phase 4 — Environment Variables Set

- [ ] All Required env vars set in Vercel Production environment
- [ ] `env.local` NOT present in repo (verified in `.gitignore`)
- [ ] `NODE_ENV=production` confirmed (auto-set by Vercel)
- [ ] `BDAPPS_WEBHOOK_IPS` populated with real BDApps IP whitelist
- [ ] `BDAPPS_SIMULATOR_BASE_URL` NOT present in production env
- [ ] `DEV_MODE` NOT set (or set to `false`) in production env
- [ ] `JWT_SECRET` is cryptographically random (64+ chars), not the dev default
- [ ] `CRON_SECRET` is cryptographically random, not the dev default

### Phase 5 — First Deploy and Smoke Tests

- [ ] First production deploy succeeds (check Vercel build logs)
- [ ] `GET /api/auth/status` returns a valid response
- [ ] `GET /` redirects correctly (unauthenticated → `/login`)
- [ ] Login page loads in both EN and BN with no font errors
- [ ] 375px viewport tested in both languages — no overflow or broken layout
- [ ] Cookie flags verified: `HttpOnly`, `Secure`, `SameSite=Lax` on `vesta_token` cookie
- [ ] Security headers verified at [securityheaders.com](https://securityheaders.com): A or A+ rating

### Phase 6 — End-to-End Feature Tests

- [ ] OTP flow: request → receive SMS on real Bangladeshi number → verify → account created → JWT issued
- [ ] Email magic-link flow: request → receive email via Resend → click link → account created → trial timer starts
- [ ] Email trial enforcement: attempt access after manually advancing `emailTrialExpiresAt` past now → HTTP 402 returned
- [ ] Profile completion modal: appears after OTP login, successfully calls `completeProfile` Server Action
- [ ] Create profile → log period → verify prediction appears on dashboard and calendar
- [ ] Symptom logging: log symptoms on today's date → verify stored (check DB to confirm ciphertext if FR-ENC is complete)
- [ ] Pro upgrade: BDApps CAAS direct debit with real subscriber account → `subscriptionStatus = PRO` in DB
- [ ] Webhook: trigger test event from BDApps → confirm receipt in `webhook_events` table
- [ ] Cron manual test: `curl -X POST https://[domain]/api/cron/daily-reminders -H "Authorization: Bearer [CRON_SECRET]"` → returns processed count, no timeout
- [ ] Cron manual test: `curl -X POST https://[domain]/api/cron/caas-check -H "Authorization: Bearer [CRON_SECRET]"` → returns checked/healthy/failures counts

### Phase 7 — BDApps Webhook Registration

- [ ] Webhook URLs registered in BDApps portal (all four endpoints)
- [ ] Test inbound SMS received and persisted
- [ ] Test subscription notify received and `subscriptionStatus` updated in DB
- [ ] IP whitelist (`BDAPPS_WEBHOOK_IPS`) confirmed blocking non-BDApps requests: send request from non-whitelisted IP → HTTP 401

### Phase 8 — Monitoring and Observability

- [ ] Error monitoring configured (Sentry free tier recommended — see Post-Launch Monitoring)
- [ ] Uptime check configured (UptimeRobot free tier: ping `GET /api/auth/status` every 5 minutes)
- [ ] Supabase dashboard bookmarked and storage size noted as baseline
- [ ] Resend delivery rate baseline established (send 5 test emails, verify all delivered)
- [ ] Vercel function logs reviewed for any errors from first 24 hours of traffic

### Phase 9 — Admin Panel Deployment

- [ ] Admin panel schema migration authored (Article, ArticleCategory, SmsBroadcast, AdminAuditLog models + User/Subscription additions)
- [ ] New enums added to schema: `ArticleStatus`, `CyclePhase`, `SmsBroadcastStatus`
- [ ] Admin migration applied to production Supabase via `prisma migrate deploy`
- [ ] Initial admin user created in production database (`role: 'ADMIN'`, with phone/email for magic link login)
- [ ] Admin Vercel project created and connected to GitHub repo (root directory: `apps/admin`)
- [ ] Admin environment variables set in admin Vercel project (especially `JWT_SECRET` matching web app)
- [ ] `NEXT_PUBLIC_ADMIN_URL` set to production admin URL
- [ ] Admin subdomain DNS record configured (`admin.[domain]` → `cname.vercel-dns.com`)
- [ ] Admin Vercel project custom domain connected and SSL provisioned
- [ ] Admin app deploys successfully (check Vercel build logs)
- [ ] Admin login flow verified end-to-end: magic-link request → email received via Resend → click link → JWT issued → admin dashboard loads
- [ ] Admin middleware verified: attempt to access admin dashboard with a non-ADMIN role JWT → redirected to login
- [ ] Admin middleware verified: attempt to access admin dashboard with no cookie → redirected to login
- [ ] Resend configured to send admin magic-link emails from verified domain
- [ ] Tiptap editor: Bengali text renders correctly in article editor (test with sample Bangla content)
- [ ] Recharts/analytics charts render correctly in production build (no SSR issues)
- [ ] Both web app and admin app verified working after shared service changes (test both login flows after any `@vesta/shared` update)
- [ ] Add UptimeRobot check for admin app: ping `GET https://admin.[domain]/api/health` every 5 minutes

---

## Challenges and Risks

### 1. Vercel Hobby 10-Second Function Timeout

**Risk level:** HIGH

**Scenario:** The `daily-reminders` cron currently sends emails synchronously in a `for` loop. With 100+ users, each `sendPeriodAlert` call (which may involve an HTTP request to Resend plus optionally BDApps SMS) could push total time over 10 seconds.

**Mitigation:** QStash dispatch (see Code Blocker C-4). The cron handler should take <1 second per profile (just publishing to QStash), and the actual email/SMS sending happens in separate serverless invocations that each have their own 10-second budget. This is the architecture described in the SRS but not yet implemented.

**Current state:** Not wired. This is a pre-release blocker for any meaningful user base.

### 2. Supabase Free Auto-Pause

**Risk level:** HIGH

**Scenario:** Supabase Free pauses databases after 7 days without a connection. If the app goes quiet over a weekend, users returning Monday could see database errors until Supabase automatically un-pauses (which can take 30–60 seconds and cause the first request to fail or time out).

**Mitigation options:**
- Add a `SELECT 1` keep-alive ping to the `caas-check` cron (runs at 02:00 UTC daily — well within the 7-day window). This costs zero additional cron slots.
- Monitor: if auto-pause occurs despite the ping, upgrade to Supabase Pro ($25/month) immediately.

**Current state:** Not implemented. Add to `caas-check` handler before launch.

### 3. Two Cron Job Limit — No Slots for Supabase Keep-Alive

**Risk level:** MEDIUM

**Scenario:** The 2 Vercel Hobby cron slots are fully consumed by `daily-reminders` (08:00 UTC) and `caas-check` (02:00 UTC). There is no slot for a dedicated Supabase keep-alive cron.

**Mitigation:** Fold the keep-alive ping into an existing cron. The `caas-check` cron at 02:00 UTC is the natural home — add `await prisma.$queryRaw\`SELECT 1\`` at the start of the handler. This resolves the constraint at zero cost.

**If more crons are ever needed:** Upgrade to Vercel Pro ($20/month) — provides unlimited crons.

### 4. Field Encryption Not Implemented (FR-ENC)

**Risk level:** CRITICAL — DoD blocker**

**Scenario:** `symptom_logs.value` (which contains sensitive reproductive health data — symptoms like "spotting", "cramping", mood states, discharge types) is stored as plaintext in PostgreSQL. A database dump or direct SQL access exposes all health data without protection.

**Mitigation:** Install `prisma-field-encryption`, add `@encrypted` annotation to the schema field, generate `PRISMA_FIELD_ENCRYPTION_KEY`, and apply via migration. Key management is critical: losing the encryption key makes all encrypted data permanently unreadable.

**Key rotation risk:** If the key is ever rotated, all existing encrypted rows must be re-encrypted in a migration. Plan for this from day one.

**Prisma version risk:** The SRS pins Prisma to 6.13.x for this library. Current version is 6.19.3. Test compatibility thoroughly, or downgrade before adding encryption.

### 5. RLS Not Active

**Risk level:** HIGH

**Scenario:** The RLS migration is a stub. Row Level Security is not enabled on `period_logs`, `symptom_logs`, or `profiles`. Data isolation relies entirely on application code (ownership checks in Server Actions). A bug in any Server Action could expose one user's health data to another.

**Mitigation:** Author and apply the real RLS migration (see Database Migration Strategy). Additionally, implement the Prisma middleware to set `app.current_user_id` per session. Test by querying the DB directly with a different `app.current_user_id` value and confirming rows are not returned.

**Complexity warning:** RLS with Prisma and PgBouncer Transaction mode has known gotchas. `SET LOCAL` only applies within a transaction; ensure all Prisma operations that need RLS are wrapped in `$transaction`. Test this integration carefully before launch.

### 6. QStash Not Wired — Synchronous Notification Sending

**Risk level:** HIGH

**Scenario:** The SRS architecture requires QStash for all async work. Neither notification dispatch nor prediction recalculation uses QStash. The worker process cannot run on Vercel at all.

**Mitigation:** See Code Blockers C-4 and C-5. Both must be resolved before production. The `@upstash/qstash` library provides a simple `client.publish({ url, body })` API.

**Double-sending risk:** When moving to QStash, implement idempotency in the notification job handlers. A QStash retry on a failed handler could send the same email twice. Use the existing `idempotencyKey` pattern (already used in `WebhookEvent`) for job deduplication.

### 7. No Error Monitoring

**Risk level:** MEDIUM

**Scenario:** Production errors (uncaught exceptions, BDApps API failures, Resend delivery failures) are currently only visible in Vercel function logs. There is no alerting, grouping, or stack-trace correlation.

**Mitigation:** Integrate Sentry (free tier: 5,000 errors/month) before launch. Add to `apps/web`:
```bash
pnpm --filter @vesta/web add @sentry/nextjs
```
Run `npx @sentry/wizard@latest -i nextjs` to configure. Set `SENTRY_DSN` in Vercel env vars.

Priority events to monitor: BDApps API errors, CAAS charge failures, Resend failures, cron timeouts.

### 8. BDApps Sandbox to Production Transition

**Risk level:** HIGH

**Scenario:** All current testing is against the BDApps simulator (Docker container). Production BDApps behaves differently: real network latency, real rate limiting (which may be stricter than documented), real CAAS charges.

**Mitigation:**
- Test with a real development BDApps account (separate from production) before using production credentials.
- Use a real Bangladeshi number for OTP testing.
- Make a real CAAS test charge with a small amount before going live.
- Have BDApps support contact available.

**Webhook URL transition:** The simulator uses `http://localhost:7000`. In production, the app calls `https://developer.bdapps.com`. Verify `BDAPPS_BASE_URL` defaults are correct and no simulator URLs leak into production.

### 9. Prisma Version Constraint

**Risk level:** MEDIUM

**Scenario:** The SRS pins Prisma to 6.13.x for `prisma-field-encryption` compatibility (NFR-MAINT-02). Current installed version is 6.19.3. Installing `prisma-field-encryption` without checking compatibility may cause runtime errors or schema generation failures.

**Mitigation:**
1. Check `prisma-field-encryption` npm page for the latest supported Prisma version.
2. If 6.19.x is not supported, pin `prisma` and `@prisma/client` to `6.13.x` in `packages/shared/package.json`.
3. If 6.13.x introduces a security vulnerability, file an issue with `prisma-field-encryption` maintainers before proceeding.
4. Lock the version in `pnpm-lock.yaml` and add a comment in `package.json` explaining the constraint.

### 10. Admin Cookie Isolation on Separate Subdomains

**Risk level:** MEDIUM

**Scenario:** When the web app runs on `app.vesta-app.com` and the admin app runs on `admin.vesta-app.com`, session cookies set by one app are not automatically available to the other. Browser Same-Origin policy scopes cookies to the exact domain that set them unless the `domain` attribute is explicitly set to the parent domain (e.g., `.vesta-app.com`).

**Design decision:** The admin app uses its own independent login flow (magic-link email → JWT set on admin subdomain). This is intentionally separate from the user-facing OTP flow. Admin users must always log in on the admin subdomain.

**Mitigation:**
- Do NOT attempt to share cookies across subdomains by setting `domain=.vesta-app.com` — this would allow a web-app session to authenticate against admin endpoints, which is a security regression.
- Keep admin login fully independent. The `JWT_SECRET` being shared means both apps can issue tokens that either can verify, but each app only accepts its own login flow.
- Test admin login end-to-end on the real subdomain before launch. Local dev (same `localhost` origin) may mask this issue.

### 11. Admin User Creation — No Self-Registration

**Risk level:** HIGH (operational blocker)

**Scenario:** There is no UI for creating admin users. The first admin account must be bootstrapped via direct database insert or a one-time seed script. Without this, the admin panel is unreachable even after deployment.

**Mitigation:**
- Create the initial admin user via Supabase SQL editor immediately after running the admin migration.
- Document the SQL snippet in an internal runbook (phone or email field, `role: 'ADMIN'`).
- Never expose an admin-creation API endpoint without strong authentication (e.g., a separate management token, or IP restriction).

### 12. Tiptap Bundle Size in Admin

**Risk level:** LOW

**Scenario:** Tiptap (rich text editor for article authoring) adds approximately 200 KB to the admin JavaScript bundle. This increases initial load time for the admin panel, though this is a lower priority than the user-facing web app.

**Mitigation:**
- Use Next.js dynamic imports for the Tiptap editor component: `const TiptapEditor = dynamic(() => import('@/components/TiptapEditor'), { ssr: false })`. This defers the 200 KB until the editor is actually opened.
- Avoid including Tiptap in any admin pages that do not need it (list views, user management, analytics).

### 13. Analytics Query Performance at Scale

**Risk level:** MEDIUM (future concern)

**Scenario:** Population-level admin analytics queries (cycle length distribution across all users, retention cohorts, symptom frequency heatmaps) require aggregating across all `period_logs` and `symptom_logs` rows. On a large dataset these queries may be slow on the Supabase free tier, which shares compute resources.

**Mitigation:**
- For launch: limit admin analytics to simple counts and date-range filters. Avoid cross-table aggregations with no date bounds.
- Post-launch: add indexes on `period_logs.start_date` and `symptom_logs.created_at` for time-series queries.
- At scale: consider Postgres materialized views refreshed nightly, or caching aggregated stats in Upstash Redis.

### 14. Previously: No Admin Panel (Resolved — Admin App Scaffolded)

**Risk level:** LOW (monitoring)

**Previous scenario:** FR-ADMIN was not started. There was no way to manage users, view subscriptions, or publish articles without direct database access.

**Current state:** The admin app (`apps/admin/`) is scaffolded and being developed. For the period between web app launch and admin app deployment, the team should:
- Grant Supabase dashboard access to team members who need it.
- Use Prisma Studio (`just studio`) for local inspection.
- Document common admin SQL queries (suspend user, grant/revoke Pro, view feedback) as an internal runbook.

Prioritise completing and deploying the admin app for v1.1.

### 15. Email Trial Infinite Reset — Fixed, But Verify

**Risk level:** LOW (fixed, verify in production)

**Scenario:** The fix (trial set only on first user creation, not on re-login) is implemented and tested. However, verify in production that the `emailTrialExpiresAt` field is NOT updated when an existing user clicks a magic-link for the second time.

**Verification:** Log in via magic-link → check DB for `emailTrialExpiresAt`. Log in again via magic-link → confirm `emailTrialExpiresAt` has not changed.

### 16. No Automated UI Tests

**Risk level:** MEDIUM (long-term quality)

**Scenario:** There are 22 Vitest tests for Server Actions, but zero UI/E2E tests. Visual regressions (broken Bengali layout, broken calendar grid) will only be caught by manual QA.

**Mitigation:**
- Before launch: manually test all 21 screens at 375px in both EN and BN.
- Post-launch: add Playwright E2E tests for the critical happy paths (login → log period → view dashboard).
- The SRS requires Bengali layout not to overflow at 375px (NFR-I18N-02). This is a DoD gate that requires manual verification.

---

## Post-Launch Monitoring

### Health Endpoint

Set up UptimeRobot (free tier) to ping `GET https://[domain]/api/auth/status` every 5 minutes. Alert on any non-200 response.

### Vercel Function Logs

- Monitor from Vercel dashboard → Functions → Logs.
- Filter for `error` and `timeout` keywords.
- Pay special attention to cron invocation logs (08:00 and 02:00 UTC) for the first week.

### Supabase Dashboard

Weekly checks:
- Storage used vs. 500 MB cap (Settings → Usage)
- Active connections vs. pooler limit
- Query performance (slow query log)

Alert threshold: trigger Supabase Pro upgrade when storage exceeds 400 MB.

### Upstash Redis and QStash

- Redis: monitor daily command count vs. 10,000/day limit and memory vs. 256 MB
- QStash: monitor message count vs. 500/day limit

From the Upstash console, set email alerts for 80% of free tier limits.

### Resend Dashboard

- Monitor delivered vs. bounced vs. complained rates daily.
- A bounce rate above 5% risks domain reputation damage.
- Monitor daily send count vs. 100/day hard limit. If a cron run sends >100 emails, Resend will start rejecting them silently.

Alert threshold: 80 emails in a single day triggers a review of the QStash dispatch batch size.

### BDApps Webhook Delivery

- Check `webhook_events` table daily for any gaps in expected events.
- A gap in `SUBSCRIPTION_NOTIFY` events may indicate BDApps is failing to reach the webhook URL.
- Monitor `caas_transactions` for any high failure rates.

### Sentry (after integration)

- Review new issues daily for the first week post-launch.
- Set up Slack or email alerts for high-frequency errors (>10 occurrences in 1 hour).
- Monitor for BDApps `timeout` errors — these indicate upstream problems requiring exponential backoff to activate.

---

## Cost Projection

### Current Stack at $0/month

| Service | Free Limit | Approximate Users Before Upgrade |
|---------|------------|----------------------------------|
| Vercel Hobby (web app) | 100 GB bandwidth, 1M invocations/month, 10s timeout | ~5,000–10,000 MAU before bandwidth concern; timeout concern hits at much lower scale if QStash not implemented |
| Vercel Hobby (admin app) | Shared with web app project OR a second Hobby account ($0) | Admin traffic is negligible; the admin app is a separate Vercel project. On Hobby, each GitHub repo can have multiple projects on the same account sharing the same Hobby limits. |
| Supabase Free | 500 MB database, 1 GB file storage, no backups | ~2,000–5,000 users with symptom data (encrypted blobs are larger; estimate 5–10 MB per active user per month of logging). Article content and admin audit logs add marginal storage. |
| Supabase Storage (article images) | 1 GB file storage (included in free tier) | Article image uploads via the admin CMS fit within free tier at launch scale. |
| Upstash Redis Free | 10,000 commands/day, 256 MB | ~500–1,000 DAU (each login = ~3–5 Redis ops; each OTP = ~3 ops; rate limit checks = 2 ops). Admin sessions add minimal Redis overhead. |
| Upstash QStash Free | 500 messages/day | ~500 notifications/day maximum across all users |
| Resend Free | 3,000 emails/month, 100/day | ~100 active users receiving daily notifications (period alert + fertile alert + reminder = 3 emails/user potentially). Admin magic-link emails add ~1–2 emails/day at most. |

### Upgrade Triggers and Costs

| Trigger | Upgrade | Monthly Cost |
|---------|---------|--------------|
| Supabase auto-pause becomes customer-visible | Supabase Pro | +$25/month |
| DB storage > 400 MB | Supabase Pro | +$25/month |
| Daily email count consistently approaching 100 | Resend Starter (50K/month) | +$20/month |
| Daily notifications > 400/day | Upstash QStash PAYG | ~$1–5/month |
| Redis commands > 8,000/day | Upstash Redis PAYG | ~$0.20 per 100K commands |
| Cron timeout issues | Vercel Pro | +$20/month |
| Functions > 10 seconds needed | Vercel Pro | +$20/month |
| Bandwidth > 80 GB/month | Vercel Pro | +$20/month |

### First Paid Tier Estimate

With reasonable growth assumptions:
- **Month 1–3 post-launch:** Free tier covers everything (<100 daily active users)
- **Month 3–6:** Supabase Pro likely needed first ($25/month) — auto-pause is a reliability risk regardless of user count
- **Month 6–12:** Resend upgrade if notification volume grows ($20/month)
- **First year total maximum:** $540 ($45/month at full first-tier upgrades)

### Recommendation

Upgrade Supabase to Pro immediately once the first paying subscriber exists (before storage is a concern). The auto-pause risk is a customer-facing reliability problem even at very low scale. The $25/month cost is easily justified by one Pro subscriber paying 5 BDT/month (approximately — the CAAS subscription amount).

---

## Appendix: Key File Locations

### Web App

| What | Where |
|------|-------|
| Next.js config | `apps/web/next.config.ts` |
| Auth middleware | `apps/web/src/middleware.ts` |
| Cron: daily reminders | `apps/web/src/app/api/cron/daily-reminders/route.ts` |
| Cron: CAAS check | `apps/web/src/app/api/cron/caas-check/route.ts` |
| Webhook endpoints | `apps/web/src/app/api/webhooks/` |

### Admin App

| What | Where |
|------|-------|
| Admin Next.js config | `apps/admin/next.config.ts` |
| Admin auth middleware | `apps/admin/src/middleware.ts` |
| Admin login flow | `apps/admin/src/app/` |

### Shared Package

| What | Where |
|------|-------|
| Environment schema | `packages/shared/src/utils/env.ts` |
| Prisma schema | `packages/shared/prisma/schema.prisma` |
| Migrations | `packages/shared/prisma/migrations/` |
| Redis adapter | `packages/shared/src/server/adapters/redis.ts` |
| BDApps adapter | `packages/shared/src/server/adapters/bdapps.ts` |
| Email templates | `packages/shared/src/server/email-templates.ts` |
| Auth logic | `packages/shared/src/server/auth.ts` |
| Shared middleware | `packages/shared/src/server/middleware.ts` |
| Shared services | `packages/shared/src/server/services/` |

### Infrastructure

| What | Where |
|------|-------|
| Docker local dev | `ops/docker/compose.yml` |
