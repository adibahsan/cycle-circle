# DEV_SRS — Implementation Tracker

> Developer-facing tracker mapping SRS requirements to codebase implementation.
> Last updated: 2026-05-29
> SRS version: 1.2 (SRS-VESTA-001)

---

## Quick Status

| Status | Count |
|--------|-------|
| Done | 9 |
| In Progress | 10 |
| Not Started | 3 |

---

## Requirements

---

### FR-AUTH — Phone Authentication + Email Fallback + Profile Completion
**Priority:** P0
**Status:** In Progress

**Files:**
- `apps/web/src/app/(auth)/login/page.tsx` — OTP login UI
- `apps/web/src/app/(auth)/verify-otp/page.tsx` — OTP entry UI
- `apps/web/src/app/(auth)/email-login/page.tsx` — Email fallback login UI
- `apps/web/src/app/api/auth/otp/request/route.ts` — OTP request endpoint; MSISDN validation, rate-limit (3/min), BDApps call, OtpChallenge DB record
- `apps/web/src/app/api/auth/otp/verify/route.ts` — OTP verify endpoint; upserts User, issues JWT in HttpOnly cookie
- `apps/web/src/app/api/auth/magic-link/request/route.ts` — Magic-link request; rate-limit (3/hr), Resend delivery, MagicLink DB record
- `apps/web/src/app/api/auth/magic-link/callback/route.ts` — Magic-link callback; validates token, creates email-auth user, sets 24h trial expiry
- `apps/web/src/app/api/auth/logout/route.ts` — Logout; blacklists JWT jti in Redis
- `apps/web/src/app/api/auth/status/route.ts` — Auth status check endpoint
- `apps/web/src/app/api/auth/dev-login/route.ts` — Dev-only bypass login
- `packages/shared/src/server/auth.ts` — `issueJwt`, `verifyAuth`, `requireAuth`, `logoutAndBlacklist`, `validateMsisdn`
- `packages/shared/src/server/middleware.ts` — `withAuth` (JWT + email trial enforcement), `withCronAuth`
- `apps/web/src/components/ProfileCompletionModal.tsx` — Post-login profile completion popup (collects fullName, phone, DOB)

**API Routes:**
- `POST /api/auth/otp/request`
- `POST /api/auth/otp/verify`
- `POST /api/auth/magic-link/request`
- `GET  /api/auth/magic-link/callback`
- `POST /api/auth/logout`
- `GET  /api/auth/status`

**What's implemented:**
- BDApps OTP request + verify flow end-to-end
- MSISDN normalization to `tel:8801XXXXXXXXX`
- Rate limiting (3 OTP requests/min per MSISDN via Redis sliding window)
- Exponential backoff retry in `packages/shared/src/server/adapters/bdapps.ts`
- JWT issued as HttpOnly, Secure, SameSite=Lax cookie on success
- Redis blacklist on logout with TTL matching remaining JWT lifetime
- Email magic-link fallback via Resend with rate limiting (3/hr)
- 24-hour email trial window: `emailTrialExpiresAt` tracked on User record; `withAuth` enforces HTTP 402 after expiry
- `authMethod` (OTP | EMAIL) stored on User
- `ProfileCompletionModal` UI component exists and collects required fields

**What's missing:**
- The ProfileCompletionModal is not yet wired to a backend `POST /api/user/complete-profile` endpoint — completion writes are currently handled via Zustand store only, not persisted to DB
- The 60-second OTP resend cooldown is implemented in UI but not validated server-side (only the 3-per-minute rate limit exists)
- Profile completion status (`profileCompleted` field exists in schema) is not re-prompted on subsequent logins via server-side check

---

### FR-PROFILE — Multi-Profile Management
**Priority:** P0
**Status:** Done

**Files:**
- `apps/web/src/app/(main)/profiles/page.tsx` — Profile switcher UI
- `apps/web/src/app/api/profiles/route.ts` — `GET` (list), `POST` (create with 6-profile limit)
- `apps/web/src/app/api/profiles/[id]/route.ts` — `GET`, `PATCH` (rename), `DELETE` (cascade deletes all child records)
- `packages/shared/src/server/period-log-sync.ts` — Seed initial period log from profile `lastPeriodStart`
- `packages/shared/prisma/schema.prisma` — `Profile` model with `ProfileRelation` enum (SELF, WIFE, SISTER, MOTHER, DAUGHTER, GIRLFRIEND)
- `packages/shared/prisma/migrations/20260526235330_add_rls/migration.sql` — RLS policies on `period_logs`, `symptom_logs`, `profiles`

**API Routes:**
- `GET  /api/profiles`
- `POST /api/profiles`
- `GET  /api/profiles/[id]`
- `PATCH /api/profiles/[id]`
- `DELETE /api/profiles/[id]`

**What's implemented:**
- Up to 6 profiles per account enforced at API level
- All 6 relation types in enum
- `NotificationPreference` record auto-created on profile creation
- Ownership verified before all operations (`profile.userId !== user.id` check)
- RLS migration in place for PostgreSQL-level isolation
- Delete cascades `period_logs`, `symptom_logs`, `predictions`

**What's missing:** Complete

---

### FR-TRACK — Period Logging
**Priority:** P0
**Status:** Done

**Files:**
- `apps/web/src/app/api/tracking/period-logs/route.ts` — `GET` (list with profile ownership check), `POST` (create + enqueue `PREDICTION_RECALC` job)
- `apps/web/src/app/api/tracking/period-logs/[id]/route.ts` — `PATCH` (retroactive edit), `DELETE`
- `packages/shared/src/server/adapters/jobs.ts` — `enqueueJob` writes to `JobEvent` table; worker polls and processes
- `packages/shared/src/server/worker-process.ts` — Standalone worker; `PREDICTION_RECALC` triggers `recalculatePrediction`
- `packages/shared/src/server/period-log-sync.ts` — `ensurePeriodLogFromProfile` seeds logs from profile data

**API Routes:**
- `GET  /api/tracking/period-logs?profileId=`
- `POST /api/tracking/period-logs`
- `PATCH /api/tracking/period-logs/[id]`
- `DELETE /api/tracking/period-logs/[id]`

**What's implemented:**
- Period logs with start date, end date, flow intensity (LIGHT / MEDIUM / HEAVY)
- Retroactive edit supported via PATCH
- Prediction recalculation enqueued asynchronously on create/update
- Profile ownership enforced on all operations

**What's missing:** Complete

---

### FR-DASH — Cycle Dashboard
**Priority:** P0
**Status:** Done

**Files:**
- `apps/web/src/app/(main)/dashboard/page.tsx` — Dashboard UI
- `apps/web/src/app/api/tracking/dashboard/route.ts` — Computes current cycle day, phase, countdown, last-period summary, prediction data

**API Routes:**
- `GET /api/tracking/dashboard?profileId=`

**What's implemented:**
- Hero cycle day number
- Current phase (menstrual / follicular / ovulatory / luteal) computed from last period + prediction
- Countdown to next predicted period
- Last-period summary (start date, duration, flow intensity)
- Prediction confidence percentage
- Falls back to estimated values when no prediction record exists

**What's missing:** Complete

---

### FR-CAL — Monthly Calendar
**Priority:** P0
**Status:** Done

**Files:**
- `apps/web/src/app/(main)/calendar/page.tsx` — Calendar UI with month navigation
- `apps/web/src/app/api/tracking/calendar/route.ts` — Builds per-day calendar array; marks period (logged), fertile window, ovulation day, predicted future days

**API Routes:**
- `GET /api/tracking/calendar?profileId=&month=YYYY-MM`

**What's implemented:**
- Month-grid with colour-coded period (pink), fertile (teal), ovulation (accent) days
- Previous/next month navigation
- Actual period logs distinguished from predicted future period days
- Fertile window computed from prediction record (`fertileStart`/`fertileEnd` or ovulation ± 5 days)

**What's missing:** Complete

---

### FR-SYMP — Symptom Logging
**Priority:** P0
**Status:** In Progress

**Files:**
- `apps/web/src/app/(main)/symptoms/page.tsx` — Symptom UI (icon-tap selection)
- `apps/web/src/app/api/tracking/symptoms/route.ts` — `GET` (by profile + optional date), `POST` (create)
- `packages/shared/prisma/schema.prisma` — `SymptomLog` model with `SymptomCategory` enum (PHYSICAL, MOOD, DISCHARGE, LIFESTYLE)

**API Routes:**
- `GET  /api/tracking/symptoms?profileId=&date=`
- `POST /api/tracking/symptoms`

**What's implemented:**
- 4 categories (Physical, Mood, Discharge, Lifestyle) in schema and API
- Icon-based tap-to-select UI
- Date picker for logging on any date
- Profile ownership enforced

**What's missing:**
- `symptom_logs.value` field is **not encrypted** — `prisma-field-encryption` is not installed (absent from `packages/shared/package.json`). The field is stored as plaintext. This is a blocker for FR-ENC compliance (see FR-ENC below).
- PATCH/DELETE endpoints for symptom logs are not implemented (not in SRS scope but worth noting)

---

### FR-PRED — Three-Tier Prediction Engine
**Priority:** P0
**Status:** In Progress

**Files:**
- `packages/shared/src/server/worker-process.ts` — `recalculatePrediction` function; implements Tier 1 (simple average) and Tier 2 (weighted moving average, unlocks at 6+ cycles); upserts `Prediction` record
- `apps/web/src/app/api/predictions/route.ts` — `GET` returns prediction + tier explanation
- `packages/shared/src/utils/cycle-utils.ts` — `computePrediction`, `getPredictionTier`, `getConfidence` utilities
- `packages/shared/prisma/schema.prisma` — `Prediction` model with `PredictionTier` enum (AVERAGE, ARIMA, LSTM)

**API Routes:**
- `GET /api/predictions?profileId=`

**What's implemented:**
- Tier 1 (AVERAGE): simple average cycle length from history
- Tier 2 (ARIMA label): weighted moving average of last 6 cycles — upgrades automatically when `cycleLengths.length >= 6`
- Tier 3 (LSTM): schema enum value exists, not computed (stub as required by SRS)
- Outputs: `nextPeriodStart`, `ovulationDay`, `fertileStart`, `fertileEnd`, `confidence`
- Confidence increases with more data (capped at 0.95)
- Asynchronous recalculation via `JobEvent` worker

**What's missing:**
- The Tier 2 implementation is a weighted moving average, not a true ARIMA model. SRS acknowledges ARIMA is the target; current implementation is a reasonable approximation for v1.
- No "updating" UI state shown while recalculation job is in flight
- LSTM is a stub as required — no additional action needed

---

### FR-ONBOARD — Onboarding Flow
**Priority:** P0
**Status:** In Progress

**Files:**
- `apps/web/src/app/onboarding/page.tsx` — 5-step onboarding UI: Welcome (trust/privacy), Goal, Profile setup, Cycle history, Done

**What's implemented:**
- Trust/privacy screen (Step 1) with encryption messaging
- Goal selection: period tracking, trying to conceive, perimenopause (Step 2)
- Profile name + relation picker (Step 3)
- Cycle length stepper (21–45 days), period length stepper (1–10 days), last period date picker (Step 4)
- Summary screen + "Get Started" submission (Step 5)
- Calls `addProfile` from Zustand store which hits `POST /api/profiles`
- Seeds Tier 1 prediction from onboarding data
- Skippable (user can proceed without completing every step)

**What's missing:**
- The onboarding is client-side driven through Zustand. If a user refreshes mid-onboarding, state is lost. No server-side onboarding progress tracking.
- Onboarding redirects to `/dashboard` after completion — no post-onboarding prediction display verified E2E in automated tests

---

### FR-BILL — Pro Subscription via BDApps CAAS
**Priority:** P0
**Status:** In Progress

**Files:**
- `apps/web/src/app/(main)/subscription/page.tsx` — Subscription upgrade UI
- `apps/web/src/app/api/billing/subscribe/route.ts` — `POST`: calls `caasDirectDebit`, upserts `Subscription` record, creates `CaasTransaction`, updates user's `subscriptionStatus = PRO`
- `apps/web/src/app/api/cron/caas-check/route.ts` — Daily CAAS balance check: queries all PRO subscriptions, resets `consecutiveFailures` on success, increments on failure, sets `LAPSED` at 3 failures
- `packages/shared/src/server/adapters/bdapps.ts` — `caasDirectDebit`, `caasGetBalance`
- `packages/shared/prisma/schema.prisma` — `Subscription`, `CaasTransaction` models; `consecutiveFailures`, `gracePeriodEndsAt` fields

**API Routes:**
- `POST /api/billing/subscribe`
- `POST /api/cron/caas-check` (cron-protected)

**What's implemented:**
- CAAS direct-debit call with unique `externalTrxId` (UUID) for idempotency
- Subscription record created/updated on success
- `CaasTransaction` audit record created
- `subscriptionStatus` on User updated to PRO
- Daily CAAS balance cron: checks all PRO subscribers, increments failure counter, marks LAPSED at ≥3 consecutive failures (note: grace-period flow itself is deferred to v2)

**What's missing:**
- Grace-period countdown / warning notifications — deferred to v2 per SRS
- Auto-disable Pro and final revocation email at grace-period expiry — deferred to v2
- Grace-period warning messaging to user — deferred to v2

---

### FR-GATE — Feature Gating (Email Trial + Subscription Schema)
**Priority:** P0
**Status:** Done

**Files:**
- `packages/shared/prisma/schema.prisma` — `SubscriptionStatus` enum (FREE, PRO, LAPSED) on `User.subscriptionStatus`; `emailTrialExpiresAt`, `authMethod` fields
- `packages/shared/src/server/middleware.ts` — `withAuth` enforces HTTP 402 when `authMethod === EMAIL` and trial has expired
- `packages/shared/prisma/migrations/20260526235248_init/migration.sql` — Schema migration creating all gating columns

**What's implemented:**
- `subscription_status` column with default FREE
- `auth_method` (OTP | EMAIL) tracked on User
- `email_trial_expires_at` set to now + 24h on magic-link callback
- Email trial enforcement active in `withAuth` — expired EMAIL users receive HTTP 402
- OTP-authenticated users are never gated
- Pro/free feature gating deferred per SRS — no routes return 403 based on subscriptionStatus alone

**What's missing:** Complete (gating for pro/free is intentionally deferred to post-v1 per SRS)

---

### FR-I18N — Bilingual UI (English + Bengali)
**Priority:** P0
**Status:** In Progress

**Files:**
- `packages/shared/src/utils/i18n.ts` — i18next initialization with full EN and BN translation namespaces; uses `localStorage` + navigator for language detection
- `apps/web/src/components/ui/LanguageToggle.tsx` — Language toggle component available on all screens
- `apps/web/src/app/layout.tsx` — Root layout (Noto Sans Bengali font loading to verify)

**What's implemented:**
- Full EN and BN translation keys covering: auth, onboarding, dashboard, calendar, symptoms, content, feedback, subscription, settings, profiles, common
- i18next + react-i18next initialized with language detection from localStorage
- Language toggle UI component
- Bengali strings implemented for all major user-facing screens

**What's missing:**
- Noto Sans Bengali font is not confirmed loaded in `apps/web/src/app/layout.tsx` — requires verification
- No automated layout regression tests at 375px in BN mode
- Email notification templates in Bengali — `packages/shared/src/server/email-templates.ts` needs verification for BN language branch
- Language preference persisted only in localStorage, not synced to User.language column in DB (column exists in schema but sync not verified)

---

### FR-ENC — Field-Level Encryption
**Priority:** P0
**Status:** Not Started

**Files:**
- `packages/shared/prisma/schema.prisma` — `SymptomLog.value` field exists but has **no `@encrypted` annotation**
- `packages/shared/package.json` — `prisma-field-encryption` is **not listed as a dependency**

**API Routes:** N/A (transparent via Prisma)

**What's implemented:**
- Schema field `SymptomLog.value` (String) exists

**What's missing:**
- `prisma-field-encryption` package is not installed
- No `@encrypted` annotation on `symptom_logs.value` or health notes fields
- No encryption key environment variable configured (`PRISMA_FIELD_ENCRYPTION_KEY` or equivalent)
- A direct SQL query currently returns plaintext — CI round-trip test does not exist
- **This is a P0 blocker for the DoD security gate**

---

### FR-SESSION — Session Store & JWT Blacklist
**Priority:** P0
**Status:** Done

**Files:**
- `packages/shared/src/server/adapters/redis.ts` — `blacklistJti` (SET with EX TTL), `isJtiBlacklisted`, `checkRateLimit` (sliding-window via sorted set)
- `packages/shared/src/server/auth.ts` — `logoutAndBlacklist` reads JWT, extracts `jti` + `exp`, calls `blacklistJti` with remaining TTL; `verifyAuth` checks blacklist on every request
- `apps/web/src/app/api/auth/logout/route.ts` — Logout handler

**What's implemented:**
- JWT issued with `jti` (UUID) claim
- Blacklist entry TTL = remaining JWT lifetime (no permanent growth)
- Auth middleware rejects blacklisted `jti` before expiry
- Sliding-window rate limiter for OTP requests (3/min) and magic-link (3/hr)
- Redis key: `blacklist:{jti}`

**What's missing:** Complete

---

### FR-NOTIF — Email Notifications & Per-Profile Preferences
**Priority:** P1
**Status:** In Progress

**Files:**
- `apps/web/src/app/api/cron/daily-reminders/route.ts` — Daily cron: evaluates all profiles, dispatches period alerts (0–2 days out), fertile alerts (starts today), logging reminders (3+ days no log)
- `packages/shared/src/server/adapters/notifications.ts` — `sendPeriodAlert`, `sendFertileAlert`, `sendLoggingReminder` — sends email via Resend; SMS for PRO subscribers via `smsSend`
- `packages/shared/src/server/email-templates.ts` — HTML email templates
- `packages/shared/src/server/adapters/mail.ts` — Resend client wrapper
- `packages/shared/prisma/schema.prisma` — `NotificationPreference` model (periodAlert, fertileWindow, loggingReminder toggles per profile)

**API Routes:**
- `POST /api/cron/daily-reminders` (cron-protected, 08:00 UTC)

**What's implemented:**
- All three notification types implemented
- Per-profile preference flags respected
- Resend integration (null-safe in dev when `RESEND_API_KEY` absent)
- PRO subscriber SMS alerts dispatched in same cron run (period + fertile window)
- Language-aware: uses `user.language` (EN/BN) to select email template

**What's missing:**
- QStash integration not confirmed — current implementation calls `sendPeriodAlert` synchronously inside the cron handler rather than dispatching to a QStash worker. For large user bases this could exceed the 10s Vercel timeout.
- Failed Resend delivery logging for admin review not implemented
- Bengali email template bodies need content verification

---

### FR-CONTENT — Bilingual Content Platform
**Priority:** P1
**Status:** In Progress

**Files:**
- `apps/web/src/app/(main)/content/page.tsx` — Article list with phase-tab filter, expanded article modal with locale fallback indicator, reading progress bar
- `apps/web/src/lib/dummy-data.ts` — `DEMO_ARTICLES` array (hardcoded articles for dev)

**What's implemented:**
- Article list UI with phase filtering (for-you, menstrual, follicular, ovulation, luteal, all)
- Bilingual article display: renders `titleEn`/`bodyEn` or `titleBn`/`bodyBn`; falls back to English with "Bengali translation coming soon" banner
- Phase tags and category badges
- Reading progress bar and estimated reading time in expanded view
- Language toggle switches article body without page reload

**What's missing:**
- **No articles API route** (`/api/content/articles`) or database-backed content — articles are served from `dummy-data.ts` only
- No `Article` model in Prisma schema — content platform has no persistent storage
- No admin-side article publishing to drive the reader feed
- Phase-based surfacing is client-side only (no server-driven personalization)

---

### FR-ADMIN — Admin Dashboard, User & Subscription Management
**Priority:** P2
**Status:** Not Started

**Files:** None

**API Routes:** None

**What's implemented:**
- `Role` enum (USER, ADMIN) exists in schema; `User.role` field defaults to USER
- Admin route middleware pattern exists in `withAuth`

**What's missing:**
- No `/admin/*` route tree
- No Super Admin login screen or separate short-lived JWT flow
- No admin authentication middleware enforcing `role === ADMIN` on `/admin/*` routes
- No KPI dashboard
- No user management (list, search, suspend, soft-delete)
- No subscription management views (Pro subscribers, CAAS results, manual revoke/re-grant)

---

### FR-CMS — Content CMS (Tiptap)
**Priority:** P2
**Status:** Not Started

**Files:** None

**What's implemented:** Nothing

**What's missing:**
- No Tiptap editor integration
- No Article model in database (required for CMS)
- No draft/publish lifecycle
- No bilingual side-by-side editor
- No image upload to Supabase storage
- No HTML sanitization for article content

---

### FR-ANALYTICS — Population Analytics & Prediction Accuracy
**Priority:** P2
**Status:** Not Started

**Files:** None

**What's implemented:** Nothing

**What's missing:**
- No analytics API routes
- No Recharts population health charts
- No prediction-accuracy (MAE) nightly report
- No admin-only analytics endpoints
- No anonymization layer for symptom data queries

---

### FR-EXPORT — Data Export (CSV / Excel)
**Priority:** P2
**Status:** In Progress

**Files:**
- `apps/web/src/app/(main)/settings/page.tsx` — Export CSV and Export Excel buttons exist in the Data Export section

**API Routes:** None

**What's implemented:**
- Export button UI with CSV and Excel options visible in Settings
- Toast notification fires on click ("CSV download started" / "Excel download started")

**What's missing:**
- No `/api/export` backend route
- No actual file generation (no `papaparse`, `xlsx`, or equivalent library installed)
- No per-profile data query and download logic
- No decryption of symptom values before export
- No cross-profile export option
- Buttons are UI stubs only — no file is produced

---

### FR-SMS — SMS Notifications & Content Circulation
**Priority:** P1
**Status:** In Progress

**Files:**
- `packages/shared/src/server/adapters/bdapps.ts` — `smsSend(message, destinationAddresses, deliveryStatusRequest)` implemented
- `packages/shared/src/server/adapters/notifications.ts` — PRO-only SMS period and fertile-window alerts dispatched from `sendPeriodAlert` and `sendFertileAlert`
- `apps/web/src/app/api/cron/daily-reminders/route.ts` — `isProSubscriber` check gates SMS dispatch

**API Routes:**
- `smsSend` is called internally; no dedicated admin SMS broadcast API route yet

**What's implemented:**
- BDApps `sms/send` adapter implemented (`destinationAddresses` supports `["tel:all"]`)
- PRO subscriber SMS period alerts and fertile window alerts wired into daily cron
- PRO gating: `isProSubscriber` check prevents SMS to free-tier users
- `deliveryStatusRequest: 1` passed by default for delivery reports

**What's missing:**
- No admin SMS content management UI or API (`POST /api/admin/sms/messages`)
- No daily SMS content queue (scheduled message from a pool)
- No `tel:all` broadcast integration — broadcast is not called from the cron (only per-user SMS)
- No CSV/bulk-upload interface for admin to create SMS content batches
- No SMS send history view in admin panel
- Content override logic (deactivating previous day's content) not implemented — no content model exists

---

### FR-WEBHOOK — BDApps Inbound Webhooks
**Priority:** P0
**Status:** Done

**Files:**
- `apps/web/src/app/api/webhooks/sms/receive/route.ts` — Inbound SMS; IP validation, persists `SMS_RECEIVE` event
- `apps/web/src/app/api/webhooks/sms/report/route.ts` — SMS delivery report; persists `SMS_REPORT` event
- `apps/web/src/app/api/webhooks/ussd/receive/route.ts` — USSD events; persists `USSD_RECEIVE` event
- `apps/web/src/app/api/webhooks/subscription/notify/route.ts` — Subscription status changes; persists `SUBSCRIPTION_NOTIFY`, maps BDApps status → PRO/LAPSED, updates `User.subscriptionStatus` and `Subscription.status`
- `packages/shared/src/server/adapters/webhooks.ts` — `validateWebhookSource` (IP whitelist via `BDAPPS_WEBHOOK_IPS` env), `persistWebhookEvent` (idempotency by key)
- `packages/shared/prisma/schema.prisma` — `WebhookEvent` model with `idempotencyKey @unique`

**API Routes:**
- `POST /api/webhooks/sms/receive`
- `POST /api/webhooks/sms/report`
- `POST /api/webhooks/ussd/receive`
- `POST /api/webhooks/subscription/notify`

**What's implemented:**
- All four required webhook endpoints present
- IP whitelist validation (permissive when `BDAPPS_WEBHOOK_IPS` not set; enforced in production)
- Idempotency: duplicate `idempotencyKey` returns 200 without reprocessing
- `subscription/notify` updates subscription status bidirectionally (ACTIVE→PRO, INACTIVE/SUSPENDED/EXPIRED→LAPSED)
- HTTP 200 responses within handler (fast, non-blocking)

**What's missing:**
- SMS delivery report does not update a specific broadcast message record (no `SmsBroadcastMessage` model exists); the webhook persists the event but no status update propagates to an admin view

---

### FR-FEEDBACK — In-App Feedback Module
**Priority:** P1
**Status:** In Progress

**Files:**
- `apps/web/src/app/(main)/feedback/page.tsx` — Full feedback form UI: 4 categories (Bug, Feature, General, Satisfaction), 1–5 star rating, 500-char message, submission history view
- `packages/shared/prisma/schema.prisma` — `Feedback` model with `id`, `userId`, `profileId`, `category`, `message`, `rating`, `createdAt`

**API Routes:** None currently wired

**What's implemented:**
- Full feedback form UI with animations, star rating, character counter
- 4 SRS-required categories implemented
- Submission history display (filtered to current user)
- `Feedback` DB model matches SRS schema exactly

**What's missing:**
- **No `/api/feedback` route** — submission is currently handled via Zustand store only (`submitFeedback` in `useAppStore`), not persisted to database
- No admin panel view for feedback (FR-ADMIN not started)
- No feedback CSV export endpoint
- Once FR-ADMIN is built, feedback filter by category/date/rating needs to be added

---

## Schema Coverage Summary

| Model | Status | Notes |
|-------|--------|-------|
| `User` | Done | All required fields: `authMethod`, `subscriptionStatus`, `emailTrialExpiresAt`, `profileCompleted`, `role`, `language` |
| `Profile` | Done | All 6 relations, `cycleLength`, `periodLength`, `lastPeriodStart`, `goal` |
| `PeriodLog` | Done | `startDate`, `endDate`, `flowIntensity` (LIGHT/MEDIUM/HEAVY) |
| `SymptomLog` | Partial | Schema present; `value` field **not encrypted** |
| `Prediction` | Done | All output fields + `PredictionTier` (AVERAGE/ARIMA/LSTM) |
| `Subscription` | Done | `consecutiveFailures`, `gracePeriodEndsAt` for v2 grace-period |
| `CaasTransaction` | Done | Idempotent `externalTrxId @unique` |
| `OtpChallenge` | Done | `referenceNo`, `expiresAt`, `verified` |
| `MagicLink` | Done | `token @unique`, `expiresAt`, `used` |
| `WebhookEvent` | Done | `idempotencyKey @unique`, `WebhookType` enum |
| `JobEvent` | Done | `JobStatus` enum, `PREDICTION_RECALC` + `SMS_BROADCAST` job types |
| `NotificationPreference` | Done | 3 toggle flags per profile |
| `Feedback` | Done | Schema matches SRS; no API yet |
| `Article` | **Missing** | No model in schema — required for FR-CONTENT and FR-CMS |
| `SmsBroadcastMessage` | **Missing** | No model — required for FR-SMS admin content queue |

---

## P0 Blockers

1. **FR-ENC**: `prisma-field-encryption` not installed; `symptom_logs.value` stored as plaintext. Blocks the DoD security gate.
2. **FR-CONTENT / FR-CMS**: No `Article` model in schema. Content platform has no persistent storage and no admin publishing capability.
3. **FR-AUTH (partial)**: `ProfileCompletionModal` not wired to a backend persistence endpoint.

## P1/P2 Gaps

- `FR-ADMIN`: Entire admin panel (`/admin/*` routes) is not started.
- `FR-EXPORT`: Buttons are UI stubs; no file generation logic.
- `FR-FEEDBACK`: No API route; submissions not persisted to DB.
- `FR-SMS`: Admin content queue, `tel:all` broadcast scheduling, and send history are not implemented.
- `FR-ANALYTICS`: Not started.
- `FR-CMS`: Not started.
