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
| `newPhone()` (`support/users.ts`) | A fresh phone in the E2E range `0136XXXXXXX`, for flows that sign up through the UI themselves. | `const phone = newPhone()` |
| `loginWithOtp(request, phone, fake?)` | Real OTP login over HTTP (request → code from fake → verify); cookies land in `request`. New number → BDApps OTP; existing subscriber → App OTP (read from the SMS the fake received). | `await loginWithOtp(context.request, phone)` |
| `createThrowawayUser(browser, opts?)` | `newUser` without the fixture (e.g. in `beforeAll`); you close `context`. | `const { context } = await createThrowawayUser(browser)` |
| `ipFor(key)` | Stable fake `x-real-ip` for a key. Each test already gets its own (OTP sends are capped at 10/hour/IP). Set it yourself only to test the IP limit. | `extraHTTPHeaders: { 'x-real-ip': ipFor('x') }` |
| Personas (`support/personas.ts`) | Seeded read-only users, logged in once by global setup: `streaker`, `allGood`, `stale`, `power`, `newUser`, `proMulti` (all Pro); `admin` = seeded super admin. **Never save data as a persona.** | `test.use({ storageState: statePath('power') })` |
| `days` fixture (`support/bangladesh-day.ts`) | Bangladesh days from the **server's** clock (HTTP `Date`): `today`, `daysAgo(n)`, `daysFromNow(n)` (`YYYY-MM-DD`), `startOf(day)` (the `Date` to write to the DB), `now`. No fake clock. | `const start = days.startOf(days.daysAgo(35))` |
| `fakeBdapps` fixture (`support/fake-bdapps.ts`) | Control client for the fake BDApps. | see below |
| `assertMailpit()` (`support/mailpit.ts`) | Mailpit reachability. A "wait for email to X" client arrives with the magic-link ticket. | `await assertMailpit()` |
| `URLS`, `PORTS`, `SECRETS`, `DATABASE_URL` (`support/slot.ts`) | Slot-aware URLs (`URLS.web/admin/fakeBdapps/mailpit`), the cron secret, admin credentials, DB URL. | `` request.get(`${URLS.web}/api/cron/x`, { headers: { authorization: `Bearer ${SECRETS.cronSecret}` } }) `` |

`fakeBdapps` methods:

| Method | Example |
|---|---|
| `latestOtp(phone, { since?, timeoutMs? })` → `{ kind: 'bdapps'\|'app', code, referenceNo?, at }` | `const { code } = await fakeBdapps.latestOtp(phone)` |
| `calls({ path?, sinceSeq? })` → merchant calls `{ seq, path, body, httpStatus, response }` | `await fakeBdapps.calls({ path: '/subscription/send' })` |
| `subscriber(phone)` → `{ phone, maskedId, status }` or `undefined` | `expect(await fakeBdapps.subscriber(phone)).toMatchObject({ status: 'UNREGISTERED' })` |
| `failNext(path, { mode, statusCode?, httpStatus?, delayMs?, times? })` | `await fakeBdapps.failNext('/subscription/send', { mode: 'error', statusCode: 'E1601' })` |
| `sendWebhook(appPath, body)` → the app's `{ status, body }` | `await fakeBdapps.sendWebhook('/api/webhooks/subscription/notify', {...})` |

DB setup for states the UI can't reach in time: no helper yet (the first ticket that needs one
adds `support/db.ts`). Build it as `new PrismaClient({ datasourceUrl: DATABASE_URL })` from
`@prisma/client` (a dependency of this package) after `assertE2eDatabase()`; don't import
`@vesta/shared`'s `prisma`, which reads `DATABASE_URL` from the env and would hit `vesta_dev`.
Write dates with the `days` helper. Only set up state this way; check results through the UI or HTTP.

## Fake BDApps (`fake-bdapps/`)

Started by Playwright per slot (`pnpm e2e:fake-bdapps` runs one by hand on :4300). In-memory,
fresh every run.

- `merchant-routes.ts`: route table `path → (body, state) => BDApps JSON`. Implemented:
  `/subscription/otp/request`, `/subscription/otp/verify`, `/subscription/getStatus`,
  `/subscription/send`, `/sms/send`. Anything else answers 404 (and is still recorded).
  **Add an endpoint = add an entry.**
- `state.ts`: subscribers (by phone), issued OTPs, sent SMS, recorded calls, failure queue.
- `server.ts`: credential check (`E1313`), call recording, failure queue, `/_control/*` API.

Behaviour mirrors live BDApps for our number-masking app:
- `otp/request` for a number that is already a Subscriber → `E1351` (the app then sends an App OTP by SMS).
- `otp/verify` subscribes the number under a **new masked subscriber id** (`tel:<opaque>`).
- `getStatus`, `send`, `sms/send` accept only the current masked id; raw numbers → `E1951`.
- A 6-digit code in an SMS to a subscriber is kept as that phone's latest (`app`) OTP.

Control API (the client wraps it): `GET /_control/health`, `POST /_control/reset`,
`GET /_control/otp?phone=`, `GET /_control/calls?path=&sinceSeq=`, `GET /_control/subscribers/:phone`,
`POST /_control/failures {path, mode, ...}`, `POST /_control/webhook {path, body}`.

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
