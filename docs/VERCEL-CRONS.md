# Vercel Crons — Setup & Verification

How Vesta's scheduled jobs run on Vercel, how to verify them, and what to watch for
on the **Hobby (free) plan** the web project is on. Companion to
[`../STAGING-DEPLOY-PLAN.md`](../STAGING-DEPLOY-PLAN.md).

## The two cron jobs

Declared in `apps/web/vercel.json` (web project only — admin has no crons):

```json
"crons": [
  { "path": "/api/cron/daily-reminders", "schedule": "0 8 * * *" },
  { "path": "/api/cron/caas-check",       "schedule": "0 2 * * *" }
]
```

| Job | Schedule (UTC) | What it does |
|---|---|---|
| `daily-reminders` | `0 8 * * *` (08:00) | Period/fertile/logging/profile reminders, then dispatches the scheduled daily SMS broadcast. |
| `caas-check` | `0 2 * * *` (02:00) | Supabase keep-alive ping + daily subscription check: asks BDApps for each Pro subscriber's status, downgrades UNREGISTERED numbers and restores re-subscribed ones (no CaaS calls; slug is historical). |

Both routes: `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `maxDuration = 60`,
and export **both `GET` and `POST`** (Vercel Cron calls `GET`; `POST` is for manual /
admin triggers). Schedules are UTC — `0 8 * * *` is 08:00 UTC = 14:00 Asia/Dhaka.

## Authentication — `CRON_SECRET` is required

Vercel Cron invokes each `path` with **`GET`** and automatically attaches
`Authorization: Bearer $CRON_SECRET` **when a `CRON_SECRET` env var exists on the
project**. The handler is wrapped by `withCronAuth`
(`packages/shared/src/server/middleware.ts`), which:

- reads the `Authorization` header, strips the `Bearer ` scheme, and
- timing-safe-compares the token to `env.CRON_SECRET`.

It returns **`401` if the secret is missing or wrong** — there is **no "unset =
allow" path**. So:

> **`CRON_SECRET` MUST be set on the web (`cycle-circle`) project, or every cron run
> returns 401 and no work happens.**

Use any non-empty random string (`openssl rand -hex 16`). It must match the
`CRON_SECRET` you set on the admin project too (admin's System page triggers these
endpoints).

## Enable / verify in the Vercel dashboard

1. Set `CRON_SECRET` (and the rest of the env) on the web project → **Production**.
2. Deploy the web project from the branch. Crons register from `vercel.json` on
   deploy and run **only for the Production deployment**.
3. Project → **Settings → Crons**: confirm both jobs are listed with their schedules.
4. After a run, check Project → **Logs** (filter to the cron path) for the invocation
   and its JSON response.

## Manual trigger (testing)

```bash
# GET, exactly like Vercel Cron:
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://test-vesta.velirasolutions.com/api/cron/daily-reminders
# → 200 JSON. 401 = secret mismatch. 405 = GET handler missing (shouldn't happen).

curl -H "Authorization: Bearer $CRON_SECRET" \
  https://test-vesta.velirasolutions.com/api/cron/caas-check
```

Locally there are also `just cron-reminders` / `just cron-caas` recipes that POST to
`http://localhost:3000` with the local `CRON_SECRET`.

## DB-backed on/off toggle

Independently of Vercel, each route checks `isCronEnabled(slug)`
(`packages/shared/src/server/services/cron-settings-service.ts`, backed by the
`CronSetting` table) **after** auth passes:

- A **disabled** cron returns `200 { skipped: true, reason: 'cron disabled' }` and
  does no work (auth is still required first — a disabled cron with a bad secret still
  401s).
- A **missing row defaults to enabled**, so a fresh staging DB runs both crons by
  default.
- Toggle from the admin **/system** page (slugs `daily-reminders`, `caas-check`).
- Force a run past the toggle: `POST` the route with body `{ "overrideDisabled": true }`.

## Hobby (free) plan — limits & fallback

The web project is on Hobby. What that means here:

- **Cron count & frequency:** Hobby allows **up to 2 cron jobs**, each at **daily
  frequency only**. Our 2 jobs are both once-daily → they fit. Hobby crons fire
  **within** the scheduled hour (not the exact minute) and only while the project is
  deployed — fine for staging.
- **Function duration (`maxDuration = 60`):** current Vercel Hobby supports up to 60s;
  if the full 60s isn't honored, enable **Fluid Compute** (Settings → Functions). If a
  deploy ever errors on the duration value, lower `maxDuration` to `10` in both route
  files (`apps/web/src/app/api/cron/daily-reminders/route.ts` and
  `caas-check/route.ts`). Staging's small dataset finishes well under 10s regardless.
- **External-scheduler fallback** (if Vercel Hobby cron timing/limits aren't enough):
  trigger the endpoints from an external scheduler instead of (or alongside) Vercel
  Cron — e.g. **cron-job.org**, a **GitHub Actions** `schedule:` workflow, or
  **Upstash QStash** — doing a `GET` with the `Authorization: Bearer <CRON_SECRET>`
  header. This gives exact timing and bypasses Vercel's cron-count limits. Note the
  function `maxDuration` cap still applies regardless of what triggers the request.
- **Plan note:** Hobby is for non-commercial use. Move to **Pro** before a real
  production launch — it lifts the duration cap and the cron count/frequency limits.

## Quick troubleshooting

| Symptom | Likely cause |
|---|---|
| Cron returns `401` | `CRON_SECRET` not set on the project, or differs from what's sent. |
| Cron returns `405` | GET handler missing — both routes must `export const GET` (they do). |
| `200 { skipped: true }` | The job is disabled in `CronSetting` — re-enable on admin /system. |
| Job not listed in Settings → Crons | Not deployed to Production, or `vercel.json` `crons` missing. |
| Job times out | Work exceeded the function `maxDuration`; raise it (Pro/Fluid) or reduce work. |
