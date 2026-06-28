# Vesta — Feature Implementation Log (2026-06-28)

> A human-readable record of the SRS feature work completed in this session on
> branch `claude-experiment` (base commit `cdd1f9b`). For each item: what the
> gap was, what changed, the key files, and how to verify it.
>
> **Scope note:** Field-level encryption (FR-ENC) was intentionally **out of
> scope** for this round. v2-deferred items (Pro grace period / auto-disable)
> and the OPEN BDApps charging-analysis item remain deferred per the SRS.
>
> **Headline outcome:** 16 commits, 39 files, ~+1700 lines. The web test suite
> went from **15 failing → 251 passing**, and the app now degrades gracefully
> when Redis is unavailable.

---

## At a glance

| # | Area | What shipped | Commit |
|---|------|--------------|--------|
| 1 | Infra resilience | Redis adapter survives an outage (fail-open) | `0227ddd` |
| 2 | Test harness | Action tests realigned to `revalidateTag` + direct-recalc | `31f1c75` |
| 3 | Test harness | Stale prediction tests updated to current behaviour | `bafb7d9` |
| 4 | FR-CMS | Server-side HTML sanitization on article save | `dfd295f` |
| 5 | FR-NOTIF/FR-SMS | Goal-based notification filtering (verified + locked) | `c2d73bc` |
| 6 | FR-CONTENT | Current-phase surfacing + locale-fallback indicator | `e46fd0a` |
| 7 | FR-EXPORT | Per-profile export scope + correct copy | `ca2e2cd` |
| 8 | FR-AUTH | Server-side 60s OTP resend cooldown | `398d2cb` |
| 9 | FR-AUTH | Auto-open profile-completion popup ~1 min after login | `5ff1ba1` |
| 10 | FR-ANALYTICS | Per-tier prediction-accuracy MAE (backtested) | `c7345b3` |
| 11 | FR-ANALYTICS | Feedback panel on the admin analytics dashboard | `561e498` |
| 12 | FR-ANALYTICS | Symptom-logs-by-cycle-phase aggregation + panel | `448bbc0` |
| 13 | FR-SMS | Bilingual content, bulk entry, content-override, delivery reports (service) | `e682de7` |
| 14 | FR-SMS | Daily broadcast cron + delivery-report correlation | `4ddcc99` |
| 15 | FR-SMS | Bilingual + bulk admin UI; send scheduled early | `718d951` |
| 16 | FR-NUDGE/FR-INSIGHTS | Cross-session nudge cap + tabular-nums chart axes | `abd8db3` |

---

## 1. Redis resilience (foundational) — `0227ddd`

**Gap.** `packages/shared/src/server/adapters/redis.ts` chose the in-memory
fallback purely on whether `REDIS_URL` was *set*, and built a bare
`new Redis(url)` with no resilience options or error handler. If `REDIS_URL`
was set but the server was **down**, every request that touched the JWT
blacklist or rate limiter blocked ~13 s, flooded logs with unhandled
`AggregateError`, and logged users out into a `/login` bounce.

**What changed.** The client is now built with `maxRetriesPerRequest: 1`,
`enableOfflineQueue: false`, a 1 s `connectTimeout`, and a bounded
`retryStrategy`, plus a throttled `.on('error')` handler. `blacklistJti`,
`isJtiBlacklisted`, and `checkRateLimit` each wrap their Redis call in
try/catch and fall through to the in-memory path on failure.
`isJtiBlacklisted` is **fail-open** — a Redis outage never rejects valid
tokens.

**Net effect.** The app works whether `REDIS_URL` is unset (prod / in-memory)
or set-but-unreachable (Redis down). This is the basis for the "must run if
Redis is unavailable" requirement.

**Verify.** `pnpm --filter @vesta/web exec vitest run __tests__/adapters/redis-fallback.test.ts`
(covers both the in-memory path and the outage-fallback path with ioredis mocked
to reject).

---

## 2–3. Test-harness repair — `31f1c75`, `bafb7d9`

The suite had **15 pre-existing failures** that masked real signal:

- **`next/cache` drift** — actions were migrated to `revalidateTag(tag, {expire:0})`
  and tracking/period-log-sync switched from `enqueueJob` to calling
  `recalculatePrediction` directly, but the action tests still mocked/asserted
  the old APIs. Updated the 5 action test files to mock `revalidateTag`, assert
  the concrete cache tags, and assert `recalculatePrediction`.
- **Stale prediction tests** — `getCurrentCycleDay` was deliberately changed
  (commit `643170e`) from modulo-wrap to clamp (so a late user isn't shown a
  fabricated "day 1"); the boundary tests were updated to the clamp contract.
  The obsolete "enqueues a PREDICTION_RECALC job event" test was converted to
  verify the prediction is recomputed synchronously.

**Result:** suite green (was 15 failing). No product code touched.

---

## 4. FR-CMS — server-side HTML sanitization — `dfd295f`

**Gap.** Article bodies (Tiptap HTML) were stored verbatim, so a crafted body
could persist `<script>`, event handlers, `javascript:` URLs, or `<iframe>`
and later reach `dangerouslySetInnerHTML` in the reader. (DoD security gate.)

**What changed.** Added `sanitize-html` to `@vesta/shared` and a
`sanitizeArticleHtml()` helper (Tiptap-appropriate allowlist; http/https/mailto
only; `rel="noopener noreferrer"` forced on links). Both write paths in
`content-service` sanitize `bodyEn`/`bodyBn` before persistence — a single
chokepoint the admin actions can't bypass. Titles are left as-is (rendered as
React text, not HTML).

**Verify.** `vitest run __tests__/services/content-sanitize.test.ts` (script
strip, onclick strip, safe-tag preservation, `javascript:`/`<iframe>` neutralised).

---

## 5. FR-NOTIF / FR-SMS — goal-based notification filtering (v1.3) — `c2d73bc`

**Finding.** Already implemented (the verification missed it): a profile's goal
maps to default `NotificationPreference` flags via
`defaultNotificationPrefsForGoal()` — `conceive → {period:off, fertile:on,
logging:off}` — applied on profile create and on goal change. The daily-reminders
loop gates period/fertile/logging dispatch for **both email and Pro SMS** on
those flags, so a TTC profile receives fertile-window alerts only, overridable
via the settings toggles.

**What changed.** Added a contract unit test pinning the goal→prefs mapping
(all four goals + null + legacy labels) and the `normalizeGoal`/`isTTC` helpers
so the v1.3 behaviour is regression-protected.

---

## 6. FR-CONTENT — current-phase surfacing + locale fallback — `e46fd0a`

**Gap.** The reader only filtered by an explicit `?phase` tab and never
surfaced articles for the user's *actual* current cycle phase; the BN→EN body
fallback was silent (SRS requires a visible indicator).

**What changed.**
- `content/page.tsx` resolves the active profile (cookie-aware
  `getActiveProfileId`) and reads `getDashboardData().currentPhase`.
- In the default view, `ContentClient` orders current-phase articles first,
  shows a "Articles for your &lt;phase&gt; phase first" note, a "For you" badge
  on matching cards, and a dot on the user's phase tab.
- Adds a BN→EN fallback banner in the reader (`role="note"`) and an "EN" chip on
  cards whose Bengali body/title is missing.
- New i18n keys (EN+BN): `content.phaseFirstNote`, `content.forYou`,
  `content.showingInEnglish`.

---

## 7. FR-EXPORT — per-profile scope + correct copy — `ca2e2cd`

**Gap.** Both export actions looped **all** profiles while the settings copy
claimed "active profile only" — a privacy/correctness mismatch.

**What changed.** `exportUserDataCsv` / `exportUserDataRows` take
`{ profileId?, allProfiles? }` and resolve scope via `resolveExportProfiles()`:
the active profile by default, all profiles only on explicit opt-in.
`listProfiles()` stays keyed on the JWT user, so a forged `profileId` can never
widen scope. Settings adds a labelled "Include all profiles" checkbox; the copy
(EN+BN) was corrected. Filenames carry a `-profile`/`-all-profiles` suffix.

**Verify.** `vitest run __tests__/actions/settings-actions.test.ts` (single
profile excludes others; `allProfiles` includes all).

---

## 8. FR-AUTH — server-side 60s OTP resend cooldown — `398d2cb`

**Gap.** Only a 3/min abuse limiter existed server-side; the 60 s resend gate
lived solely in the client UI and was bypassable via direct API calls.

**What changed.** `getOtpResendCooldownRemaining(phone)` (in `auth-service`)
reads the most recent `OtpChallenge.createdAt` — the table is the source of
truth, so this holds **regardless of Redis**. The OTP request route rejects an
early resend with `429 OTP_COOLDOWN` before touching the abuse limiter. Cooldown
math is a pure `otpCooldownRemaining()` helper, unit-tested.

**Verify.** `vitest run __tests__/services/otp-cooldown.test.ts`.

---

## 9. FR-AUTH — profile-completion popup timer + re-prompt — `5ff1ba1`

**Gap.** The completion modal opened only on a manual click of the tracker pill;
no ~1-min auto-open, and the sessionStorage dismiss key was written but never
read.

**What changed.** `(main)/layout.tsx` schedules a one-shot ~60 s timer (once per
session) that auto-opens the modal for incomplete profiles, re-checking
completeness + the dismiss flag at fire time. The session-scoped dismiss is now
honoured — snoozes for the session, re-prompts on the next login (sessionStorage
clears with the session). DOB collection was **not** added ("required profile
details" is unspecified and would need a schema change).

---

## 10–12. FR-ANALYTICS — MAE, feedback panel, symptoms-by-phase — `c7345b3`, `561e498`, `448bbc0`

- **Prediction-accuracy MAE.** No MAE existed (the panel showed average
  confidence). There's no prediction-history table and only 2 cron jobs are
  allowed, so MAE is computed **on-demand** via a backtest:
  `computePredictionMaeByTier` walks each profile's period-log history, predicts
  each next start from prior cycles (reusing `predictCycleLength`), compares to
  the actual start, and buckets the absolute error by tier (≥6 cycles → ARIMA).
  A new "Prediction Accuracy (MAE · days)" panel shows per-tier MAE with sample
  sizes. Hand-computed unit test: `vitest run __tests__/services/prediction-mae.test.ts`.
- **Feedback panel (v1.3).** Added a "Feedback" section to the admin analytics
  dashboard (volume / category / rating) reusing the existing range-aware
  feedback aggregations — so it also honours the dashboard date-range control.
- **Symptoms-by-phase.** Added `getSymptomsByPhase`: each symptom log is anchored
  to its most recent preceding period start, the cycle day derived, and mapped
  to a phase via `getCurrentPhase`. New "Symptom Logs by Cycle Phase" panel
  beside the by-category chart. Pure `phaseForLog` helper unit-tested:
  `vitest run __tests__/services/symptoms-by-phase.test.ts`.

---

## 13–15. FR-SMS — content circulation + delivery reports — `e682de7`, `4ddcc99`, `718d951`

The largest feature. Required an **additive migration**
(`20260628131041_add_sms_circulation_fields`) adding `SmsBroadcast.messageBn`,
`active`, and `providerMessageId`.

- **Service (`e682de7`).** `combineBilingualSms` / `parseBulkSmsInput` pure
  helpers; `createBroadcast` accepts a Bengali body; `createBroadcastsBulk`
  schedules one message per day (08:00 UTC). `performSend` (shared by manual
  send + cron) sends a combined EN/BN message via `smsSend(['tel:all'])`,
  records `providerMessageId`, and enforces **content-override** (deactivates all
  other active broadcasts so only the newest daily content stays active).
  `dispatchScheduledBroadcast` picks the earliest due scheduled broadcast (one
  per day). `recordSmsDeliveryReport` correlates a report by `providerMessageId`
  (fallback: latest active SENT) and increments delivered/failed.
- **Wiring (`4ddcc99`).** Folded into the daily-reminders cron (respecting the
  2-job Hobby budget); the `sms/report` webhook keys idempotency per-recipient
  (`requestId:destinationAddress`) and only counts **new** reports, so retries
  never double-count.
- **Admin UI (`718d951`).** New-broadcast modal gains a Single/Bulk toggle —
  Single adds an optional Bengali field; Bulk takes "English | বাংলা" lines + a
  start date with a live count preview. `canSend` now also permits SCHEDULED so
  an admin can send early. Target/Delivered/Failed columns now reflect real
  webhook-driven counts.

**Verify.** `vitest run __tests__/services/sms-circulation.test.ts`
(`combineBilingualSms` + `parseBulkSmsInput`).

---

## 16. FR-NUDGE + FR-INSIGHTS polish — `abd8db3`

- **Nudge frequency cap.** Dismissal now writes a localStorage snooze (3 days)
  in addition to the session flag, so the logging nudge doesn't reappear on
  every visit; it re-surfaces once the snooze lapses and a logging gap persists.
- **Insights axes.** `font-variant-numeric: tabular-nums` now applies to the
  Recharts axis tick values (previously only the stat-card numerals had it).

---

## Deliberately not done / deferred

| Item | Reason |
|------|--------|
| **FR-ENC** field-level encryption | Out of scope for this round (per instruction). |
| **FR-BILL** grace period / Pro auto-disable | v2-deferred in the SRS. |
| **FR-CMS** Tiptap image upload to Supabase storage | Needs real Supabase storage credentials; not wireable/verifiable locally. Remaining. |
| **FR-INSIGHTS** metric selector + chart-type on every chart | Minor P2 polish on an already-usable page; date-range + chart-type (cycle chart) + tabular-nums already satisfy "configurable views". |
| **BDApps charging analysis (App. D §D.7)** | OPEN/blocked pending resolution with the client. |
| **`getCurrentCycleDay`** late-user behaviour | Intentional clamp (commit `643170e`); not changed. |

---

## Testing & verification

- Web suite: **251 passing** (`pnpm --filter @vesta/web exec vitest run`), up
  from 15 failing at the start (harness repaired).
- Typechecks clean: `just typecheck` (web), `pnpm --filter @vesta/admin exec tsc --noEmit`.
  `@vesta/shared` has 2 **pre-existing** errors in `src/server/simulator/checker.ts`
  (`cache` on `RequestInit`) unrelated to this work.
- DB migration `20260628131041_add_sms_circulation_fields` applied locally
  (additive only: 3 columns + 1 index).
- New test files this session: `redis-fallback`, `content-sanitize`,
  `goal-notification-prefs`, `otp-cooldown`, `prediction-mae`,
  `symptoms-by-phase`, `sms-circulation`.
