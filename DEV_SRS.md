# DEV_SRS — Implementation Tracker

> Developer-facing tracker mapping SRS requirements to codebase implementation.
> Last updated: 2026-05-31 (rev 3)
> SRS version: 1.2 (SRS-VESTA-001)
> Related: [`TESTING.md`](TESTING.md) — manual QA guide for testers

---

## Quick Status

| Status | Count | FR IDs |
|--------|-------|--------|
| Done / Implemented | 11 | FR-PROFILE, FR-TRACK, FR-DASH, FR-CAL, FR-GATE, FR-SESSION, FR-CONTENT, FR-ADMIN, FR-CMS, FR-ANALYTICS, FR-WEBHOOK |
| In Progress | 9 | FR-AUTH, FR-SYMP, FR-PRED, FR-ONBOARD, FR-BILL, FR-I18N, FR-NOTIF, FR-SMS, FR-FEEDBACK |
| Partial (usable, gaps remain) | 1 | FR-EXPORT |
| Not Started | 1 | FR-ENC |

**Rev 3 changes (2026-05-31):** Live codebase audit of `apps/web` (18 user routes, 38 API handlers) and `apps/admin` (16 page routes, 10 query modules, 8 action modules). Corrected FR-AUTH (modal wired), FR-SMS (`tel:all` via `sms-service`), FR-EXPORT (CSV Server Action live). Documented admin Emails + Audit Logs sections and operational endpoints (health checks, simulator, Resend webhook).

---

## Architecture Notes

The app uses a **RSC + Server Actions** pattern throughout:

- **Pages** are Server Components (`page.tsx`) that fetch data server-side using cached queries.
- **Client islands** (`*Client.tsx` files) handle interactivity; co-located with their page.
- **Server Actions** (`apps/web/src/app/actions/`) handle all mutations (`'use server'` functions).
- **Cached queries** (`apps/web/src/app/queries/`) use React `cache()` for request-level deduplication.
- **Zustand store** (`apps/web/src/lib/store.ts`) holds UI-only state: theme, language, `activeProfileId`, `onboardingComplete`. All DB state removed.
- **`next/font/google`** self-hosts Manrope + Noto Sans Bengali — no render-blocking external font requests.
- **`proxy.ts`** (`apps/web/src/proxy.ts`) performs server-side auth redirect via cookie presence check (renamed from `middleware.ts` for Next.js 16 compatibility).
- Route conventions in use: `loading.tsx`, `error.tsx`, `not-found.tsx`.
- Deleted files (no longer in codebase): `api.ts` (client API wrapper), `api-mappers.ts`, `dummy-data.ts`, `hydrate-store.ts`. All data now comes from the DB.

### Shared Services Layer

All Prisma queries and business logic are centralised in `packages/shared/src/server/services/` (11 service modules). Both `apps/web/` and `apps/admin/` consume these modules through thin wrappers that handle auth, validation, caching, and Next.js-specific concerns.

| Service module | Responsibility |
|---|---|
| `profile-service` | Profile CRUD, 6-profile limit enforcement, ownership checks |
| `tracking-service` | Period log and symptom log queries and mutations |
| `content-service` | Article and category CRUD, draft/publish lifecycle |
| `feedback-service` | Feedback submission and filtered listing |
| `notification-service` | Email/SMS dispatch and per-profile preference evaluation |
| `user-service` | User lookup, profile-completion, suspend/reactivate/soft-delete |
| `subscription-service` | Pro grant/revoke, CAAS balance checks, admin overrides |
| `audit-service` | Admin action audit trail (AdminAuditLog writes) |
| `analytics-service` | Population health aggregations, prediction accuracy, retention |
| `sms-service` | SMS broadcast CRUD, scheduling, and send history |
| `export-service` | CSV generation for feedback and user data |

A barrel file at `packages/shared/src/server/services/index.ts` re-exports all service modules. Total: 11 service modules across ~7,115 lines of source (admin app: 63 source files).

### UI/Accessibility Review Status

Both apps have been audited against the [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines) (2026-05-30). Full file-by-file findings with line numbers are in:
- `review/WEB-UI-REVIEW.md` — web app: ~100 findings
- `review/ADMIN-UI-REVIEW.md` — admin app: ~90 findings
- `review/FIX-PLAN.md` — architecture migration plan

Top systemic issues (both apps): `transition-all` anti-pattern (~55 instances), missing `focus-visible:ring-*` on buttons (~45), decorative icons missing `aria-hidden="true"` (~45), form inputs without linked `<label>` (~13), missing `prefers-reduced-motion` handling, missing `color-scheme: dark`.

---

## Test Coverage

- **Web app**: 22/22 Vitest tests passing across 5 test files located at `apps/web/__tests__/actions/`. Tests updated to reflect the shared services layer (mocks target service modules, not direct Prisma calls). Covers all Server Actions with deterministic mocks (Prisma, Redis, BDApps). Run with `just test` or `pnpm --filter @vesta/web backend:test`.
- **Admin app**: TypeScript typecheck passes (`just typecheck-all`). No automated test suite yet — manual QA only.
- **Manual QA**: See [`TESTING.md`](TESTING.md) for environment setup, test accounts, and per-FR scenarios.

### Web App Route Inventory (rev 3)

| Area | Routes |
|------|--------|
| Auth | `/login`, `/verify-otp`, `/email-login` |
| Onboarding | `/onboarding` |
| Main app | `/dashboard`, `/calendar`, `/symptoms`, `/content`, `/settings`, `/profiles`, `/feedback`, `/subscription` |
| Legal | `/privacy`, `/terms` |
| Internal (dev) | `/internal/backend-checklist`, `/internal/simulator-check`, `/internal/dependency-graph` |

**API handlers:** 38 under `apps/web/src/app/api/` (auth, profiles, tracking, predictions, billing, webhooks, cron, health, simulator-check).

### Admin App Route Inventory (rev 3)

| Area | Routes |
|------|--------|
| Auth | `/login` |
| Core (SRS) | `/`, `/users`, `/users/[id]`, `/subscriptions`, `/content`, `/content/new`, `/content/[id]`, `/analytics`, `/sms`, `/feedback`, `/feedback/[id]` |
| Beyond SRS | `/emails`, `/emails/[id]`, `/emails/preview`, `/audit-logs` |

**Admin surface:** 15 `*Client.tsx` components, 10 query modules, 8 global action modules (+ colocated email preview action).

---

## Open Items by Priority

### P0 — Blockers (DoD / security gate)

| ID | Item | File / note |
|----|------|-------------|
| FR-ENC | `prisma-field-encryption` not installed; `symptom_logs.value` stored as plaintext | `packages/shared/package.json`, `schema.prisma` |
| FR-AUTH | Profile completion: modal wired to `completeProfile`, but only shown for `authMethod === EMAIL` + `profileCompleted === false`; SRS expects ~1 min post-OTP for all incomplete users; dismiss uses `sessionStorage` (not re-prompt on next login) | `(main)/layout.tsx`, `ProfileCompletionModal.tsx` |

### P1 — Should-have gaps

| ID | Item | File / note |
|----|------|-------------|
| FR-NOTIF | QStash not confirmed; cron runs email/SMS synchronously (Vercel 10s risk at scale); Resend webhook at `/api/webhooks/resend` not tied to admin delivery UI | `api/cron/daily-reminders/route.ts` |
| FR-SYMP | Symptom `value` not encrypted (blocked by FR-ENC) | `tracking-service` |
| FR-SMS | Admin broadcast send uses `tel:all` in `sms-service`; no CSV bulk-upload; no content-override (deactivate previous day) | `sms-service.ts` L114 |
| FR-FEEDBACK | Admin read-only + CSV; no reply/resolve workflow | `FeedbackDetailClient.tsx` |
| FR-I18N | `User.language` DB sync unverified; BN email template bodies need content QA | `i18n.ts`, `email-templates.ts` |

### P2 — Could-have / polish

| ID | Item | File / note |
|----|------|-------------|
| FR-EXPORT | CSV export via `exportUserDataCsv` Server Action works; no `/api/export` route; Excel button downloads CSV; UI copy says "active profile only" but export includes all profiles; symptom values plaintext until FR-ENC | `settings-actions.ts`, `SettingsClient.tsx` |
| FR-CMS | Tiptap image upload to Supabase not wired | `TiptapEditor.tsx` |
| FR-ANALYTICS | Nightly MAE cron not scheduled; on-demand admin page load only | `analytics-service.ts` |
| FR-ADMIN | No automated admin test suite; subscription list has no detail route | `apps/admin/` |
| UI/A11y | ~190 findings in `review/WEB-UI-REVIEW.md`, `review/ADMIN-UI-REVIEW.md` | Both apps |

### Operational (not SRS FRs, useful for QA)

| Endpoint / page | Purpose |
|-----------------|---------|
| `GET /api/health/db`, `redis`, `bdapps`, `mailpit`, `worker` | Infra readiness |
| `/internal/simulator-check` + `/api/simulator-check/*` | BDApps OTP/CAAS/SMS/USSD without real Robi network |
| `POST /api/webhooks/resend` | Resend delivery events (inbound) |

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
- `apps/web/src/app/api/auth/otp/verify/route.ts` — OTP verify endpoint; upserts User, issues JWT in HttpOnly cookie; rate-limited (max 5 attempts per referenceNo)
- `apps/web/src/app/api/auth/magic-link/request/route.ts` — Magic-link request; rate-limit (3/hr), Resend delivery, MagicLink DB record
- `apps/web/src/app/api/auth/magic-link/callback/route.ts` — Magic-link callback; validates token, creates email-auth user, sets 24h trial expiry on first login only
- `apps/web/src/app/api/auth/logout/route.ts` — Logout; blacklists JWT jti in Redis
- `apps/web/src/app/api/auth/status/route.ts` — Auth status check endpoint
- `apps/web/src/app/api/auth/dev-login/route.ts` — Dev-only bypass login (guarded with `notFound()` in production)
- `packages/shared/src/server/auth.ts` — `issueJwt`, `verifyAuth`, `requireAuth`, `requireAdminAuth`, `withAdminAuth`, `getAuthUser`, `logoutAndBlacklist`, `validateMsisdn`
- `packages/shared/src/server/middleware.ts` — `withAuth` (JWT + email trial enforcement), `withCronAuth`
- `apps/web/src/components/ProfileCompletionModal.tsx` — Post-login profile completion modal (fullName, phone); calls `completeProfile` Server Action
- `apps/web/src/app/(main)/layout.tsx` — Mounts `ProfileCompletionModal`; opens when `/api/auth/status` returns `profileCompleted === false` and `authMethod === 'EMAIL'`
- `apps/web/src/app/actions/user-actions.ts` — `completeProfile` Server Action; persists `fullName`, `phone`, `profileCompleted=true` to DB
- `apps/web/src/app/queries/auth-queries.ts` — Cached auth-related RSC queries
- `apps/web/src/proxy.ts` — Next.js 16 proxy (renamed from middleware.ts); server-side auth redirect via cookie presence check

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
- OTP verify attempt rate limiting (max 5 attempts per referenceNo)
- Exponential backoff retry in `packages/shared/src/server/adapters/bdapps.ts`
- JWT issued as HttpOnly, Secure, SameSite=Lax cookie on success
- Redis blacklist on logout with TTL matching remaining JWT lifetime
- Email magic-link fallback via Resend with rate limiting (3/hr)
- 24-hour email trial window: `emailTrialExpiresAt` tracked on User record; `withAuth` enforces HTTP 402 after expiry; trial set only on user creation (not reset on every login)
- `authMethod` (OTP | EMAIL) stored on User
- `ProfileCompletionModal` mounted in main layout; submits via `completeProfile` Server Action
- Modal shown for email-auth users with incomplete profile (fetched from `/api/auth/status`)
- Auth pages converted: all `useDummyData` branches removed, direct fetch to auth API routes
- `proxy.ts` added for server-side auth redirect (Next.js 16 convention)

**Shared auth enhancements (added for admin panel):**
- `requireAdminAuth()` — validates JWT and enforces `role === ADMIN`; throws 403 if role check fails
- `withAdminAuth()` — route handler wrapper that calls `requireAdminAuth()` before delegating to the handler
- `getAuthUser()` — now additionally checks `suspendedAt` and `deletedAt`; suspended or soft-deleted users receive HTTP 403

**What's missing:**
- SRS expects profile-completion nudge ~1 min after **OTP** login; current trigger is **email users only** (`authMethod === 'EMAIL'`), not OTP
- Dismissal stored in `sessionStorage` (`vesta_profile_modal_dismissed`) — does not re-prompt on next login per SRS
- The 60-second OTP resend cooldown is implemented in UI but not validated server-side (only the 3-per-minute rate limit exists)
- DOB not collected in modal (SRS mentions "required profile details" — only fullName + phone implemented)

---

### FR-PROFILE — Multi-Profile Management
**Priority:** P0
**Status:** Done

**Files:**
- `apps/web/src/app/(main)/profiles/page.tsx` — Profile switcher RSC
- `apps/web/src/app/(main)/profiles/ProfilesClient.tsx` — Client island for profile interactions
- `apps/web/src/app/actions/profile-actions.ts` — `createProfile`, `renameProfile`, `deleteProfile` Server Actions
- `apps/web/src/app/queries/profile-queries.ts` — `getProfiles`, `getProfile` cached RSC queries
- `apps/web/src/app/api/profiles/route.ts` — Legacy `GET` / `POST` API routes (superseded by Server Actions)
- `apps/web/src/app/api/profiles/[id]/route.ts` — Legacy `GET` / `PATCH` / `DELETE` API routes (superseded by Server Actions)
- `packages/shared/src/server/period-log-sync.ts` — Seed initial period log from profile `lastPeriodStart`
- `packages/shared/prisma/schema.prisma` — `Profile` model with `ProfileRelation` enum (SELF, WIFE, SISTER, MOTHER, DAUGHTER, GIRLFRIEND)
- `packages/shared/prisma/migrations/20260526235330_add_rls/migration.sql` — RLS policies on `period_logs`, `symptom_logs`, `profiles`

**API Routes:**
- `GET  /api/profiles` (legacy)
- `POST /api/profiles` (legacy)
- `GET  /api/profiles/[id]` (legacy)
- `PATCH /api/profiles/[id]` (legacy)
- `DELETE /api/profiles/[id]` (legacy)

**What's implemented:**
- Up to 6 profiles per account enforced at API level
- All 6 relation types in enum
- `NotificationPreference` record auto-created on profile creation
- Ownership verified before all operations (`profile.userId !== user.id` check)
- RLS migration in place for PostgreSQL-level isolation
- Delete cascades `period_logs`, `symptom_logs`, `predictions`
- Profile rename implemented via `renameProfile` Server Action

**What's missing:**
- Profile count TOCTOU race still exists — no DB-level `UNIQUE` or advisory-lock constraint; concurrent creates could exceed the 6-profile limit

---

### FR-TRACK — Period Logging
**Priority:** P0
**Status:** Done

**Files:**
- `apps/web/src/app/actions/tracking-actions.ts` — `createPeriodLog`, `updatePeriodLog`, `deletePeriodLog` Server Actions; includes `endDate >= startDate` validation
- `apps/web/src/app/queries/tracking-queries.ts` — `getDashboardData`, `getCalendarData`, `getPeriodLogs` cached RSC queries
- `apps/web/src/app/api/tracking/period-logs/route.ts` — Legacy `GET` / `POST` API routes (superseded by Server Actions)
- `apps/web/src/app/api/tracking/period-logs/[id]/route.ts` — Legacy `PATCH` / `DELETE` API routes (superseded by Server Actions)
- `packages/shared/src/server/adapters/jobs.ts` — `enqueueJob` writes to `JobEvent` table; worker polls and processes
- `packages/shared/src/server/worker-process.ts` — Standalone worker; `PREDICTION_RECALC` triggers `recalculatePrediction`
- `packages/shared/src/server/period-log-sync.ts` — `ensurePeriodLogFromProfile` seeds logs from profile data

**API Routes:**
- `GET  /api/tracking/period-logs?profileId=` (legacy)
- `POST /api/tracking/period-logs` (legacy)
- `PATCH /api/tracking/period-logs/[id]` (legacy)
- `DELETE /api/tracking/period-logs/[id]` (legacy)

**What's implemented:**
- Period logs with start date, end date, flow intensity (LIGHT / MEDIUM / HEAVY)
- `endDate >= startDate` validation in `createPeriodLog` Server Action
- Retroactive edit supported via `updatePeriodLog` Server Action
- Prediction recalculation enqueued asynchronously on create/update
- Profile ownership enforced on all operations

**What's missing:** Complete

---

### FR-DASH — Cycle Dashboard
**Priority:** P0
**Status:** Done

**Files:**
- `apps/web/src/app/(main)/dashboard/page.tsx` — Dashboard RSC; fetches data server-side
- `apps/web/src/app/(main)/dashboard/DashboardClient.tsx` — Client island for interactive dashboard elements
- `apps/web/src/app/queries/tracking-queries.ts` — `getDashboardData(profileId)` cached query
- `apps/web/src/app/api/tracking/dashboard/route.ts` — Legacy API route (superseded by RSC query)

**Route params:**
- Profile switching via `?profileId=xxx` searchParam (server re-render, no client fetch)

**What's implemented:**
- Hero cycle day number
- Current phase (menstrual / follicular / ovulatory / luteal) computed from last period + prediction
- Countdown to next predicted period
- Last-period summary (start date, duration, flow intensity)
- Prediction confidence percentage
- Falls back to estimated values when no prediction record exists
- All data fetched server-side — no client API calls

**What's missing:** Complete

---

### FR-CAL — Monthly Calendar
**Priority:** P0
**Status:** Done

**Files:**
- `apps/web/src/app/(main)/calendar/page.tsx` — Calendar RSC; fetches data server-side
- `apps/web/src/app/(main)/calendar/CalendarClient.tsx` — Client island for month navigation and day selection
- `apps/web/src/app/queries/tracking-queries.ts` — `getCalendarData(profileId, month)` cached query
- `apps/web/src/app/api/tracking/calendar/route.ts` — Legacy API route (superseded by RSC query)

**Route params:**
- Month navigation via `?month=YYYY-MM` searchParam (server re-render)

**What's implemented:**
- Month-grid with colour-coded period (pink), fertile (teal), ovulation (accent) days
- Previous/next month navigation
- Actual period logs distinguished from predicted future period days
- Fertile window computed from prediction record (`fertileStart`/`fertileEnd` or ovulation ± 5 days)
- All data fetched server-side — no client API calls

**What's missing:** Complete

---

### FR-SYMP — Symptom Logging
**Priority:** P0
**Status:** In Progress

**Files:**
- `apps/web/src/app/(main)/symptoms/page.tsx` — Symptoms RSC
- `apps/web/src/app/(main)/symptoms/SymptomsClient.tsx` — Client island for symptom tap-selection
- `apps/web/src/app/actions/tracking-actions.ts` — `toggleSymptom` Server Action
- `apps/web/src/app/queries/symptom-queries.ts` — `getSymptomLogs` cached RSC query
- `apps/web/src/lib/symptoms-data.ts` — Static symptom definitions: 32 symptoms, 4 categories, with Bengali translations
- `apps/web/src/app/api/tracking/symptoms/route.ts` — Legacy `GET` / `POST` API routes (superseded by Server Actions)
- `packages/shared/prisma/schema.prisma` — `SymptomLog` model with `SymptomCategory` enum (PHYSICAL, MOOD, DISCHARGE, LIFESTYLE)

**Route params:**
- Date selection via searchParams for server re-render

**API Routes:**
- `GET  /api/tracking/symptoms?profileId=&date=` (legacy)
- `POST /api/tracking/symptoms` (legacy)

**What's implemented:**
- 4 categories (Physical, Mood, Discharge, Lifestyle) in schema and Server Action
- 32 symptoms with Bengali translations defined in `symptoms-data.ts`
- Icon-based tap-to-select UI via `toggleSymptom` Server Action
- Date picker for logging on any date (searchParam-driven server re-render)
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
- `apps/web/src/app/queries/prediction-queries.ts` — `getPrediction` cached RSC query
- `apps/web/src/app/api/predictions/route.ts` — Legacy `GET` API route (superseded by RSC query)
- `packages/shared/src/utils/cycle-utils.ts` — `computePrediction`, `getPredictionTier`, `getConfidence` utilities
- `packages/shared/prisma/schema.prisma` — `Prediction` model with `PredictionTier` enum (AVERAGE, ARIMA, LSTM)

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
- `apps/web/src/app/onboarding/page.tsx` — 5-step onboarding UI: Welcome (trust/privacy), Goal, Profile setup, Cycle history, Done; includes LanguageToggle

**What's implemented:**
- Trust/privacy screen (Step 1) with encryption messaging
- Goal selection: period tracking, trying to conceive, perimenopause (Step 2)
- Profile name + relation picker (Step 3)
- Cycle length stepper (21–45 days), period length stepper (1–10 days), last period date picker (Step 4)
- Summary screen + "Get Started" submission (Step 5)
- Calls `createProfile` Server Action (Zustand `addProfile` removed)
- All dummy data branches removed — DB only
- Seeds Tier 1 prediction from onboarding data
- LanguageToggle included on onboarding screen
- Skippable (user can proceed without completing every step)

**What's missing:**
- If a user refreshes mid-onboarding, local step state is lost. No server-side onboarding progress tracking.
- Onboarding redirects to `/dashboard` after completion — no post-onboarding prediction display verified E2E in automated tests

---

### FR-BILL — Pro Subscription via BDApps CAAS
**Priority:** P0
**Status:** In Progress

**Files:**
- `apps/web/src/app/(main)/subscription/page.tsx` — Subscription RSC
- `apps/web/src/app/(main)/subscription/SubscriptionClient.tsx` — Client island for upgrade flow
- `apps/web/src/app/api/billing/subscribe/route.ts` — `POST`: creates `CaasTransaction` with PENDING status before CAAS call, calls `caasDirectDebit`, upserts `Subscription` record on success, updates `User.subscriptionStatus = PRO`
- `apps/web/src/app/api/cron/caas-check/route.ts` — Daily CAAS balance check: queries all PRO subscriptions, resets `consecutiveFailures` on success, increments on failure, sets `LAPSED` at 3 failures
- `packages/shared/src/server/adapters/bdapps.ts` — `caasDirectDebit`, `caasGetBalance`
- `packages/shared/prisma/schema.prisma` — `Subscription`, `CaasTransaction` models; `consecutiveFailures`, `gracePeriodEndsAt` fields

**API Routes:**
- `POST /api/billing/subscribe`
- `POST /api/cron/caas-check` (cron-protected)

**What's implemented:**
- CAAS direct-debit call with unique `externalTrxId` (UUID) for idempotency
- Charge-before-record fix: `CaasTransaction` created with PENDING status before CAAS call (prevents silent double-charge)
- Subscription record created/updated on success
- `CaasTransaction` audit record created
- `subscriptionStatus` on User updated to PRO
- Billing amount hard-coded server-side (`SUBSCRIPTION_AMOUNT_BDT = 5`) — not user-controllable
- Error handling fixed: catch block no longer shows success UI on failure
- Daily CAAS balance cron: checks all PRO subscribers, increments failure counter, marks LAPSED at ≥3 consecutive failures (grace-period flow itself deferred to v2)

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
- `email_trial_expires_at` set to now + 24h on magic-link callback (first login only, not reset on re-login)
- Email trial enforcement active in `withAuth` — expired EMAIL users receive HTTP 402
- OTP-authenticated users are never gated
- Pro/free feature gating deferred per SRS — no routes return 403 based on subscriptionStatus alone

**What's missing:** Complete (gating for pro/free is intentionally deferred to post-v1 per SRS)

---

### FR-I18N — Bilingual UI (English + Bengali)
**Priority:** P0
**Status:** In Progress (mostly done)

**Files:**
- `packages/shared/src/utils/i18n.ts` — i18next initialization with full EN and BN translation namespaces; `LanguageDetector` removed — Zustand is the single source of truth for language
- `apps/web/src/components/ui/LanguageToggle.tsx` — Language toggle component; present on ALL screens including auth and onboarding (UIR-02 compliance)
- `apps/web/src/app/layout.tsx` — Root layout; `next/font/google` loads Manrope + Noto Sans Bengali (self-hosted, no render-blocking)
- `apps/web/src/components/Providers.tsx` — Dynamically updates HTML `lang` attribute based on Zustand language state

**What's implemented:**
- ~50 new translation keys added (EN + BN) covering dashboard, calendar, symptoms, auth, onboarding, feedback, and content screens
- Full EN and BN translation keys covering: auth, onboarding, dashboard, calendar, symptoms, content, feedback, subscription, settings, profiles, common
- i18next + react-i18next initialized; language sourced from Zustand (no localStorage LanguageDetector)
- Language toggle UI present on all screens including auth and onboarding
- `date-fns` Bengali locale (`bn`) used for date formatting when language is BN
- `next/font/google` self-hosts Manrope + Noto Sans Bengali — no external font requests
- HTML `lang` attribute dynamically updated via `Providers.tsx`

**What's missing:**
- No automated layout regression tests at 375px in BN mode
- Email notification templates in Bengali — `packages/shared/src/server/email-templates.ts` needs content verification for BN language branch
- Language preference persisted only in Zustand/localStorage, not synced to `User.language` column in DB (column exists in schema but sync not verified)

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
- OTP verify attempt limiter (5/referenceNo)
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
**Status:** Done

**Files:**
- `apps/web/src/app/(main)/content/page.tsx` — Content RSC; fetches published articles server-side with optional `?phase=` filter
- `apps/web/src/app/(main)/content/ContentClient.tsx` — Client island; article list with phase-tab filter, inline article detail view with bilingual support
- `apps/web/src/app/queries/content-queries.ts` — `getPublishedArticles(phase?)` cached RSC query via `listPublishedArticles` from shared services

**What's implemented:**
- Article list UI with phase filtering (all, menstrual, follicular, ovulation, luteal) via URL searchParams
- Articles fetched server-side from DB via shared `listPublishedArticles` service (no dummy data)
- Bilingual article display: renders `titleEn`/`bodyEn` or `titleBn`/`bodyBn` based on Zustand language state
- Phase tags and category badges on article cards
- Inline article detail view with rich HTML body rendering
- Empty state with "No articles yet" message when no published articles exist
- End-to-end content pipeline: articles created in admin CMS → published → visible in web app Learn section

**What's missing:**
- Phase-based surfacing is client-side only (no server-driven personalization based on user's current cycle phase)
- No `/content/[slug]` route — articles open in inline reader on `/content`
- Client-side DOMPurify sanitization in `ContentClient.tsx` before `dangerouslySetInnerHTML` (verify coverage in QA; server sanitization on CMS persist only)

---

### FR-ADMIN — Admin Dashboard, User & Subscription Management
**Priority:** P2
**Status:** Implemented

**Admin App (`apps/admin/`):**
- Runs on port 3001 (`just a` / `just wa`)
- Same JWT/cookie auth as the web app; edge proxy (`apps/admin/src/proxy.ts`) validates JWT **and** enforces `role === ADMIN` before any page renders
- Email/password login for admins (bcrypt-hashed via `verifyAdminLogin()` in `@vesta/shared/server/auth`; no OTP or magic-link)
- Admin account seeded via `packages/shared/prisma/seed.ts` (env: `ADMIN_EMAIL` / `ADMIN_PASSWORD`, defaults: `admin@vesta.health` / `admin123`)
- English-only (no i18n overhead)
- Matches Vesta design language: glass-morphism panels, gradient accents, Manrope font
- **Beyond SRS scope (implemented):** Email delivery logs (`/emails`), template preview (`/emails/preview`), audit log viewer (`/audit-logs`)

**Files:**
- `apps/admin/src/proxy.ts` — Edge proxy: JWT decode + role check; redirects to `/login` if unauthenticated or non-admin
- `apps/admin/src/app/login/page.tsx` — Admin email/password login UI
- `apps/admin/src/app/api/auth/login/route.ts` — POST handler: calls `verifyAdminLogin()`, issues JWT cookie
- `apps/admin/src/app/api/auth/logout/route.ts` — POST handler: calls `logoutAndBlacklist()`
- `apps/admin/src/app/(admin)/page.tsx` — Dashboard: KPI stat cards (total users, active subscribers, DAU, NPS) + 30-day signup trend chart (Recharts)
- `apps/admin/src/app/(admin)/users/page.tsx` — User list: search, status/role filters, pagination
- `apps/admin/src/app/(admin)/users/[id]/page.tsx` — User detail: profiles tab, subscriptions tab, feedback tab; admin action buttons (suspend, reactivate, soft-delete)
- `apps/admin/src/app/(admin)/subscriptions/page.tsx` — Pro subscriber management: grant Pro, revoke Pro, CAAS override history
- `apps/admin/src/app/(admin)/content/page.tsx` — Article list CMS with publish/draft toggle
- `apps/admin/src/app/(admin)/content/new/page.tsx` — Article create with Tiptap 3.x editor, EN/BN side-by-side
- `apps/admin/src/app/(admin)/content/[id]/page.tsx` — Article edit; category CRUD, phase tags, draft/publish lifecycle
- `apps/admin/src/app/(admin)/analytics/page.tsx` — Population health charts (cycle length distribution, symptom frequency, prediction accuracy MAE, retention)
- `apps/admin/src/app/(admin)/sms/page.tsx` — SMS broadcast management: create, schedule, delete; send history
- `apps/admin/src/app/(admin)/feedback/page.tsx` — All user feedback with category/date/rating filters + CSV export
- `apps/admin/src/app/(admin)/feedback/[id]/page.tsx` — Feedback detail view (`FeedbackDetailClient`)
- `apps/admin/src/app/(admin)/emails/page.tsx` — Email delivery log list + stats (`EmailsClient`)
- `apps/admin/src/app/(admin)/emails/[id]/page.tsx` — Email log detail + HTML preview + delivery refresh
- `apps/admin/src/app/(admin)/emails/preview/page.tsx` — Bilingual template preview (period/fertile/logging reminders)
- `apps/admin/src/app/(admin)/audit-logs/page.tsx` — Admin action audit trail (`AuditLogClient`)

**Admin-specific UI components (11 primitives + 15 feature clients):**
Primitives: `DataTable`, `Badge`, `StatCard`, `FilterBar`, `Pagination`, `ConfirmModal`, `Button`, `Card`, `Input`, `Shimmer`, `TiptapEditor`, `AdminPageHeader`, `RefetchButton`, `VestaLogo`
Feature clients: `DashboardClient`, `UsersClient`, `UserDetailClient`, `SubscriptionsClient`, `ContentClient`, `ArticleEditorClient`, `EditArticleClient`, `AnalyticsClient`, `SmsClient`, `FeedbackClient`, `FeedbackDetailClient`, `EmailsClient`, `EmailDetailClient`, `EmailPreviewClient`, `AuditLogClient`

**Admin Actions:**
- **User**: suspend (`suspendedAt`, `suspendedBy`), reactivate (clear suspension), soft-delete (`deletedAt`)
- **Subscription**: grant Pro (admin override), revoke Pro; tracked via `adminOverride`, `adminOverrideBy`, `adminOverrideAt` on `Subscription`
- **Content**: article CRUD, category CRUD, draft → publish lifecycle, phase tag assignment
- **SMS**: broadcast create, schedule, delete; send history view
- **Export**: feedback CSV, users CSV (via `export-service`)

**Server Actions (admin app):**
- `apps/admin/src/app/actions/user-actions.ts` — suspend, reactivate, softDelete, grantPro, revokePro
- `apps/admin/src/app/actions/content-actions.ts` — article CRUD, category CRUD
- `apps/admin/src/app/actions/sms-actions.ts` — `createSmsBroadcast`, `deleteSmsBroadcast`, `sendSmsBroadcast`
- `apps/admin/src/app/actions/export-actions.ts` — CSV generation (feedback, users)
- `apps/admin/src/app/actions/email-delivery-actions.ts` — `refreshEmailDeliveryStatus`
- `apps/admin/src/app/actions/email-preview-actions.ts` — `getEmailLogPreviewHtml`
- `apps/admin/src/app/actions/cache-actions.ts` — `revalidateAdminTags`

**Cached Queries (admin app):**
- `apps/admin/src/app/queries/` — `auth-queries`, `dashboard-queries`, `user-queries`, `subscription-queries`, `content-queries`, `analytics-queries`, `sms-queries`, `feedback-queries`, `email-queries`, `audit-queries` (thin `cache()` wrappers over shared services)

**API Routes (admin app — auth only):**
- `POST /api/auth/login` — email/password authentication
- `POST /api/auth/logout` — JWT blacklist + cookie clear

**What's implemented:** All items above.

**What's missing:**
- Automated test suite for admin app (typecheck passes; runtime tests not written yet)
- Failed Resend delivery log surfaced in admin UI
- Image upload to Supabase storage from Tiptap editor (drag-and-drop stub present, upload not wired)
- UI/accessibility issues documented in `review/ADMIN-UI-REVIEW.md` (2026-05-30): ~90 findings including missing focus styles, transition-all anti-pattern, keyboard-inaccessible DataTable rows

---

### FR-CMS — Content CMS (Tiptap)
**Priority:** P2
**Status:** Implemented

**Files:**
- `apps/admin/src/app/(admin)/content/new/page.tsx` — Article create page with Tiptap 3.x rich-text editor
- `apps/admin/src/app/(admin)/content/[id]/page.tsx` — Article edit page
- `apps/admin/src/app/(admin)/content/page.tsx` — Article list with draft/published filter
- `packages/shared/src/server/services/content-service.ts` — Article + category CRUD, draft/publish lifecycle, phase-tag queries

**What's implemented:**
- Tiptap 3.x rich-text editor integrated for article body (EN and BN side-by-side panels)
- `Article` model in Prisma schema (`ArticleStatus` enum: DRAFT, PUBLISHED)
- `ArticleCategory` model in Prisma schema
- Draft/publish lifecycle: admin can save draft and publish separately
- Phase tag assignment (`CyclePhase` enum: MENSTRUAL, FOLLICULAR, OVULATORY, LUTEAL)
- HTML sanitization applied server-side before persisting article body
- Bilingual authoring: `titleEn`, `bodyEn`, `titleBn`, `bodyBn` fields in `Article`

**What's missing:**
- Image upload from Tiptap to Supabase storage (stub present, not wired)
- No HTML sanitization unit test coverage

---

### FR-ANALYTICS — Population Analytics & Prediction Accuracy
**Priority:** P2
**Status:** Implemented

**Files:**
- `apps/admin/src/app/(admin)/analytics/page.tsx` — Population health charts rendered with Recharts
- `packages/shared/src/server/services/analytics-service.ts` — Aggregation queries: cycle length distribution, symptom frequency, prediction accuracy (MAE), 30-day retention

**What's implemented:**
- Population health charts: cycle length distribution, symptom frequency heatmap, prediction accuracy (MAE over time), user retention curve
- All charts rendered with Recharts inside the admin panel
- Admin-only endpoint (`GET /api/admin/analytics`) with `requireAdminAuth()` guard
- Anonymized aggregation queries — no PII in query results

**What's missing:**
- Nightly MAE report job not scheduled (analytics are computed on-demand per admin page load)
- No data export of raw analytics aggregates

---

### FR-EXPORT — Data Export (CSV / Excel)
**Priority:** P2
**Status:** Partial — admin CSV done; user CSV via Server Action (no REST route; Excel label misleading)

**Files:**
- `apps/web/src/app/(main)/settings/SettingsClient.tsx` — Export CSV / Export Excel buttons call `exportUserDataCsv`
- `apps/web/src/app/actions/settings-actions.ts` — `exportUserDataCsv()` — period + symptom rows for **all** user profiles
- `apps/admin/src/app/(admin)/feedback/page.tsx` — Feedback CSV export button (admin)
- `packages/shared/src/server/services/export-service.ts` — CSV generation for feedback records and user list using `papaparse`

**API Routes:**
- Admin: export via Server Actions `exportFeedbackCsv`, `exportUsersCsv` (no dedicated REST routes in admin app)
- User: no `/api/export` route — download triggered from Settings via Server Action only

**What's implemented:**
- Admin feedback CSV export (category, rating, message, timestamp, userId)
- Admin users CSV export (id, phone, email, role, subscriptionStatus, createdAt)
- User CSV download from Settings — period logs + symptom log metadata across all profiles
- `papaparse` used for CSV generation in `export-service` (admin exports)

**What's missing (user-facing):**
- No dedicated `/api/export` REST route
- "Export Excel" button produces CSV (same as CSV button) — no `.xlsx` generation
- Settings UI copy says "active profile only" but `exportUserDataCsv` exports **all** profiles (copy bug)
- Symptom `value` not decrypted in export (blocked by FR-ENC)
- No true Excel format per SRS

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

**Admin SMS (newly implemented):**
- `apps/admin/src/app/(admin)/sms/page.tsx` — Broadcast management UI: create, schedule, delete; send history table
- `packages/shared/src/server/services/sms-service.ts` — `SmsBroadcast` CRUD, scheduling, send dispatch
- `packages/shared/prisma/schema.prisma` — `SmsBroadcast` model (`SmsBroadcastStatus` enum: DRAFT, SCHEDULED, SENT, FAILED)
- Admin API routes: `GET|POST|DELETE /api/admin/sms/broadcasts`

**What's implemented (admin SMS):**
- Broadcast create, schedule, delete via admin panel
- `SmsBroadcast` model persists message content, scheduled time, status, and send history
- `AdminAuditLog` entry written for each broadcast action
- Send history visible in admin SMS page

**What's implemented (admin SMS send):**
- `sendSmsBroadcast` in `sms-service.ts` calls `smsSend(message, ['tel:all'])` — BDApps broadcast to all subscribers in one API call

**What's missing:**
- No CSV/bulk-upload interface for content batches
- Content override logic (deactivating previous day's content) not implemented
- SMS delivery report webhook does not update per-broadcast status in admin UI

---

### FR-WEBHOOK — BDApps Inbound Webhooks
**Priority:** P0
**Status:** Done

**Files:**
- `apps/web/src/app/api/webhooks/sms/receive/route.ts` — Inbound SMS; IP validation, persists `SMS_RECEIVE` event
- `apps/web/src/app/api/webhooks/sms/report/route.ts` — SMS delivery report; persists `SMS_REPORT` event
- `apps/web/src/app/api/webhooks/ussd/receive/route.ts` — USSD events; persists `USSD_RECEIVE` event
- `apps/web/src/app/api/webhooks/subscription/notify/route.ts` — Subscription status changes; persists `SUBSCRIPTION_NOTIFY`, maps BDApps status → PRO/LAPSED, updates `User.subscriptionStatus` and `Subscription.status`
- `apps/web/src/app/api/webhooks/resend/route.ts` — Resend delivery events (inbound email provider webhook)
- `packages/shared/src/server/adapters/webhooks.ts` — `validateWebhookSource` (IP whitelist via `BDAPPS_WEBHOOK_IPS` env; uses `x-real-ip` header set by infra, not spoofable `x-forwarded-for`), `persistWebhookEvent` (idempotency by key)
- `packages/shared/prisma/schema.prisma` — `WebhookEvent` model with `idempotencyKey @unique`

**API Routes:**
- `POST /api/webhooks/sms/receive`
- `POST /api/webhooks/sms/report`
- `POST /api/webhooks/ussd/receive`
- `POST /api/webhooks/subscription/notify`

**What's implemented:**
- All four required webhook endpoints present
- IP whitelist validation using `x-real-ip` (infra-set header; permissive when `BDAPPS_WEBHOOK_IPS` not set, enforced in production)
- Idempotency: duplicate `idempotencyKey` returns 200 without reprocessing
- `subscription/notify` updates subscription status bidirectionally (ACTIVE→PRO, INACTIVE/SUSPENDED/EXPIRED→LAPSED)
- HTTP 200 responses within handler (fast, non-blocking)

**What's missing:**
- SMS delivery report does not update a specific broadcast message record (no `SmsBroadcastMessage` model exists); the webhook persists the event but no status update propagates to an admin view

---

### FR-FEEDBACK — In-App Feedback Module
**Priority:** P1
**Status:** In Progress (mostly done)

**Files:**
- `apps/web/src/app/(main)/feedback/page.tsx` — Feedback RSC; fetches feedback history from DB
- `apps/web/src/app/(main)/feedback/FeedbackClient.tsx` — Client island: 4 categories (Bug, Feature, General, Satisfaction), 1–5 star rating, 500-char message, submission history view
- `apps/web/src/app/actions/feedback-actions.ts` — `submitFeedback` Server Action; persists feedback to DB
- `packages/shared/prisma/schema.prisma` — `Feedback` model with `id`, `userId`, `profileId`, `category`, `message`, `rating`, `createdAt`

**What's implemented:**
- Full feedback form UI with animations, star rating, character counter
- 4 SRS-required categories implemented
- Submission history display (fetched server-side from DB)
- `Feedback` DB model matches SRS schema exactly
- `submitFeedback` Server Action persists feedback to DB

**Admin feedback:**
- `apps/admin/src/app/(admin)/feedback/page.tsx` — List with category, date range, star-rating filters + CSV export
- `apps/admin/src/app/(admin)/feedback/[id]/page.tsx` — Detail view (message, rating, user link, metadata)

**What's implemented (admin):**
- Feedback list with filter by category (Bug, Feature, General, Satisfaction), date range, and rating
- CSV export via `exportFeedbackCsv` Server Action
- Feedback detail page at `/feedback/[id]`

**What's missing:**
- Admin cannot reply to or resolve individual feedback items — read-only view only

---

## Schema Coverage Summary

### Enums added in admin/shared services sprint

| Enum | Values |
|------|--------|
| `ArticleStatus` | `DRAFT`, `PUBLISHED` |
| `CyclePhase` | `MENSTRUAL`, `FOLLICULAR`, `OVULATORY`, `LUTEAL` |
| `SmsBroadcastStatus` | `DRAFT`, `SCHEDULED`, `SENT`, `FAILED` |

### Models

| Model | Status | Notes |
|-------|--------|-------|
| `User` | Done | All required fields + new: `suspendedAt`, `suspendedBy`, `deletedAt`, `lastLoginAt`; indexes on `suspendedAt`, `deletedAt` |
| `Profile` | Done | All 6 relations, `cycleLength`, `periodLength`, `lastPeriodStart`, `goal` |
| `PeriodLog` | Done | `startDate`, `endDate`, `flowIntensity` (LIGHT/MEDIUM/HEAVY) |
| `SymptomLog` | Partial | Schema present; `value` field **not encrypted** |
| `Prediction` | Done | All output fields + `PredictionTier` (AVERAGE/ARIMA/LSTM) |
| `Subscription` | Done | `consecutiveFailures`, `gracePeriodEndsAt` + new: `adminOverride` (Boolean), `adminOverrideBy`, `adminOverrideAt` |
| `CaasTransaction` | Done | Idempotent `externalTrxId @unique` |
| `OtpChallenge` | Done | `referenceNo`, `expiresAt`, `verified` |
| `MagicLink` | Done | `token @unique`, `expiresAt`, `used` |
| `WebhookEvent` | Done | `idempotencyKey @unique`, `WebhookType` enum |
| `JobEvent` | Done | `JobStatus` enum, `PREDICTION_RECALC` + `SMS_BROADCAST` job types |
| `NotificationPreference` | Done | 3 toggle flags per profile |
| `Feedback` | Done | Schema matches SRS; persisted via Server Action; filterable in admin panel |
| `Article` | Done | `titleEn`, `bodyEn`, `titleBn`, `bodyBn`, `status` (`ArticleStatus`), `categoryId`, `phase` (`CyclePhase`), `publishedAt` |
| `ArticleCategory` | Done | `name`, `slug`; FK from `Article.categoryId` |
| `SmsBroadcast` | Done | `message`, `scheduledAt`, `status` (`SmsBroadcastStatus`), `sentAt`, `recipientCount`; replaces the previously missing `SmsBroadcastMessage` |
| `AdminAuditLog` | Done | `adminId`, `action`, `targetType`, `targetId`, `metadata` (JSON), `createdAt`; written by `audit-service` |

---

## Security Fixes Applied

The following security issues were identified and resolved in the current sprint:

1. **Internal dev pages guarded in production** — `dev-login` and similar routes return `notFound()` when `NODE_ENV === 'production'`.
2. **Webhook IP validation fixed** — `validateWebhookSource` now reads `x-real-ip` (set by infra/reverse-proxy) instead of the spoofable `x-forwarded-for` header.
3. **OTP verify rate-limited** — max 5 attempts per `referenceNo` enforced server-side (brute-force protection).
4. **Billing amount server-side only** — `SUBSCRIPTION_AMOUNT_BDT` is a server constant; users cannot influence the charge amount via request body.
5. **Magic-link trial not reset on re-login** — `emailTrialExpiresAt` is set only on user creation, not on every magic-link callback.
6. **Charge-before-record fix** — `CaasTransaction` created with PENDING status before the CAAS network call; prevents silent double-charge on retry.
7. **`env.local` added to `.gitignore`** — prevents accidental secret commit.
8. **Security headers added** — `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` set in Next.js config or middleware.
9. **Auth proxy (`proxy.ts`)** — server-side auth redirect based on cookie presence; unauthenticated requests to protected routes redirected before React renders. Renamed from `middleware.ts` for Next.js 16 compatibility.
10. **NFR-SEC-05 — Admin role enforcement** — `apps/admin/src/proxy.ts` (edge proxy) validates JWT and checks `role === ADMIN` on every admin route before any page renders. Non-admin JWTs are redirected to `/login`. `requireAdminAuth()` and `withAdminAuth()` provide the same enforcement at the route-handler level.
12. **Admin email/password auth** — bcrypt-hashed passwords stored in `User.passwordHash`; `verifyAdminLogin()` in shared auth uses `bcryptjs` (dynamic import). Admin seed uses 12-round bcrypt hash.
11. **Suspended/deleted user check in `getAuthUser()`** — suspended or soft-deleted users receive HTTP 403 on every authenticated request, even with a valid JWT.

---

## P0 Blockers

1. **FR-ENC**: `prisma-field-encryption` not installed; `symptom_logs.value` stored as plaintext. Blocks the DoD security gate.
2. **FR-AUTH**: Profile completion modal wired to `completeProfile`, but trigger scope differs from SRS (email-only, sessionStorage dismiss — see Open Items).

## P1/P2 Gaps

- `FR-EXPORT` (user-facing): CSV download works via Server Action; no `/api/export` route; Excel button is CSV-only; UI copy mismatch on profile scope.
- `FR-SMS`: `tel:all` implemented in `sms-service`; no CSV bulk-upload or content-override logic.
- `FR-ANALYTICS`: Nightly MAE report not scheduled; analytics computed on-demand only.
- `FR-CMS`: Image upload from Tiptap to Supabase storage not yet wired (stub present).
- `FR-ADMIN` (admin test suite): Automated tests for admin app not written; typecheck only.
- **UI/Accessibility** (both apps): ~190 findings documented in `review/WEB-UI-REVIEW.md` and `review/ADMIN-UI-REVIEW.md`. Highest-impact fixes: Button.tsx focus styles, Input.tsx label linking, globals.css reduced-motion + color-scheme, ContentClient.tsx HTML sanitization.
- **DB migration pending**: Schema changes (passwordHash, admin models, new enums/indexes) not yet applied via `just db-migrate`. Seed not yet run.
