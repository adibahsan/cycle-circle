# E2E suite (`@vesta/e2e`)

Real user flows against **production builds** of web and admin (`DEV_MODE=false`), a
**stateful fake BDApps**, **Mailpit** and a separate **`vesta_e2e`** database that is reset
from migrations + seed at the start of every run. Spec: issue #114. Coverage map:
[`COVERAGE.md`](./COVERAGE.md) (update it in every E2E PR).

The old look-only suite in `apps/web/e2e/` (dev server, dev-login) is separate and unchanged:
`pnpm --filter @vesta/web e2e`.

## Run

Needs the local Compose stack (`pnpm docker:dev`): Postgres on :5431 and Mailpit on :1025/:8025.
If Mailpit is not reachable, `pnpm e2e` starts it (`docker compose -f ops/docker/compose.yml up -d mailpit`) and
waits up to 30 s. It does not do this in CI (a service container provides it) or when `E2E_MAILPIT_URL` is set.
Redis is not used (see Slots).

```bash
pnpm e2e                                              # build both apps, reset DB, run every project
pnpm e2e -- --project=web-desktop                     # Playwright args go after --
pnpm e2e -- --project=web-phone tests/web/phone-signup.spec.ts
E2E_SKIP_BUILD=1 pnpm e2e -- --project=web-desktop    # reuse the last build (app code unchanged)
E2E_SLOT=2 pnpm e2e                                   # another worktree at the same time
```

| Env | Effect |
|---|---|
| `E2E_SLOT=<0-99>` | Offsets ports and the DB name (default 0). |
| `E2E_SKIP_BUILD=1` | Skip `next build` (fails if there is no build yet). Rebuild after any app change. |
| `E2E_SKIP_RESET=1` | Don't wipe the DB: apply pending migrations (`migrate deploy`), and seed only a DB that is new. Faster reruns; throwaway phones stay unique. Opt-in for speed only: the default reset (drop + create the slot DB, `migrate deploy`, seed) works for AI agents too. |
| `E2E_REUSE_SERVERS=1` | Reuse already-running fake BDApps / web / admin on the slot's ports. |
| `E2E_SERVER_LOGS=1` | Pipe the servers' stdout into the test output. |
| `E2E_DATABASE_URL` | Postgres server to use (db name is replaced); default from `packages/shared/.env.local`, then Compose `localhost:5431`. **Required in CI** (no `.env.local`). |
| `E2E_MAILPIT_URL`, `E2E_MAILPIT_SMTP_URL` | Mailpit API / SMTP (default `http://localhost:8025`, `smtp://localhost:1025`). |
| `E2E_SUITE=desktop\|full\|all` | Which Playwright projects to run (see CI). Default `all`. |
| `CI_PROJECTS` | Override: comma-separated project names, or the aliases `desktop` / `full` / `all` (same as `E2E_SUITE`). |
| `E2E_APP_TZ` | Timezone of the web/admin processes (build and start). Default **`UTC`**, see below. `E2E_APP_TZ=Asia/Dhaka` reproduces a Dhaka-time server. |

**The apps run with `TZ=UTC`** (`support/slot.ts`), like prod (Docker, no `TZ`: `docs/ops/02-server-setup.md`)
and the CI runners. Before this the apps inherited the host TZ, and on an Asia/Dhaka dev Mac that hid every bug
that counts "today" or a stored day with the process clock (the first CI run failed 40 tests). Browsers stay
`Asia/Dhaka`; the test runner may stay in host TZ, since the `days` helper reads the server's clock.
Tests must be green under UTC; runs with `E2E_APP_TZ=Asia/Dhaka` are for comparison only (see Deliberate deviations).

`pnpm e2e` = `scripts/run.ts`: build web + admin (sequentially, with the E2E env) → reset of the slot DB (`support/reset-db.ts`: connect to the server's `postgres` DB, `DROP DATABASE IF EXISTS … WITH (FORCE)` + `CREATE DATABASE`, then `migrate deploy` and seed; or the `E2E_SKIP_RESET` path) → check Mailpit →
`playwright test`, whose `webServer` starts the fake BDApps and `next start` for both apps.
Running `pnpm exec playwright test` inside `e2e/` directly also works if the build and DB are ready.

App logs (all six log channels) go to `e2e/.logs/slot-<n>/web/` (shared with admin, mirroring the prod bind mount so the `/logs` reader works); failures keep a trace in
`e2e/.results/` (`pnpm exec playwright show-trace <zip>`).

## Slots

`E2E_SLOT=n` (0-99): web `:4100+n`, admin `:4200+n`, fake BDApps `:4300+n`, database `vesta_e2e`
(n=0) or `vesta_e2e_<n>`. Each slot has its own fake BDApps, DB, auth states (`.auth/slot-<n>/`),
logs and uploads. **Mailpit is shared** by all slots: always email a unique address per test and
look mail up by that address, never "the latest email". **Redis is off** (`REDIS_URL=''`): the
app has no key prefix, so rate limits and the JWT blacklist stay in each app process instead,
which keeps slots apart.

All slot-derived values (ports, URLs, DB URL, every env var the apps get, test secrets) live in
`support/slot.ts`. Import from there; never hardcode a port.

## Layout

```
e2e/
  playwright.config.ts   projects: web-*/admin-*/cross-app-* × desktop/phone; web-bengali (#133); then serial `cron`
  global-setup.ts        checks Mailpit; logs in personas + admin once, saves storage states
  scripts/run.ts         the `pnpm e2e` runner
  fake-bdapps/           the fake BDApps server (see below)
  support/               helpers (below)
  tests/web/             project web-* + serial `cron` (baseURL = web)
  tests/admin/           project admin-*     (baseURL = admin)
  tests/cross-app/       project cross-app-* (baseURL = web; open admin with URLS.admin)
  tests/bengali/         project web-bengali (full suite only; filled by #133)
  fixtures/              small binary fixtures (e.g. `article-red-1x1.png` for CMS image upload)
  COVERAGE.md            feature → spec → depth
```

Name specs after the feature (`tests/web/period-logging.spec.ts`). Every spec runs at desktop and
phone width; use `test.skip(testInfo.project.name.endsWith('-phone'), 'why')` only with a reason.

## CI (GitHub Actions)

Workflow: [`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml).

| Trigger | Suite (`E2E_SUITE`) | What runs |
|---|---|---|
| `pull_request` → `main` | `desktop` | All projects that are **not** `*-phone` and not full-only (`web-bengali`). New `*-desktop` or serial projects (e.g. cron in #132) are picked up automatically — **do not** list `--project` in the workflow. |
| Nightly schedule, `workflow_dispatch`, or PR labelled `e2e-full` | `full` | Every project, including `*-phone` and `web-bengali`. |

The job starts **Postgres**, **Redis** and **Mailpit** as service containers, sets `E2E_DATABASE_URL` /
Mailpit URLs (no `packages/shared/.env.local`), runs `pnpm install`, `pnpm db:generate`, caches
Playwright browsers + Next.js `.next/cache`, installs Chromium, then `pnpm e2e` with a full
reset of `vesta_e2e` only (`assertE2eDatabase` guards the drop). Worker count is **4 in CI** from
`playwright.config.ts` (`workers: ci ? 4`) — do not also pass `--workers` in the workflow.
Redis is present to match Compose; the suite still sets `REDIS_URL=''` so rate limits stay
in-process. On non-cancelled runs it uploads the HTML report (`e2e/playwright-report/`), traces
(`e2e/.results/`; `trace: 'retain-on-failure'`), and server logs (`e2e/.logs/` via
`E2E_SERVER_LOGS=1`). **Never** upload `e2e/.auth/` (session cookies).

**Runtime target:** desktop PR job `timeout-minutes: 15` (acceptance: under 10 minutes once the
suite is green — confirm on the first CI run). Full suite keeps `timeout-minutes: 45`.

**Serial projects** (e.g. cron in #132): set `workers: 1` and `fullyParallel: false` on that
project in `playwright.config.ts`. Global CI workers stay at 4 for parallel projects; only the
serial project overrides.

**Bengali pass (#133):** project `web-bengali` runs `tests/bengali/no-english.spec.ts` (BN cookie +
latin-scan allow-list in `support/latin-scan.ts`). Included only when `E2E_SUITE=full`. Leftover
English → `needs-triage` issue + `test.fail()` per page/area. Admin has no Bengali UI.

**Coverage gate:** `pnpm --dir e2e coverage:check` recomputes `COVERAGE.md` tallies and fails on any
`none` / `look-only` row.

Cross-app admin→web content (#128): `tests/cross-app/admin-content.spec.ts` uses `createLoggedInAdmin`
plus a throwaway `newUser()`; article titles are prefixed `E2E128` so they never collide with #124.
Sanitizer coverage pastes rich HTML into Tiptap and also rewrites the `createArticle` Next-Action
POST body (raw HTML bypassing the editor) so stored HTML and the web reader can be checked separately.
Tiptap editors lack accessible names — CSS `.ProseMirror` with a comment pointing at #141.

### Serial `cron` project (CI / full suite)

Some web specs mutate **shared** slot state and must not run beside plan, user-admin, or
broadcast tests:

| Spec | Why serial |
|---|---|
| `cron-daily-reminders.spec.ts` | Even with `userId`, keep broadcast/reminder side-effects out of the parallel wave |
| `cron-nightly-maintenance.spec.ts` | Purges every soft-deleted user past 30 days |
| `cron-caas-check.spec.ts` | `getStatus` over every BDApps PRO subscriber (can flip plans) |
| `webhooks-bdapps.spec.ts` | Shared fake + webhook recording; kept with the cron wave |
| `health.spec.ts` / `bdapps-health.spec.ts` | `bdapps-health` scripts `/health` with `{ any: true }` |

They live in Playwright project **`cron`**: desktop viewport only, `workers: 1`,
`fullyParallel: false`, and `dependencies` on every `web-*` / `admin-*` / `cross-app-*`
project so a bare `pnpm e2e` still runs everything and the serial group finishes **last**.
`--project=web-desktop` (etc.) still works: those projects `testIgnore` the serial files.

**Add a spec to the serial group:** append its basename to `CRON_SERIAL_SPECS` in
`playwright.config.ts` (same regex used for `cron` `testMatch` and web `testIgnore`). Keep
the file under `tests/web/`. Viewport-independent cron/health specs do not need a phone
project twin.

**Run only the serial group** (still waits on dependencies unless you pass `--no-deps`):

```bash
E2E_SLOT=13 E2E_SKIP_RESET=1 E2E_SKIP_BUILD=1 pnpm e2e -- --project=cron --workers=2
```

## Helpers

Import `test` and `expect` from `support/fixtures.ts` (not `@playwright/test`).

| Helper | What | Example |
|---|---|---|
| `newUser` fixture | Throwaway user: unique `0136…` phone, logged in through the real BDApps OTP flow (so Pro, no profile yet), own context + page with the project's viewport, Asia/Dhaka. Closed after the test. | `const { page, phone } = await newUser()` |
| `unusedPhone()` / `newPhone()` / `toDbPhone(phone)` (`support/users.ts`) | A fresh phone in the E2E range `0136XXXXXXX`, for flows that sign up through the UI themselves. Use `await unusedPhone()`: it also skips numbers already in the slot DB (with `E2E_SKIP_RESET` an earlier run's user, possibly soft-deleted, can hold the same number). `toDbPhone` maps typed `01…` to the DB form `+8801…`. | `const phone = await unusedPhone()` |
| `loginWithOtp(request, phone, fake?)` | Real OTP login over HTTP (request → code from fake → verify); cookies land in `request`. New number → BDApps OTP; existing subscriber → App OTP (read from the SMS the fake received). | `await loginWithOtp(context.request, phone)` |
| `createThrowawayUser(browser, opts?)` | `newUser` without the fixture (e.g. in `beforeAll`); you close `context`. | `const { context } = await createThrowawayUser(browser)` |
| `ipFor(key)` | Stable fake `x-real-ip` for a key. Each test already gets its own (OTP sends are capped at 10/hour/IP). Set it yourself only to test the IP limit. | `extraHTTPHeaders: { 'x-real-ip': ipFor('x') }` |
| Personas (`support/personas.ts`) | Seeded read-only **web** users, logged in once by global setup: `streaker`, `allGood`, `stale`, `power`, `newUser`, `proMulti` (all Pro); `admin` = seeded super admin storage state. **Never save data as a persona.** Do not treat web personas as admins. | `test.use({ storageState: statePath('power') })` |
| Admin helpers (`support/admin.ts`) | Create throwaway admins in the E2E DB and log in with email/password. Prefer these for admin mutating flows (#127–#131); never promote a seeded web persona. | see below |
| `e2eDb()` / `closeE2eDb()` / `setUserSubscription` (`support/db.ts`) | Prisma against this slot's `vesta_e2e*` (setup only). `closeE2eDb` runs automatically via a worker-scoped fixture teardown. | `await setUserSubscription({ userId, status: 'FREE' })` |
| `days` fixture (`support/bangladesh-day.ts`) | Bangladesh days from the **server's** clock (HTTP `Date`): `today`, `daysAgo(n)`, `daysFromNow(n)` (`YYYY-MM-DD`), `now`. `dateOf(day)` = the `Date` to write to a **date-only column** (period start/end, symptom date, `lastPeriodStart`, prediction days): UTC midnight of that day, which is what the app stores (`new Date('YYYY-MM-DD')` in the services, the seed). `startOf(day)` = the *instant* the Bangladesh day begins, for timestamps (`deletedAt`, `emailTrialExpiresAt`). `serverDayLags` = the app server's own day (its `TZ`) is not the Bangladesh day (UTC: 18:00-24:00). No fake clock. | `startDate: days.dateOf(days.daysAgo(35))` |
| `openDialog(trigger, dialog?)` (`support/dialogs.ts`) | Click until the pop-up (default: first `dialog`) is visible; never clicks while it is open. A tap before hydration can be lost (#161). | `const modal = await openDialog(page.getByRole('button', { name: 'Log Period' }))` |
| `fillSearch(input, value, settled)` (`support/search.ts`) | Fill a debounced search box, clearing and re-typing until `settled(timeoutMs)` passes (the filter URL). For slow runners where the first fill beats hydration. | `await fillSearch(box, marker, (t) => expectUsersFilterUrl(page, { search: marker }, t))` |
| `fakeBdapps` fixture (`support/fake-bdapps.ts`) | Control client for the fake BDApps. | see below |
| `db` fixture / `db` / `getDb()` (`support/db.ts`) | Direct Prisma client for the slot database (`assertE2eDatabase` checked) and helpers for preconditions the UI cannot reach in time (draft articles, historical logs for export: `createArticle()`, `createProfileWithLogs()`, `setUserSubscription()`). | `const db = getDb()` |
| `setupProfile(page, opts?)` (`support/profiles.ts`) | Creates a profile via `POST /api/profiles` and marks `onboardingTourCompletedAt` in DB so the first-run tour modal doesn't intercept clicks. | `const profile = await setupProfile(page)` |
| `suppressAutoPrompts(page)` (`support/prompts.ts`) | Stubs `localStorage.getItem('vesta_prompt_last:...')` to suppress auto-prompt modals on dashboard during tests that need a clean page. | `await suppressAutoPrompts(page)` |
| `assertMailpit()` (`support/mailpit.ts`) | Mailpit reachability. | `await assertMailpit()` |
| `waitForEmail(to, { since?, timeoutMs? })` / `latestEmailFor` (`support/mailpit.ts`) | Wait for newest email to `to` since `since`; returns subject, text, HTML, links. | `const { links } = await waitForEmail(email, { since })` |
| `waitForMagicLinkEmail(email, { since })` (`support/mailpit.ts`) | Wait for a magic-link email already sent (e.g. by UI); returns callback URL. | `const { callbackUrl } = await waitForMagicLinkEmail(email, { since })` |
| `requestMagicLinkAndWait(email, { language?, baseUrl?, since?, timeoutMs? })` (`support/mailpit.ts`) | POST `/api/auth/magic-link/request` then wait for email; returns callback URL. | `const { callbackUrl } = await requestMagicLinkAndWait(email)` |
| `createEmailTrialUser(browser, opts?)` (`support/users.ts`) | Throwaway email-trial user via the real magic-link flow, unique address (limit 3 requests/hour/email: never log seeded users in this way). `{ withProfile: true }` seeds user + profile first so it lands on the dashboard. Also `newEmail()` and `preseedEmailTrialUser(email)`. Returns `{ email, context }`. | `const { context, email } = await createEmailTrialUser(browser)` |
| `URLS`, `PORTS`, `SECRETS`, `DATABASE_URL` (`support/slot.ts`) | Slot-aware URLs (`URLS.web/admin/fakeBdapps/mailpit`), the cron secret, admin credentials, DB URL. | `` request.get(`${URLS.web}/api/cron/x`, { headers: { authorization: `Bearer ${SECRETS.cronSecret}` } }) `` |

Admin helpers (`support/admin.ts`) — typed for tickets #127–#131:

| Helper | What | Example |
|---|---|---|
| `createAdminUser(opts?)` | Inserts `role=ADMIN` + bcrypt password into the E2E DB; returns `{ id, email, password }`. | `const admin = await createAdminUser()` |
| `createNonAdminEmailUser(opts?)` | Email user with `role=USER` (for forbidden-page setups). | `const user = await createNonAdminEmailUser()` |
| `loginAsAdmin(request, { email, password })` | POST `/api/auth/login`; cookies land on `request`. | `await loginAsAdmin(context.request, admin)` |
| `loginAsAdminViaUi(page, creds)` | Fills Email/Password and clicks Sign in. | `await loginAsAdminViaUi(page, admin)` |
| `createLoggedInAdmin(browser, contextOpts?)` | `createAdminUser` + HTTP login + page; you close `context`. | `const { page, context } = await createLoggedInAdmin(browser)` |
| `signAdminAudienceToken` / `setAdminCookie` | Mint an admin-audience JWT (incl. `role: 'USER'`) and attach `vesta_admin_token`. | forbidden-page tests |

`fakeBdapps` methods:

| Method | Example |
|---|---|
| `latestOtp(phone, { since?, timeoutMs? })` → `{ kind: 'bdapps'\|'app', code, referenceNo?, at }` | `const { code } = await fakeBdapps.latestOtp(phone)` |
| `calls({ path?, sinceSeq? })` → merchant calls `{ seq, path, body, httpStatus, response }` | `await fakeBdapps.calls({ path: '/subscription/send' })` |
| `subscriber(phone)` → `{ phone, maskedId, status }` or `undefined` | `expect(await fakeBdapps.subscriber(phone)).toMatchObject({ status: 'UNREGISTERED' })` |
| `caasBalance(phone)` → `{ phone, accountType, accountStatus, chargeableBalance, updatedAt }` or `undefined` | `expect(await fakeBdapps.caasBalance(phone)).toMatchObject({ accountStatus: 'ACTIVE' })` |
| `caasDebits(phone?)` → list of `{ phone, externalTrxId, internalTrxId, referenceId, amount, timeStamp }` | `await fakeBdapps.caasDebits(phone)` |
| `failNext(path, { match, mode, statusCode?, httpStatus?, delayMs?, times? })` | `await fakeBdapps.failNext('/subscription/send', { match: { subscriberId: maskedId }, mode: 'error', statusCode: 'E1601' })` |
| `sendWebhook(appPath, body)` → the app's `{ status, body }` | `await fakeBdapps.sendWebhook('/api/webhooks/subscription/notify', {...})` |

DB setup for states the UI can't reach in time lives in `support/db.ts`: one shared
`PrismaClient` via `e2eDb()` / `getE2eDb()` / `getDb()` / the `db` export (and the `db` test fixture),
plus `setUserSubscription`, `createArticle()`, `createProfileWithLogs()` and `closeE2eDb`. Built as
`new PrismaClient({ datasourceUrl: TEST_DATABASE_URL })` from `@prisma/client` after
`assertE2eDatabase()` (`TEST_DATABASE_URL` is the slot DB with a small `connection_limit`);
don't import `@vesta/shared`'s `prisma`, which reads `DATABASE_URL` from the env and would hit
`vesta_dev`. The shared client is disconnected in worker teardown (`closeE2eDb` via
`support/fixtures.ts`). Write dates with the `days` helper (`days.startOf(...)`).
Only set up state this way; check results through the UI or HTTP. Admin users for the suite are
created with `createAdminUser` in that same DB — not by reusing seeded web personas.
`createLoggedInAdmin` closes the browser context if HTTP login fails so contexts do not leak.
- `ensureUserProfile(phone, options)`: updates or creates a profile and dismisses onboarding tour.
- `setPeriodLogs(profileId, logs)`: replaces period logs for a profile.
- `setSymptomLogs(profileId, logs)`: adds symptom logs in a transaction.
- `setPrediction(profileId, prediction)`: sets or updates predictions (tier, confidence, windows).

## Fake BDApps (`fake-bdapps/`)

Started by Playwright per slot (`pnpm e2e:fake-bdapps` runs one by hand on :4300). In-memory,
fresh every run.

- `merchant-routes.ts`: route table `path → (body, state) => BDApps JSON`. Implemented:
  `/subscription/otp/request`, `/subscription/otp/verify`, `/subscription/getStatus`,
  `/subscription/send`, `/sms/send`, `/caas/get/balance`, `/caas/direct/debit`.
  Anything else answers 404 (and is still recorded).
  **Add an endpoint = add an entry.**
- `state.ts`: subscribers (by phone), issued OTPs, sent SMS, recorded calls, failure queue,
  CaaS balances and debits.
- `server.ts`: credential check (`E1313`), call recording, failure queue, `/_control/*` API.

Behaviour mirrors live BDApps for our number-masking app:
- `otp/request` for a number that is already a Subscriber → `E1351` (the app then sends an App OTP by SMS).
- `otp/verify` subscribes the number under a **new masked subscriber id** (`tel:<opaque>`).
- `getStatus`, `send`, `sms/send`, `caas/get/balance`, `caas/direct/debit` accept only the current masked id; raw numbers → `E1951`.
- A 6-digit code in an SMS to a subscriber is kept as that phone's latest (`app`) OTP.

Control API (the client wraps it): `GET /_control/health`, `POST /_control/reset`,
`GET /_control/otp?phone=`, `GET /_control/calls?path=&sinceSeq=`, `GET /_control/subscribers/:phone`,
`GET /_control/caas/balance?phone=`, `GET /_control/caas/debits?phone=`,
`POST /_control/failures {path, mode, ...}`, `POST /_control/webhook {path, body}`.

**Scripted failures** (`failNext(path, { match, mode, ... , times })`): the next `times` (default 1) calls to
`path` that satisfy `match` fail, then calls succeed again. Modes: `error` (HTTP 200 with a BDApps
`statusCode`, default `E1601`), `http` (answer `httpStatus`, default 503), `timeout` (never answer; the
socket is dropped after `delayMs`, default 30s). The failed call is still recorded. The control API
answers 400 for a missing/empty `match` or a bad mode field.

`match` is **required** and scopes the failure to a call, so parallel tests (and the desktop and phone
projects) can script the same path without stealing each other's failure: `{ subscriberId }` (masked id
or phone, matched against `body.subscriberId`), `{ destinationAddress }` (against `body.destinationAddress`
or any `body.destinationAddresses`), `{ phone }` (either, after normalisation), `{ messageContains }`
(substring of `body.message` — use this when many tests share `destinationAddresses: ['tel:all']`);
all given fields must match.
`{ any: true }` matches every call to the path and is **exclusive**: only for a path nobody else uses,
i.e. GET `/health`, which carries no subscriber. Those tests run on the desktop project only
(`bdapps-health.spec.ts`). Typed webhook bodies: `SubscriptionNotifyPayload`, `SmsReceivePayload`,
`SmsReportPayload`, `UssdReceivePayload` in `support/fake-bdapps.ts`.
`messageContains` is covered by a small unit file (`pnpm exec tsx --test fake-bdapps/state.unit.test.ts`)
and by `bdapps-fake.spec.ts` (two `tel:all` sends; only the matching message fails).

**Health**: the fake answers `GET /health` (200, `{status:'ok'}`). The apps' env sets
`BDAPPS_SIMULATOR_UI_URL` to it, which is the only URL `/api/health/bdapps` fetches (up for any
status below 500; down for 5xx, a network error or a 4s timeout). It is not a merchant call.

**Webhooks** (`sendWebhook(appPath, body)` posts as BDApps would; the app answers `S1000`):
`/api/webhooks/subscription/notify` `{applicationId, subscriberId (masked id), status: REGISTERED|UNREGISTERED, timeStamp}`,
`/api/webhooks/sms/receive` `{sourceAddress, message, messageId, timeStamp}`,
`/api/webhooks/sms/report` `{destinationAddress, requestId, deliveryStatus, timeStamp}`,
`/api/webhooks/ussd/receive` `{subscriberId, ussdContent, sessionId, status}`.
Only subscription-notify changes a user; the other three are stored. Idempotency keys must be
unique per event.

**Translog** has no screen: `translogFor(userId)` from `support/translog.ts` reads today's
translog lines for that user (`plan.change` with `cause`). Defaults to the **web** app's
`LOG_DIR` (OTP signup, webhooks). Admin grant/revoke/suspend lines are under the **admin**
app: `translogFor(userId, { app: 'admin' })`, or merge both with `{ apps: ['web', 'admin'] }`.

## Conventions

- **Find elements by role and accessible name, in English** (`getByRole('button', { name: 'Send OTP' })`,
  `getByLabel('Phone Number')`). `data-testid` only where an element has no accessible name, and
  then open an issue for the missing name.
- **Anything that saves uses its own `newUser()`**; personas are read-only. Tests run fully parallel.
- **Check what a user or BDApps would see**: the page after a reload, a call recorded by the fake,
  an email in Mailpit. Query the DB only for results with no screen (translog, webhook events, audit).
- **Dates are Bangladesh days from the server clock** (`days` fixture); every context runs in `Asia/Dhaka`.
  Write date-only columns with `days.dateOf`, never `startOf` (a Bangladesh-midnight instant is the previous
  UTC day, so a UTC server reads it as yesterday: that was the false bug #151).
- **A bug that only shows in some hours** (it reads "today" from the process clock): guard the `test.fail()` with
  the server clock so it is deterministic, e.g. `test.fail(days.serverDayLags, '…/issues/160')`. Never `test.fail(true)`
  for an hour-dependent bug.
- `createArticle()` busts web's cached Learn list (`POST /api/internal/revalidate`, as admin does on publish);
  a DB-only article write is otherwise invisible to web for up to 5 minutes.
- **A bug found by a test**: don't change app code. Open an issue, then mark the test expected-to-fail
  with the link, so it turns red (unexpected pass) once fixed:
  ```ts
  test('default log date is the Bangladesh day', async ({ page }) => {
    test.fail(true, 'https://github.com/adibahsan/cycle-circle/issues/NNN')
    ...
  })
  ```
- `tests/web/personas.spec.ts` opens each seeded persona's main pages from its saved state and asserts its
  own content; it never writes, so no check of the personas' rows is needed.
- Don't reset the fake BDApps or the DB from a test; other tests share them.
- Global setup reuses a persona's saved session while the app still accepts it (a second OTP
  within 60 s would hit the resend cooldown). Tests must not log personas out.
- `tests/web/harness.spec.ts` is the contract for the helpers; keep it green when changing them.
- `pnpm --filter @vesta/e2e typecheck` and `lint` must pass (root `pnpm typecheck && pnpm lint` covers it); `pnpm --filter @vesta/e2e test:unit` runs the lint-rule and reset-guard unit tests. Lint enforces the mechanical rules (no `waitForTimeout`, no raw locators without a reasoned disable, `test.fail`/`test.fixme` link an issue URL).
- Reviewing an E2E diff? Apply [`REVIEW.md`](./REVIEW.md) (the judgement checklist the linter can't cover).
- `next build` rewrites `apps/*/next-env.d.ts`; don't commit that change (`git checkout apps/*/next-env.d.ts`).

## Deliberate deviations

- `apps/web/e2e/tests/symptoms-save.spec.ts` is left as is: that suite writes to `vesta_dev`, not `vesta_e2e`, so it is not part of this harness.
- Pro gating for export and predictions is not covered: it is deferred by FR-GATE.
- The #155 `test.fail` in `symptom-logging.spec.ts` and `dashboard.spec.ts` (streak) applies only between 00:00 and 06:00 Bangladesh (UTC 18:00-24:00), by design: the code uses the UTC day whatever the server TZ.
- The #160 (server "today": cycle day, countdown, late days, reminders) and #161 (hydration mismatch) `test.fail`s use
  `days.serverDayLags`: expected to fail only 00:00-06:00 Bangladesh under `TZ=UTC`, never under `E2E_APP_TZ=Asia/Dhaka`.
- **Green means green under `TZ=UTC`.** With `E2E_APP_TZ=Asia/Dhaka` the #160/#161 guards switch off with those bugs,
  so a Dhaka run is green too; but a Dhaka server hides the UTC-only bugs, so don't use it
  to sign off a change.
- Timeouts: the global test timeout is 90 s in CI (60 s locally) and the SMS broadcast tests set 150 s: a GitHub runner
  is about 3x slower than a dev Mac (first CI run 14.6 min vs 5.3 min locally).
- `dashboard-popups.spec.ts` celebration toast is `test.fixme` (#157): the bug is a timing race that no server-clock
  condition predicts, so an expected-fail would pass at random.
- Agents may run the full reset: it does not use `prisma migrate reset` (which Prisma blocks for AI agents). `E2E_SKIP_RESET=1` is only a speed opt-in; leftover data from earlier runs can cause flakes. CI always resets.
- `page.clock` in the #115 test fakes the browser clock only; a server clock is out of scope.
