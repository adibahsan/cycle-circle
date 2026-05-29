# Product Requirements Document — Vesta v1

**Product:** Vesta — Bilingual Reproductive Health & Cycle Intelligence Platform
**Audience:** Bangladesh
**Version:** 1.0
**Date:** April 2026
**Status:** Draft for Stakeholder Review
**Author:** Product Team

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Goals](#2-goals)
3. [Non-Goals](#3-non-goals)
4. [User Stories](#4-user-stories)
5. [Requirements](#5-requirements)
6. [Success Metrics](#6-success-metrics)
7. [Open Questions](#7-open-questions)
8. [Timeline Considerations](#8-timeline-considerations)

---

## 1. Problem Statement

Reproductive health tracking is inaccessible to the majority of Bangladeshi women. Existing tools are English-only, built for Western usage patterns, and require email accounts or payment methods that many Bangladeshi users do not have — creating a significant gap between need and access.

Women in Bangladesh track menstrual health for deeply personal and culturally important reasons: personal wellness, family planning, and managing health for themselves and family members. Today, they resort to paper diaries, unlocalized apps that feel foreign, or nothing at all — leaving them without cycle predictions, symptom awareness, or health-relevant content in their native language.

The cost of not solving this: users are navigating reproductive health decisions without data, in a market where no bilingual, phone-first cycle tracker exists.

---

## 2. Goals

**User Goals**

- **G1 — Accessible sign-up:** A user with only a Bangladeshi mobile number can register, verify, and begin tracking in under 3 minutes — no email address, no credit card, no English required.
- **G2 — Accurate predictions, faster over time:** Users receive cycle predictions from day one (Tier 1) that automatically improve in accuracy as they log more cycles (Tier 2 after 6 cycles), building trust in the product over time.
- **G3 — Family-aware tracking:** A single account holder can track cycles for up to six family members (self, wife, sister, mother, daughter, girlfriend) with fully isolated data per profile.
- **G4 — Native language experience:** Every screen, notification, and article is available in both English and Bengali, with the user's language preference persisting across sessions.

**Business Goals**

- **G5 — Monetisation foundation:** The Pro subscription tier (via BDApps CAAS direct debit) is live and charging, even though feature gating is deferred to post-v1, establishing the revenue rail from day one.
- **G6 — $0/month launch cost:** The full product ships within free-tier limits of Vercel, Supabase, Upstash, and Resend, validating the market before committing to infrastructure spend.

---

## 3. Non-Goals

- **No SMS notifications (v2):** Push and SMS alerts are out of scope. Email is the only async communication channel in v1. SMS adds complexity around BDApps carrier routing and opt-out compliance that exceeds the four-week timeline.
- **No native mobile apps (v2):** Vesta v1 is a responsive web app only. Native iOS/Android builds require separate submission tracks, device testing infrastructure, and app store review cycles that are not justified until web traction is proven.
- **No AI chatbot or doctor consultations (v2):** Conversational health guidance and telemedicine require clinical review, liability frameworks, and LLM cost modelling that are explicitly deferred.
- **No feature gating enforcement in v1:** The `subscription_status` column is written to and kept accurate by the billing flow, but no middleware gate blocks free users from Pro features in v1. Gating logic is post-v1. This prevents blocking a hard launch on UI/UX decisions that need more research.
- **No pregnancy mode, partner sharing, or community forum (v2):** These require distinct user journeys, additional data models, and content strategies. Scope creep into these areas would jeopardise the four-week delivery commitment.
- **No medicine, sleep, or exercise tracking (v2):** Vesta v1 focuses exclusively on cycle intelligence. Lifestyle tracking expands the data model and content surface area beyond what a four-week MVP can responsibly deliver.

---

## 4. User Stories

### Authentication & Onboarding

- As a new user in Bangladesh, I want to register using only my mobile number so that I do not need an email address or credit card to get started.
- As a new user, I want to receive an OTP on my phone to verify my number so that my account is secure without requiring a password.
- As a returning user, I want to be kept logged in securely via a cookie so that I do not have to re-verify my number on every visit.
- As a new user, I want to complete an onboarding flow that explains how my data is handled before I enter any personal information so that I can make an informed decision to trust the product.
- As a new user completing onboarding, I want to enter my typical cycle length, period length, and last period date so that the app can generate predictions for me immediately.
- As a new user who prefers not to share history, I want to skip onboarding and still reach the dashboard so that I am not blocked from using the app before I am ready.

### Cycle Tracking & Dashboard

- As a user, I want to log a period's start date, end date, and flow intensity so that the app can build my cycle history and improve predictions over time.
- As a user, I want to edit a past period entry so that I can correct mistakes or retroactively capture data I forgot to log.
- As a user, I want to see a dashboard showing my current cycle day, phase, countdown to next period, and prediction confidence so that I understand where I am in my cycle at a glance.
- As a new user with no history, I want the dashboard to show an "estimate" disclaimer on my Tier 1 prediction so that I understand the confidence level of early predictions.

### Calendar & Symptoms

- As a user, I want to see a colour-coded monthly calendar showing my period, fertile window, and ovulation day so that I can plan ahead visually.
- As a user, I want to navigate backward and forward between months on the calendar so that I can review history and see future predictions.
- As a user, I want to log symptoms from a 30+ icon-based grid across Physical, Mood, Discharge, and Lifestyle categories so that I can track how I feel throughout my cycle without typing.
- As a user, I want to log symptoms for past dates using a date picker so that I can capture data retroactively.

### Multi-Profile Management

- As a family manager, I want to create up to six named profiles on one account so that I can track cycles for my wife, sister, mother, daughter, or girlfriend from a single login.
- As a family manager, I want to switch between profiles from the main navigation so that I can quickly check each person's dashboard.
- As a family manager, I want to delete a profile and all its data so that I can remove profiles when they are no longer needed.
- As a family manager, I want each profile's data to be completely isolated so that I never accidentally view or modify someone else's cycle information.

### Prediction Engine

- As a user who just signed up, I want to see Tier 1 (average-based) predictions immediately so that the app is useful from day one.
- As a user who has logged six or more cycles, I want the app to automatically upgrade to Tier 2 (ARIMA) predictions so that my forecast becomes more accurate without me needing to do anything.
- As a user, I want to see my prediction confidence percentage on the dashboard so that I know how much to rely on the forecast.

### Pro Subscription

- As a user who wants Pro features, I want to subscribe using my mobile balance via BDApps CAAS so that I can pay without a bank card or PayPal.
- As a Pro subscriber, I want to be warned by email when my subscription is about to lapse so that I can top up my balance before access is affected.
- As a Pro subscriber whose balance failed to charge, I want a grace period before Pro access is revoked so that a temporary low-balance situation does not immediately cut off my account.

### Bilingual Experience

- As a Bengali-speaking user, I want to use the entire app in Bengali including all labels, notifications, and articles so that the product feels native and familiar.
- As a user, I want to toggle between English and Bengali at any time so that I can switch language without losing my data or session.
- As a Bengali-speaking user, I want email notifications to arrive in Bengali so that alerts are immediately readable without mental translation.

### Content Platform

- As a user, I want to read health articles relevant to my current cycle phase so that I receive timely, contextual reproductive health information.
- As a user, I want to switch an article to my preferred language without a page reload so that reading in both languages is seamless.

### Admin

- As a Super Admin, I want to access a protected admin dashboard with KPIs (total users, active profiles, Pro subscribers, daily logs) so that I can monitor platform health at a glance.
- As a Super Admin, I want to search, view, suspend, or soft-delete user accounts so that I can handle abuse and support cases efficiently.
- As a Super Admin, I want to view current Pro subscribers and manually revoke or re-grant Pro access so that I can resolve billing edge cases without a code deploy.
- As a Super Admin, I want to author and publish bilingual health articles using a rich-text editor so that the content platform stays fresh without engineering support.
- As a Super Admin, I want to view anonymised population health charts and prediction accuracy reports so that I can assess data quality and platform health trends.

---

## 5. Requirements

### P0 — Must Have (Weeks 1–2, core launch gate)

#### FR-AUTH — Phone Authentication

- The system shall allow registration with a Bangladeshi mobile number in `tel:8801XXXXXXXXX` format.
- The system shall call BDApps `POST /otp/request`, then verify the user-entered code via `POST /otp/verify`.
- OTP resend shall be available only after a 60-second cooldown.
- On successful verification, the system shall issue a JWT in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie.
- On logout, the JWT's `jti` shall be added to the Upstash Redis blacklist until token expiry; blacklisted tokens shall return HTTP 401.
- Exponential-backoff retry shall apply on BDApps API failures; after three failures, a user-friendly error shall display.
- More than three OTP requests per minute from the same IP shall return HTTP 429.

**Acceptance criteria:**
- [ ] New user completes sign-up end-to-end in production with a real Bangladeshi number.
- [ ] Incorrect OTP shows error; correct OTP creates account and redirects to onboarding.
- [ ] Resend button is disabled for 60 s, then re-enables.
- [ ] A logged-out JWT returns 401 on subsequent API calls.
- [ ] Fourth OTP request within 60 s from the same IP returns 429.

#### FR-PROFILE — Multi-Profile Account Management

- One account shall support up to six profiles with fixed relationship types: self, wife, sister, mother, daughter, girlfriend.
- Each profile shall have independent cycle history, symptoms, and predictions.
- Profiles shall be creatable, renameable, and deletable; deletion shall cascade to all associated `period_logs`, `symptom_logs`, and prediction records.
- Data isolation shall be enforced at both API middleware and PostgreSQL RLS levels.
- The profile switcher shall be accessible from the main navigation on every authenticated screen.

**Acceptance criteria:**
- [ ] User can create six profiles and switch between them; each displays independent data.
- [ ] Direct DB query confirms user A's `period_logs` are unreadable by user B's session (RLS).
- [ ] Deleting a profile removes all associated records.

#### FR-TRACK — Period Logging

- User shall log period start date, end date, and flow intensity (light / medium / heavy).
- User shall be able to retroactively edit past period entries.
- Each log creation or update shall enqueue an asynchronous prediction recalculation via Upstash QStash.
- The UI shall show an "updating" state while a QStash prediction job is in flight.

**Acceptance criteria:**
- [ ] Period log saved → prediction recalculated → calendar updated within 3 seconds end-to-end.
- [ ] Editing a past entry updates predictions; dashboard reflects new values within 3 s.

#### FR-DASH — Cycle Dashboard

- Dashboard shall display: hero cycle day number, current phase label (Menstrual / Follicular / Ovulatory / Luteal), countdown to next predicted period, last-period summary (start date, duration, flow), and prediction confidence percentage.
- A new user with no logged history shall see an "estimate" disclaimer and a Tier 1 prediction seeded from onboarding data.

**Acceptance criteria:**
- [ ] All five data points render correctly after first period log.
- [ ] New user with no history sees "estimate" disclaimer and Tier 1 prediction.

#### FR-CAL — Monthly Calendar

- Calendar shall show a month-grid with colour-coded dates: period (pink), fertile window (teal), ovulation day (accent colour).
- Previous/next month navigation shall be available.
- Calendar shall update automatically after any prediction recalculation.

**Acceptance criteria:**
- [ ] Correct colour coding for logged and predicted periods across three future months.
- [ ] Month navigation works without layout breakage at 375 px viewport.

#### FR-SYMP — Symptom Logging

- System shall expose 30+ symptoms across four categories: Physical, Mood, Discharge, Lifestyle.
- Selection UI shall be icon-based, tap-to-select (no text entry required).
- User shall log symptoms for any date via a date picker.
- Symptom values shall be encrypted at rest (see FR-ENC).

**Acceptance criteria:**
- [ ] All 30+ symptoms across all four categories are renderable and persistable.
- [ ] Decrypted symptom value is returned correctly to the authenticated user via API.

#### FR-PRED — Three-Tier Prediction Engine

- Tier 1 (simple average): available from day one, seeded from onboarding cycle history.
- Tier 2 (ARIMA): unlocks automatically once a profile has 6 logged cycles; displayed as `predictions.tier = 'ARIMA'` in DB.
- Tier 3 (LSTM): stub only in v1; not implemented.
- Prediction outputs: `next_period_start`, `ovulation_day`, `fertile_start`, `fertile_end`, `confidence`.
- Recalculation is asynchronous via QStash; UI shows "updating" state while job is in flight.

**Acceptance criteria:**
- [ ] User with one logged cycle sees Tier 1 predictions with "estimate" disclaimer.
- [ ] User with six or more cycles automatically receives Tier 2 predictions (verifiable in DB).
- [ ] Confidence percentage updates after each new period log.

#### FR-ONBOARD — Onboarding Flow

- Onboarding shall present trust/privacy screens before any personal input.
- User shall select a goal: period tracking, trying to conceive, or perimenopause.
- User shall enter: typical cycle length, typical period length, and last period date.
- Onboarding data shall immediately seed Tier 1 predictions.
- Onboarding shall be skippable; skipped users land on the dashboard with a "add your first period" prompt.

**Acceptance criteria:**
- [ ] New user completes onboarding and lands on dashboard with Tier 1 predictions pre-populated.
- [ ] User who skips onboarding reaches the dashboard with the empty-state prompt.

#### FR-BILL — Pro Subscription via BDApps CAAS

- On Pro plan selection, the system shall call BDApps `POST /caas/direct/debit` with a unique `externalTrxId` (UUID) per transaction.
- On success, a `subscriptions` record is created with status `ACTIVE` and Pro features unlock immediately.
- A daily cron at 02:00 UTC (`/api/cron/caas-check`) shall call `POST /caas/get/balance` for all Pro subscribers.
- On a balance-check failure, the system increments `consecutive_failures`.
- After reaching the configured threshold N, `grace_start = now()` is set; Pro remains active during the grace window.
- At grace-period expiry, `subscriptions.status` is set to `LAPSED` and a warning email is sent.
- Transient BDApps errors shall not trigger lapse; only N consecutive failures shall.
- The grace-period length N shall be configurable via DB config (no code deploy required).

**Acceptance criteria:**
- [ ] Pro upgrade via CAAS charges mobile balance and updates `subscription_status` to `pro` within one API round-trip.
- [ ] Daily CAAS cron runs at 02:00 UTC and updates the subscriptions table (verifiable in logs).
- [ ] Grace period activates on simulated N consecutive failures; Pro is revoked at expiry.
- [ ] Real BDApps CAAS charge verified with a production transaction.

#### FR-GATE — Feature Gating (Schema Only)

- A `subscription_status` column shall exist on the user/profile table with values `free | pro | lapsed` and default `free`.
- No route shall return HTTP 403 based on subscription status in v1; all features are available to all authenticated users.
- The CAAS billing flow shall keep `subscription_status` accurate so future gating middleware can rely on the field without a schema migration.

**Acceptance criteria:**
- [ ] Migration creates `subscription_status` column with default `free`.
- [ ] Smoke tests against Pro and free accounts confirm no 403 is returned based on subscription.

#### FR-I18N — Bilingual UI (English + Bengali)

- Every UI string shall be available in English and Bengali from launch.
- Noto Sans Bengali font shall be loaded for Bengali mode.
- Language preference shall be persisted per user account.
- All components shall be tested for overflow given that Bengali text runs 20–40% longer than English.

**Acceptance criteria:**
- [ ] Every page renders without broken layout in Bengali at 375 px viewport.
- [ ] Language toggle works on every screen; preference survives a page reload.
- [ ] i18next translation audit shows zero missing keys in BN namespace.

#### FR-ENC — Field-Level Encryption

- Sensitive health fields (`symptom_logs.value`, health notes) shall be encrypted at rest using AES-256-GCM via `prisma-field-encryption`.
- Decryption occurs only in the application layer; the raw database contains only cipher text.

**Acceptance criteria:**
- [ ] Direct SQL query of `symptom_logs` returns cipher text, not plain text.
- [ ] API returns correctly decrypted value to the authenticated user.
- [ ] CI integration test verifies the encrypt → store → retrieve → decrypt round-trip.

#### FR-SESSION — Session Store & JWT Blacklist

- JWT is issued on successful OTP verification and stored as an `HttpOnly` cookie.
- On logout, the JWT's `jti` is added to Upstash Redis blacklist until token expiry; no permanent growth of blacklist storage.
- Rate-limit counters for OTP and login attempts are stored in Redis.

**Acceptance criteria:**
- [ ] Logged-out user's old token returns 401 even before its `exp` claim.
- [ ] Blacklist entry TTL matches remaining JWT lifetime.
- [ ] More than three OTP requests per minute from the same MSISDN return HTTP 429.

---

### P1 — Should Have (Week 3)

#### FR-NOTIF — Email Notifications & Per-Profile Preferences

- System shall support three notification types: period start alert (predicted period in 2 days), fertile window opening (today), daily logging reminder (no log in past 3 days).
- A daily cron at 08:00 UTC (`/api/cron/daily-reminders`) shall evaluate active profiles and dispatch email jobs to QStash.
- A QStash worker shall call Resend using React Email templates rendered in the user's preferred language (EN or BN).
- Per-profile toggles in `notification_preferences` allow users to enable/disable each type independently.
- Failed Resend deliveries shall be retried by QStash; permanent failures shall be logged for admin review.
- Total daily volume shall stay within Resend free-tier limits (3,000/month, 100/day) at v1 scale.

**Acceptance criteria:**
- [ ] Period-alert email arrives in inbox within one hour of cron run on predicted day.
- [ ] Disabling a notification type prevents future emails of that type for that profile.
- [ ] BN-preference user receives Bengali subject and body.

#### FR-CONTENT — Bilingual Content Platform

- Health articles shall store both EN and BN bodies in a single DB record.
- Articles shall be tagged with one or more cycle phases (menstrual, follicular, ovulation, luteal) and a category.
- The reader UI shall surface articles relevant to the user's current phase first.
- If a translation is missing, the article shall fall back to the available language with a clear locale-fallback indicator.

**Acceptance criteria:**
- [ ] Article list filters by phase tag and renders correctly in both languages.
- [ ] Switching the language toggle updates article body without a page reload.
- [ ] An article missing a translation displays a clear locale-fallback indicator.

---

### P2 — Could Have (Week 4)

#### FR-ADMIN — Admin Dashboard & User Management

- A single Super Admin role has full system access (users, subscriptions, content, analytics).
- Admin dashboard displays KPIs: total users, active profiles, Pro subscribers, daily logs, prediction-accuracy summary.
- User management: list, search, view profile metadata, suspend, soft-delete, inspect subscription state.
- Subscription management: current Pro subscribers, recent CAAS results, grace-period users, manual revoke/re-grant.
- Admin session uses a separate login screen, a short-lived JWT, and Super Admin authentication middleware on every `/admin/*` route.

**Acceptance criteria:**
- [ ] Non-Super-Admin token accessing any `/admin` route returns HTTP 403.
- [ ] KPI dashboard reflects DB state within one minute of a signup, log, or upgrade event.
- [ ] Suspending a user immediately prevents that user's JWT from authenticating.
- [ ] Manual Pro revoke updates `subscription_status` and stops the next CAAS charge attempt.

#### FR-CMS — Content CMS (Tiptap)

- Admin panel includes a Tiptap 3.x rich-text editor for bilingual article authoring.
- Editor supports side-by-side EN/BN editing with phase-tag and category selectors.
- Draft/publish lifecycle: only published articles surface in the reader UI.
- Image uploads stored in Supabase storage; saved HTML sanitised (strips `<script>` and unsafe tags).

**Acceptance criteria:**
- [ ] Article authored → saved as draft → published → appears in reader feed within one minute.
- [ ] Editor renders correctly for Bengali input.
- [ ] Sanitisation strips `<script>` and other unsafe tags from saved HTML.

#### FR-ANALYTICS — Population Analytics & Prediction Accuracy

- Admin-only anonymised charts (cycle-length distribution, common symptoms by phase, retention curves) rendered with Recharts 3.x.
- Nightly prediction-accuracy report: per-tier MAE between predicted next-period start and actual logged start.
- No analytics endpoint returns row-level user identifiers or decrypted symptom values.

**Acceptance criteria:**
- [ ] Population charts load in under 3 s on the admin dashboard.
- [ ] MAE figures match a manually computed sample for at least one prediction tier.
- [ ] No analytics endpoint returns user identifiers or decrypted symptom data.

#### FR-EXPORT — Data Export (CSV / Excel)

- Authenticated users can export period and symptom logs for profiles they own as CSV or XLSX.
- Cross-profile export is opt-in and clearly labelled.
- Sensitive fields are decrypted in-app before write; the download contains plain text.
- Export completes within 10 s; large datasets may fall back to async QStash job with emailed download link (post-v1 if needed).

**Acceptance criteria:**
- [ ] CSV download opens cleanly in Excel and Google Sheets with correct column headers.
- [ ] User cannot trigger an export of another user's data even by manipulating the request.
- [ ] Exported file contains decrypted symptom values, not cipher text.

---

### Non-Functional Requirements Summary

| ID | Requirement | Target |
|---|---|---|
| NFR-PERF-01 | Period log → prediction recalc → calendar update | ≤ 10 s end-to-end |
| NFR-PERF-02 | All synchronous API routes | p99 < 10 s (Vercel Hobby limit) |
| NFR-SEC-01 | Sensitive health fields encrypted at rest | AES-256-GCM, cipher text verifiable in DB |
| NFR-SEC-04 | No third-party analytics scripts on health-event data | Zero health payloads sent to third-party domains |
| NFR-SEC-05 | All `/admin/*` routes protected | Non-admin token returns HTTP 403 |
| NFR-SEC-06 | JWT cookie flags | `HttpOnly`, `Secure`, `SameSite=Lax` |
| NFR-I18N-01 | All strings translated EN + BN at launch | Zero missing keys in BN namespace |
| NFR-I18N-02 | Bengali layout at 375 px | No overflow across all 21 screens |
| NFR-RESP-01 | Responsive breakpoints | 375 px, 768 px, 1280 px — no broken layouts |
| NFR-REL-01 | Transient BDApps errors do not trigger Pro lapse | Only N consecutive failures trigger grace-period flow |
| NFR-AVAIL-01 | Supabase free-tier database must not auto-pause | Keep-alive cron pings DB daily |
| NFR-MAINT-01 | Grace-period length configurable without code deploy | DB config update takes effect immediately |
| NFR-MAINT-02 | Prisma pinned to 6.13.x | Dependency lockfile audit passes |

---

## 6. Success Metrics

### Leading Indicators (measure within the first 30 days)

| Metric | Definition | Target |
|---|---|---|
| Sign-up completion rate | % of users who start OTP flow and complete account creation | ≥ 70% |
| Onboarding completion rate | % of new accounts that complete onboarding (not skip) | ≥ 60% |
| First period log rate | % of users who log at least one period within 7 days of sign-up | ≥ 50% |
| Symptom log activation | % of users who log at least one symptom within 14 days | ≥ 30% |
| Calendar engagement | % of active users who open the calendar at least once per week | ≥ 40% |
| Language toggle usage | % of users who use Bengali mode at any point | ≥ 50% (market validation) |
| Pro conversion rate | % of registered users who initiate a CAAS Pro upgrade in first 30 days | ≥ 5% |

### Lagging Indicators (measure at 60–90 days)

| Metric | Definition | Target |
|---|---|---|
| 30-day retention | % of users active in day 25–30 who were active in day 1–5 | ≥ 35% |
| Tier 2 unlock rate | % of active users who accumulate 6+ logged cycles (Tier 2 eligible) | ≥ 20% at 90 days |
| Pro retention rate | % of Pro subscribers still active after 60 days | ≥ 80% |
| CAAS grace-period rate | % of Pro subscribers who hit grace-period in any 30-day window | ≤ 10% |
| Email open rate | Notification emails opened / sent | ≥ 25% (industry benchmark for health: ~22%) |
| Prediction accuracy (Tier 1 MAE) | Mean absolute error between predicted and actual period start | ≤ 2 days |
| Prediction accuracy (Tier 2 MAE) | MAE for ARIMA-tier users | ≤ 1.5 days |

### Measurement Methods

- **Retention, activation, conversion:** Server-side event logging to PostgreSQL; admin analytics dashboard (FR-ANALYTICS).
- **Prediction MAE:** Nightly accuracy cron job; viewable in admin analytics.
- **Email metrics:** Resend dashboard open/click tracking.
- **CAAS billing health:** `subscriptions` table; `consecutive_failures` counter monitored via admin subscription management view.

---

## 7. Open Questions

### Blocking (must resolve before or during development)

| # | Question | Owner |
|---|---|---|
| OQ-01 | What is the correct value of N (consecutive CAAS failures) before grace-period triggers? What is the default grace-period duration? | Product / Client sponsor |
| OQ-02 | Is the `paymentInstrumentName` for BDApps CAAS pre-registered and available in the BDApps dashboard, or does it need to be set up as part of v1 work? | Engineering / BDApps account holder |
| OQ-03 | Which phone numbers will be used for OTP testing in production (real Bangladeshi numbers)? UAT requires at least one verified MSISDN. | QA / Client sponsor |
| OQ-04 | Is the Resend account confirmed and domain verified? Free-tier imposes a 100/day sending limit that constrains early user growth. | Engineering / Ops |
| OQ-05 | What is the Pro subscription price in BDT? This needs to be hardcoded into the CAAS `amount` field. | Product / Client sponsor |

### Non-Blocking (can resolve during implementation)

| # | Question | Owner |
|---|---|---|
| OQ-06 | Should the onboarding trust/privacy screen link to a full privacy policy page? If so, is legal copy available? | Product / Legal |
| OQ-07 | What is the desired behaviour when a user with Pro access has their `subscription_status` set to `lapsed` but then re-upgrades — does `consecutive_failures` reset? | Engineering |
| OQ-08 | How should the app handle users who switch phone numbers? Is number-change a v1 or v2 concern? | Product |
| OQ-09 | Should the admin CMS support image upload in the article body, or is text-only acceptable for v1? | Product / Design |
| OQ-10 | Are there specific Bengali typography considerations (ligatures, conjuncts) that require Tiptap plugin configuration for the CMS? | Engineering / Design |

---

## 8. Timeline Considerations

### Hard Deadlines

- No contractual hard deadline is documented in the SRS. The four-week scope is self-imposed and tied to the client sign-off milestone.
- BDApps CAAS production verification (OQ-03) must occur before launch; this depends on BDApps account provisioning, which is outside the team's control. Begin provisioning immediately — this is the highest external-dependency risk.

### Four-Week Delivery Plan

| Week | Focus | Key Deliverables |
|---|---|---|
| Week 1 | Auth + Profiles + Core data model | FR-AUTH, FR-PROFILE, FR-ENC, FR-SESSION, FR-GATE (schema migration), FR-I18N (foundation), FR-ONBOARD |
| Week 2 | Tracking + Predictions + Billing | FR-TRACK, FR-DASH, FR-CAL, FR-SYMP, FR-PRED, FR-BILL, FR-GATE (CAAS integration) |
| Week 3 | Notifications + Content | FR-NOTIF, FR-CONTENT |
| Week 4 | Admin + CMS + Analytics + Export | FR-ADMIN, FR-CMS, FR-ANALYTICS, FR-EXPORT |

### Dependencies & Risks

- **BDApps API availability (High risk):** OTP and CAAS APIs are third-party; outages or rate-limiting affect sign-up and billing. Mitigation: exponential backoff, consecutive-failure tolerance, early production testing.
- **Supabase free-tier auto-pause (Medium risk):** Free tier pauses after 7 days inactivity. Keep-alive cron (NFR-AVAIL-01) mitigates this; upgrade trigger to Supabase Pro ($25/month) is defined.
- **Prisma 6.13 pin (Low risk):** `prisma-field-encryption` requires Prisma 6.13.x. Any upstream Prisma security patch must be evaluated for compatibility before applying.
- **Resend daily limit (Low risk at launch):** 100 emails/day is sufficient at v1 scale but becomes a constraint at ~100+ daily-active users who all have notifications enabled. Monitor and upgrade proactively.
- **Vercel Hobby 10-second timeout (Managed):** All long-running work is routed to QStash. No synchronous route should approach the limit.

### Upgrade Path (cost milestones)

| Trigger | Action | Monthly Cost Delta |
|---|---|---|
| Supabase > 500 MB or auto-pause | Upgrade to Supabase Pro | +$25/month |
| Vercel function > 10 s or team seats needed | Upgrade to Vercel Pro | +$20/month |
| Upstash Redis or QStash over free limits | Switch to Upstash PAYG | < $1/month at early scale |
| Resend > 3,000 emails/month | Upgrade Resend plan | ~$20/month |

---

*End of document. For requirements traceability back to the SRS, refer to `docs/vesta/source/SRS.md` Appendix C.*
