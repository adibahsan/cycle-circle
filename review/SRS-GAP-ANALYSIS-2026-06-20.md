# Vesta `apps/web` ↔ SRS Gap Analysis

**Date:** 2026-06-20
**Scope:** Customer-facing web app (`apps/web`) reviewed against `docs/vesta/source/SRS.md`
**Excluded:** Field-level encryption (FR-ENC / NFR-SEC-01) — excluded by request.

---

## Method

Extracted every functional requirement (§3.2) + Definition-of-Done (§4) + traceability matrix
(App. C) + client-review feedback (App. D) from the SRS, then mapped each against the actual web
routes, API handlers, server actions, and the `@vesta/shared` services the web app depends on.
Every finding below is backed by a `file:line` citation.

**Scoping rules:**

- Items the SRS marks **`(deferred — v2)`** / **`(deferred — post-v1)`** are NOT counted as gaps
  (listed separately in §C so nothing looks "missed").
- `apps/web` depends on `packages/shared`; shared-layer gaps that change the web user experience are
  included. Pure admin-app concerns (FR-ADMIN, FR-CMS, admin-side FR-ANALYTICS/FR-SMS UI) are flagged
  out-of-scope.
- Current target version is **v1.3** (per recent commits + App. D); v1.3 client-review items are
  in-scope and treated as gaps if unfinished.

**Overall:** the core P0 flows (OTP/email auth, multi-profile, period/symptom logging, calendar,
dashboard, predictions, onboarding, i18n, feedback, subscribe-via-CAAS, webhooks) are **built and
functional**. Gaps are concentrated in (1) data-isolation/infra fidelity, (2) the SMS broadcast
pipeline, (3) a handful of v1.3 polish items, and (4) several "spec says X, code does Y" deviations.

---

## A. Confirmed Gaps (in-scope; excludes encryption + v2-deferred)

### HIGH severity

#### A1 — No PostgreSQL Row-Level Security
**Refs:** FR-PROFILE, NFR §3.6.1, infra diagram §B.3
SRS mandates RLS on `profiles`, `period_logs`, `symptom_logs`; acceptance: *"a direct DB query shall
confirm user A's period_logs are not readable by user B's session."* No `ENABLE ROW LEVEL SECURITY` /
`CREATE POLICY` exists anywhere in `packages/shared/prisma/schema.prisma` or `prisma/migrations/**`.
Isolation is **application-layer only** (services filter by `userId`). The DB-level acceptance test
cannot pass.
**Fix:** add RLS policies + per-request `SET app.current_user_id` (Prisma `$executeRaw` in `withAuth`),
or formally re-scope the requirement to app-layer isolation if RLS is intentionally dropped.

#### A2 — SMS daily broadcast is never auto-dispatched
**Refs:** FR-SMS, OPS cron table §3.6.3
SRS: the daily-reminders cron (08:00 UTC) must *"dispatch the next scheduled SMS broadcast"*; DoD:
*"admin uploads 7 messages → system sends one per day for 7 days."*
`apps/web/src/app/api/cron/daily-reminders/route.ts` only sends per-user
`sendPeriodAlert/sendFertileAlert/sendLoggingReminder/sendProfileCompletionReminder`. `sendBroadcast`
(`packages/shared/src/server/services/sms-service.ts:158`) has **no caller anywhere** — scheduled
broadcasts can never go out automatically.
**Fix:** in `daily-reminders`, pick the next `SCHEDULED` `SmsBroadcast`, call `sendBroadcast`, apply
content-override (deactivate previous day), respect the Pro-only audience.

#### A3 — Redis is `ioredis` with a serverless-unsafe in-memory fallback
**Refs:** FR-SESSION
`packages/shared/src/server/adapters/redis.ts` uses `ioredis` (not Upstash) and **falls back to an
in-process `Map` when `REDIS_URL` is unset**. The JWT-`jti` blacklist and rate-limiter live there. On
Vercel's multi-instance serverless runtime, an in-memory store is per-lambda → a blacklisted token can
still authenticate on another instance, and OTP rate limits don't hold globally. FR-SESSION acceptance
(*"logged-out token returns 401 before exp"*, *">3 OTP/min → 429"*) only holds if a real shared Redis
is wired in prod.
**Fix:** confirm `REDIS_URL` points to a managed/shared Redis in every prod deployment; fail-closed
(or log loudly) if the in-memory fallback is ever active outside local dev.

### MEDIUM severity

#### A4 — Prediction recalc is synchronous; no async job, no "updating" UI state
**Refs:** FR-PRED, DC-02
SRS: *"recalculation shall be asynchronous (QStash job); the UI shall show an 'updating' state while in
flight."* `period-logs/route.ts:38` and `period-logs/[id]/route.ts:27,40` call
`await recalculatePrediction(profileId)` inline before responding; the `JobEvent` queue
(`adapters/jobs.ts`, has a `PREDICTION_RECALC` type) is **never used**, and no in-flight indicator is
shown. NFR-PERF-01 (<10 s) currently passes only because recalc is cheap.
**Fix:** enqueue recalc to `JobEvent`/QStash + add an "updating" state, or (if keeping it sync) amend
FR-PRED/DC-02 to record the decision.

#### A5 — SMS delivery-report reconciliation not implemented
**Refs:** FR-SMS, FR-WEBHOOK
`sms-service.sendBroadcast` hardcodes `targetCount/deliveredCount/failedCount = 0` (dev branch
simulates; prod leaves counts at 0 — `sms-service.ts:182,190-195`). The `/api/webhooks/sms/report`
handler persists the report but does not roll it up into the broadcast's delivery stats. DoD: *"admin
panel shall reflect accurate delivery statistics"* — currently impossible.
**Fix:** link delivery reports to the broadcast and increment delivered/failed counts.

#### A6 — Webhook IP validation is allow-all when `BDAPPS_WEBHOOK_IPS` is unset
**Refs:** FR-WEBHOOK, NFR-SEC-07
`adapters/webhooks.ts` `validateWebhookSource` permits all sources if the env var is empty. Acceptance:
*"a request from a non-whitelisted IP shall return 401."* If the var is unset in prod, webhooks accept
anything. (The Resend webhook is fine — it uses Svix HMAC.)
**Fix:** fail-closed in prod (reject when allowlist is empty), or add signature verification for BDApps.

#### A7 — Content reader doesn't surface current-phase articles first
**Refs:** FR-CONTENT
`content-service.listPublishedArticles` (`content-service.ts:280`) orders by `publishedAt desc` only;
`phase` is an optional exact filter taken from the **URL query**, not the user's current cycle phase.
SRS: *"the reader UI shall surface articles relevant to the user's current phase first."*
**Fix:** pass the active profile's current phase and sort phase-matching articles to the top.

#### A8 — Content reader has no locale-fallback indicator
**Refs:** FR-CONTENT
`ContentClient.tsx:60-68` silently returns English when a BN translation is missing. SRS: *"fall back to
the other language with a clear indicator."*
**Fix:** render a small "shown in English / translation unavailable" badge when falling back.

#### A9 — Language preference is not persisted to the user account
**Refs:** FR-I18N
Toggle writes only to zustand/localStorage (`LanguageToggle.tsx:11-14`, `store.ts:28-31`,
`SettingsClient.tsx:284`). `User.language` is set only at magic-link signup, never from a post-login
toggle (no `language` field in `settings-actions.ts`/`user-actions.ts`). SRS: *"language preference
shall be persisted per user account."* (The DoD "survives reload" passes via localStorage, but
cross-device account-level persistence does not.)
**Fix:** add a server action to write `User.language` when the toggle changes.

#### A10 — User insights dashboard is only partially configurable
**Refs:** FR-INSIGHTS (v1.3)
`InsightsClient.tsx` has a date-range control (✓) and a chart-type control (✓ but it only affects the
Cycle-Length chart, lines 153-184/612) and **no metric selector** (the four panels are fixed cards,
:595-680). SRS v1.3: *"switch chart type where applicable, select a date range, and choose which metric
to view."*
**Fix:** add a metric selector (or confirm "where applicable" covers the fixed panels) and extend the
chart-type control to the other charts.

#### A11 — Email-trial gate returns 402, not the spec'd 403
**Refs:** FR-GATE, FR-AUTH acceptance
`packages/shared/src/server/middleware.ts:25-37` blocks expired email-trial FREE users with
`ApiError(402, 'TRIAL_EXPIRED')`. SRS repeatedly specifies **HTTP 403** for trial-expiry gating. Also
note the guard fires on **every** `withAuth` route — verify the upgrade/subscribe path stays reachable
so an expired user can still convert to Pro.
**Fix:** change status to 403 to match acceptance criteria (or amend the SRS to 402), and confirm the
subscribe flow is exempt.

### LOW severity / fidelity notes

#### A12 — "ARIMA"/"LSTM" tiers are labels, not the named algorithms
**Refs:** FR-PRED
`server/prediction-calc.ts` produces tier `'ARIMA'` at ≥6 cycles but the math is a recency-weighted
average (weights `[1,1.5,2,2.5,3,3.5]`), not ARIMA; `'LSTM'` is never produced. The literal acceptance
check (`predictions.tier === 'ARIMA'`) passes, but the "higher-accuracy ARIMA" intent isn't met. Also
three divergent confidence/phase formulas coexist (`prediction-calc.ts`, `utils/cycle-utils.ts`,
`tracking-service.calculatePhase`) — a consistency risk.
**Fix:** document the simplification in the SRS, and unify the phase/confidence formula into one shared
function.

#### A13 — Pregnancy mode is a selectable goal but renders "Coming Soon"
**Refs:** scope inconsistency
SRS goals are `tracking | conceive | perimenopause` only, yet onboarding/profiles offer a 4th
`pregnancy` goal that shows a placeholder dashboard (`DashboardClient.tsx` ~line 404, i18n
`pregnancyComingSoon`). Not an SRS gap, but the UI offers a non-functional mode.
**Fix:** hide the pregnancy option until built, or note it as an intentional teaser.

#### A14 — Notifications use plain bilingual HTML, not React Email templates
**Refs:** FR-NOTIF (cosmetic)
SRS names React Email; `adapters/notifications.ts`/`mail.ts` build HTML strings. Delivery + language
selection work, so the DoD passes; only the named library differs.

---

## B. Likely-met but worth a quick confirm (not counted as gaps)

- **Goal-based notification filtering (v1.3, App. D #3):** achieved via per-goal default prefs
  (`profile-service.defaultNotificationPrefsForGoal` → conceive turns periodAlert/loggingReminder off,
  fertileWindow on) which the cron respects. Confirm a TTC profile truly receives fertile-only by default.
- **Profile completion reminders via email + SMS (v1.3, App. D #5):** implemented in `daily-reminders`
  (`sendProfileCompletionReminder`, capped ≤14 days). ✓
- **Profile mode editable post-onboarding (v1.3, App. D #2):** `ProfilesClient` EditProfileForm goal
  selector → `updateProfile`. ✓
- **Logging nudges (FR-NUDGE v1.3):** `components/nudge/LoggingNudge.tsx` exists; verify bilingual copy,
  `prefers-reduced-motion`, dismissal/frequency-cap, and `aria-live`.
- **User CSV/XLSX export (FR-EXPORT):** present in `SettingsClient` (the shared `export-service` only has
  admin CSVs, so the web export is built app-side); confirm it covers period+symptom and is
  ownership-scoped.
- **OTP rate limit:** request limiter is 3/60s — confirm it's keyed by MSISDN (acceptance wording) and
  not only by IP.

---

## C. Explicitly deferred in the SRS — NOT gaps (listed so nothing looks missed)

- **CAAS dunning / grace period / Pro revocation on lapse** — `(deferred — v2)` (FR-BILL, NFR-REL-01,
  NFR-MAINT-01/BILL-02). `recordSubscriptionCheckResult` has partial 3-strike logic but grace activation
  is intentionally unwired.
- **Pro/free feature gating** — `(deferred — post-v1)` (FR-GATE, NFR-BILL-01). Only the email-trial gate
  is active in v1.
- **Tier-3 LSTM real model** — v2 (FR-PRED).
- **USSD interactive menus** — v2 (FR-WEBHOOK; receive endpoint logs only).
- **BDApps charging-flow analysis** — OPEN/blocked, App. D §D.7.
- **Field-level encryption (FR-ENC, NFR-SEC-01)** — excluded by request.

---

## D. Architecture divergences from the SRS stack (decide: adopt or amend SRS)

The SRS §3.6.3 / §B.3 specify **Upstash Redis + Upstash QStash**. The implementation uses neither:

- **Redis:** self-hosted `ioredis` + in-memory fallback (see A3).
- **QStash:** replaced by a DB-backed `JobEvent` queue (`adapters/jobs.ts`) **with no worker/consumer
  shipped**; async work is currently inline or undispatched (see A4).

These are viable choices (the SRS upgrade-path even allows a Railway worker), but `CLAUDE.md` and the SRS
still claim Upstash. **Recommend a one-line decision per service:** keep + update the docs, or migrate.

---

## E. Recommended remediation order

1. **A2 + A5** — wire SMS broadcast dispatch + delivery reconciliation into `daily-reminders` (largest
   functional gap; the whole FR-SMS pipeline is dormant).
2. **A1 / A3 / A6** — data-isolation & infra hardening (RLS decision, prod Redis confirmation, webhook
   fail-closed). These are the security-adjacent P0s.
3. **A11 / A9 / A8 / A7** — small spec-conformance fixes (403 status, language persistence, content
   reader phase-first + fallback indicator).
4. **A10 / A4** — v1.3 insights configurability + async recalc + "updating" state.
5. **A12 / A13 / A14** — documentation/fidelity cleanups and SRS amendments.
6. Resolve §D (Upstash vs current) as an explicit decision and sync the docs.

---

## F. Verification approach

- **A1:** after adding RLS, run two sessions and confirm cross-user `period_logs` SELECT returns 0 rows
  at the DB level (the SRS acceptance test).
- **A2/A5:** seed 3 `SCHEDULED` broadcasts, run `daily-reminders` 3× (mock date), assert one `tel:all`
  send/day, previous deactivated, and delivered/failed counts populated from a simulated `sms/report`.
- **A3:** unset `REDIS_URL` locally and confirm the app refuses the in-memory store in a prod-like build;
  with a real Redis, confirm logout→401-before-exp and >3 OTP/min→429.
- **A4/A11/A9/A7/A8/A10:** Playwright (`ui-review-playwright` skill) — log a period and watch for an
  "updating" state; expire an email trial and assert 403; toggle language, reload in a fresh
  browser/session and confirm it persists; verify content ordering + fallback badge; verify insights
  controls re-render without full reload.
- Run `just typecheck-all` and the existing web `__tests__` after each change; prefer real-DB tests over
  mocks per project convention.

---

## Appendix — Requirement coverage snapshot

| FR | Title | Status |
|----|-------|--------|
| FR-AUTH | Phone OTP + email fallback + profile completion | ✅ built (A11: trial gate is 402 not 403) |
| FR-PROFILE | Multi-profile (≤6), mode editable | ✅ built (A1: no DB RLS) |
| FR-TRACK | Period logging | ✅ built |
| FR-DASH | Cycle dashboard | ✅ built (A13: pregnancy placeholder) |
| FR-CAL | Monthly calendar | ✅ built |
| FR-SYMP | Symptom logging (30+) | ✅ built (32 symptoms) |
| FR-PRED | Three-tier predictions | ⚠️ A4 sync recalc, A12 tiers are labels |
| FR-ONBOARD | Onboarding flow | ✅ built |
| FR-BILL | Pro via CAAS | ✅ subscribe built; dunning deferred v2 |
| FR-GATE | Email-trial gating | ⚠️ A11 (402 vs 403); Pro/free deferred |
| FR-I18N | Bilingual EN+BN | ⚠️ A9 not persisted to account |
| FR-SESSION | JWT blacklist + rate limit | ⚠️ A3 in-memory fallback risk |
| FR-WEBHOOK | BDApps webhooks (×4) | ⚠️ A6 allow-all when env unset |
| FR-NOTIF | Email notifications + prefs | ✅ built (A14 plain HTML) |
| FR-CONTENT | Bilingual content | ⚠️ A7 phase-first, A8 fallback indicator |
| FR-SMS | SMS alerts + circulation | ❌ A2 broadcast not dispatched, A5 no reconciliation |
| FR-EXPORT | User data export | ✅ built app-side (confirm scoping) |
| FR-FEEDBACK | In-app feedback | ✅ built |
| FR-NUDGE | Logging nudges (v1.3) | ✅ built (confirm a11y + cap) |
| FR-INSIGHTS | User insights (v1.3) | ⚠️ A10 metric selector missing |
| FR-ENC | Field encryption | ⏭️ excluded by request |
| FR-ADMIN / FR-CMS / FR-ANALYTICS | Admin app | out of `apps/web` scope |
