# E2E suite (`@vesta/e2e`)

Real user flows against **production builds** of web and admin (`DEV_MODE=false`), a
**stateful fake BDApps**, **Mailpit** and a separate **`vesta_e2e`** database that is reset
from migrations + seed at the start of every run. Spec: issue #114. Coverage map:
[`COVERAGE.md`](./COVERAGE.md) (update it in every E2E PR).

The old look-only suite in `apps/web/e2e/` (dev server, dev-login) is separate and unchanged:
`pnpm --filter @vesta/web e2e`.

## Run

Needs the local Compose stack (`pnpm docker:dev`): Postgres on :5431 and Mailpit on :1025/:8025.
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
| `E2E_SKIP_RESET=1` | Don't wipe the DB: apply pending migrations (`migrate deploy`), and seed only a DB that is new. Faster reruns; throwaway phones stay unique. **AI agents must use this**: Prisma refuses `migrate reset` when it detects an AI agent. |
| `E2E_REUSE_SERVERS=1` | Reuse already-running fake BDApps / web / admin on the slot's ports. |
| `E2E_SERVER_LOGS=1` | Pipe the servers' stdout into the test output. |
| `E2E_DATABASE_URL` | Postgres server to use (db name is replaced); default from `packages/shared/.env.local`. |
| `E2E_MAILPIT_URL`, `E2E_MAILPIT_SMTP_URL` | Mailpit API / SMTP (default `http://localhost:8025`, `smtp://localhost:1025`). |

`pnpm e2e` = `scripts/run.ts`: build web + admin (sequentially, with the E2E env) → `prisma migrate
reset --force` on the slot DB (creates it, applies migrations, seeds; or the `E2E_SKIP_RESET` path) → check Mailpit →
`playwright test`, whose `webServer` starts the fake BDApps and `next start` for both apps.
Running `pnpm exec playwright test` inside `e2e/` directly also works if the build and DB are ready.

App logs (all six log channels) go to `e2e/.logs/slot-<n>/{web,admin}/`; failures keep a trace in
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
  playwright.config.ts   projects: web-*, admin-*, cross-app-* × desktop (1366×900) / phone (Pixel 7)
  global-setup.ts        checks Mailpit; logs in personas + admin once, saves storage states
  scripts/run.ts         the `pnpm e2e` runner
  fake-bdapps/           the fake BDApps server (see below)
  support/               helpers (below)
  tests/web/             project web-*       (baseURL = web)
  tests/admin/           project admin-*     (baseURL = admin)
  tests/cross-app/       project cross-app-* (baseURL = web; open admin with URLS.admin)
  COVERAGE.md            feature → spec → depth
```

Name specs after the feature (`tests/web/period-logging.spec.ts`). Every spec runs at desktop and
phone width; use `test.skip(testInfo.project.name.endsWith('-phone'), 'why')` only with a reason.

## Helpers

Import `test` and `expect` from `support/fixtures.ts` (not `@playwright/test`).

| Helper | What | Example |
|---|---|---|
| `newUser` fixture | Throwaway user: unique `0136…` phone, logged in through the real BDApps OTP flow (so Pro, no profile yet), own context + page with the project's viewport, Asia/Dhaka. Closed after the test. | `const { page, phone } = await newUser()` |
| `newPhone()` / `toDbPhone(phone)` (`support/users.ts`) | A fresh phone in the E2E range `0136XXXXXXX`, for flows that sign up through the UI themselves. `toDbPhone` maps typed `01…` to the DB form `+8801…`. | `const phone = newPhone()` |
| `loginWithOtp(request, phone, fake?)` | Real OTP login over HTTP (request → code from fake → verify); cookies land in `request`. New number → BDApps OTP; existing subscriber → App OTP (read from the SMS the fake received). | `await loginWithOtp(context.request, phone)` |
| `createThrowawayUser(browser, opts?)` | `newUser` without the fixture (e.g. in `beforeAll`); you close `context`. | `const { context } = await createThrowawayUser(browser)` |
| `ipFor(key)` | Stable fake `x-real-ip` for a key. Each test already gets its own (OTP sends are capped at 10/hour/IP). Set it yourself only to test the IP limit. | `extraHTTPHeaders: { 'x-real-ip': ipFor('x') }` |
| Personas (`support/personas.ts`) | Seeded read-only **web** users, logged in once by global setup: `streaker`, `allGood`, `stale`, `power`, `newUser`, `proMulti` (all Pro); `admin` = seeded super admin storage state. **Never save data as a persona.** Do not treat web personas as admins. | `test.use({ storageState: statePath('power') })` |
| Admin helpers (`support/admin.ts`) | Create throwaway admins in the E2E DB and log in with email/password. Prefer these for admin mutating flows (#127–#131); never promote a seeded web persona. | see below |
| `e2eDb()` / `closeE2eDb()` / `setUserSubscription` (`support/db.ts`) | Prisma against this slot's `vesta_e2e*` (setup only). `closeE2eDb` runs automatically via a worker-scoped fixture teardown. | `await setUserSubscription({ userId, status: 'FREE' })` |
| `days` fixture (`support/bangladesh-day.ts`) | Bangladesh days from the **server's** clock (HTTP `Date`): `today`, `daysAgo(n)`, `daysFromNow(n)` (`YYYY-MM-DD`), `startOf(day)` (the `Date` to write to the DB), `now`. No fake clock. | `const start = days.startOf(days.daysAgo(35))` |
| `fakeBdapps` fixture (`support/fake-bdapps.ts`) | Control client for the fake BDApps. | see below |
| `db` fixture (`support/db.ts`) | Direct Prisma client for the slot database (`assertE2eDatabase` checked). Use only for test setup state the UI cannot reach in time (e.g. aging an OTP challenge). | `const count = await db.user.count()` |
| `assertMailpit()` (`support/mailpit.ts`) | Mailpit reachability. | `await assertMailpit()` |
| `waitForEmail(to, { since?, timeoutMs? })` (`support/mailpit.ts`) | Wait for newest email to `to` since `since`; returns subject, text, HTML, links. | `const { links } = await waitForEmail(email, { since })` |
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
`PrismaClient` via `e2eDb()` / `getE2eDb()` / the `db` export (and the `db` test fixture),
plus `setUserSubscription` and `closeE2eDb`. Built as
`new PrismaClient({ datasourceUrl: TEST_DATABASE_URL })` from `@prisma/client` after
`assertE2eDatabase()` (`TEST_DATABASE_URL` is the slot DB with a small `connection_limit`);
don't import `@vesta/shared`'s `prisma`, which reads `DATABASE_URL` from the env and would hit
`vesta_dev`. The shared client is disconnected in worker teardown (`closeE2eDb` via
`support/fixtures.ts`). Write dates with the `days` helper.
Only set up state this way; check results through the UI or HTTP. Admin users for the suite are
created with `createAdminUser` in that same DB — not by reusing seeded web personas.
`createLoggedInAdmin` closes the browser context if HTTP login fails so contexts do not leak.

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
or any `body.destinationAddresses`), `{ phone }` (either, after normalisation); all given fields must match.
`{ any: true }` matches every call to the path and is **exclusive**: only for a path nobody else uses,
i.e. GET `/health`, which carries no subscriber. Those tests run on the desktop project only
(`bdapps-health.spec.ts`). Typed webhook bodies: `SubscriptionNotifyPayload`, `SmsReceivePayload`,
`SmsReportPayload`, `UssdReceivePayload` in `support/fake-bdapps.ts`.

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

**Translog** has no screen: `translogFor(userId)` from `support/translog.ts` reads the web app's
translog lines for that user (`plan.change` with `cause`).

## Conventions

- **Find elements by role and accessible name, in English** (`getByRole('button', { name: 'Send OTP' })`,
  `getByLabel('Phone Number')`). `data-testid` only where an element has no accessible name, and
  then open an issue for the missing name.
- **Anything that saves uses its own `newUser()`**; personas are read-only. Tests run fully parallel.
- **Check what a user or BDApps would see**: the page after a reload, a call recorded by the fake,
  an email in Mailpit. Query the DB only for results with no screen (translog, webhook events, audit).
- **Dates are Bangladesh days from the server clock** (`days` fixture); every context runs in `Asia/Dhaka`.
- **A bug found by a test**: don't change app code. Open an issue, then mark the test expected-to-fail
  with the link, so it turns red (unexpected pass) once fixed:
  ```ts
  test('default log date is the Bangladesh day', async ({ page }) => {
    test.fail(true, 'https://github.com/adibahsan/cycle-circle/issues/NNN')
    ...
  })
  ```
- Don't reset the fake BDApps or the DB from a test; other tests share them.
- Global setup reuses a persona's saved session while the app still accepts it (a second OTP
  within 60 s would hit the resend cooldown). Tests must not log personas out.
- `tests/web/harness.spec.ts` is the contract for the helpers; keep it green when changing them.
- `pnpm --filter @vesta/e2e typecheck` and `lint` must pass (root `pnpm typecheck && pnpm lint` covers it).
- `next build` rewrites `apps/*/next-env.d.ts`; don't commit that change (`git checkout apps/*/next-env.d.ts`).
