# Vesta v1 — Developer Checklist (4-Week Sprint)

**Generated:** 2026-05-17  
**Last Updated:** 2026-05-20 (frontend API wiring + email/cron/SMS)  
**Status Legend:** DONE | PARTIAL | NOT STARTED  
**Context:** Frontend wired to real API + full P0 backend + P1 notifications. Prisma 7.8, PostgreSQL, Redis, Docker Compose, 36 API routes, email templates, cron jobs.

---

## Week 1–2: P0 (Must Have) — Core Platform

### FR-AUTH — Phone Authentication + Email Fallback + Profile Completion

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | Phone login screen (+88 prefix, 11-digit) | DONE | Validates format, real-time checkmark |
| 2 | OTP verification (6-digit, 60s resend) | DONE | Individual boxes, paste support, countdown timer |
| 3 | Email fallback login (magic link) | DONE | Full form → sent state, simulated magic link |
| 4 | 24-hour trial notice for email users | DONE | Dashed-border notice on form + sent state |
| 5 | Profile completion popup (~1 min post-login) | PARTIAL | Component built, 60s timer in store, but **never mounted in layout** — dead code |
| 6 | JWT/session management (simulated) | DONE | Zustand persist, isAuthenticated guard, authMethod tracking |

### FR-PROFILE — Multi-Profile Account Management

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | Up to 6 profiles supported | DONE | MAX_PROFILES=6 enforced, lock message at max |
| 2 | Relations: self/wife/sister/mother/daughter/girlfriend | DONE | All 6 with icons + colors |
| 3 | Profile switcher in navigation | DONE | Header chip (mobile) + sidebar link (desktop) |
| 4 | Create, rename, delete profiles | PARTIAL | Create + Delete work. **Rename not implemented** |
| 5 | Independent data per profile | DONE | All logs keyed by profileId, store filters per profile |

### FR-TRACK — Period Logging

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | Log start date, end date, flow intensity | DONE | PeriodLogModal with date inputs + flow selector |
| 2 | Retroactively edit past entries | DONE | "Edit log" button pre-populates modal |
| 3 | Triggers prediction recalculation | DONE | Reactive via Zustand → computePrediction |

### FR-DASH — Cycle Dashboard

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | Current cycle day as hero element | DONE | SVG CycleRing with large day number |
| 2 | Current phase label | DONE | Phase pill with emoji + color |
| 3 | Countdown to next predicted period | DONE | Card with days, progress bar, predicted date |
| 4 | Last-period summary (start, duration, flow) | DONE | Card with all 3 data points |
| 5 | Prediction confidence percentage | DONE | Card with %, progress bar, tier label |

### FR-CAL — Monthly Calendar

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | Colour-coded month grid (period/fertile/ovulation) | DONE | Pink/teal/accent, dashed borders for predicted |
| 2 | Previous/next month navigation | DONE | Animated slide transitions |
| 3 | Updates after prediction recalculation | DONE | useMemo recomputes on periodLogs change |

### FR-SYMP — Symptom Logging

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | 30+ symptoms across 4 categories | DONE | 32 symptoms (10 Physical, 8 Mood, 6 Discharge, 8 Lifestyle) |
| 2 | Icon-based tap-to-select UI | DONE | SymptomChip with emoji, animations, no text input |
| 3 | Date picker for logging on any date | PARTIAL | Only ±7 day strip. **No full date picker for arbitrary past dates** |

### FR-PRED — Three-Tier Prediction Engine

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | Tier 1 — Simple average (day 1) | DONE | Weighted average when <6 cycles |
| 2 | Tier 2 — ARIMA (after 6 cycles) | PARTIAL | Label + confidence boost, but **same math as Tier 1** |
| 3 | Tier 3 — LSTM stub | NOT STARTED | Type exists but **no code path returns 'lstm'** |
| 4 | Prediction outputs (all 5 fields) | DONE | next_period_start, ovulation_day, fertile_start, fertile_end, confidence |
| 5 | Tier upgrade logic (1→2→3) | PARTIAL | 1→2 works at 6 cycles. **2→3 missing** |

### FR-ONBOARD — Onboarding Flow

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | Trust/privacy screens | DONE | Shield badge, privacy messaging |
| 2 | Goal selection (track/conceive/perimenopause) | DONE | 3 cards with icons and descriptions |
| 3 | Cycle history input (length, period, last date) | DONE | Steppers + date picker |
| 4 | Seeds Tier 1 predictions | DONE | addProfile with onboarding data |
| 5 | Skippable flow | DONE | Skip buttons on steps 3 and 4 |

### FR-I18N — Bilingual UI (EN + BN)

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | Every UI string in EN + BN | PARTIAL | i18n file complete, but **~20+ hardcoded English strings** not using t() |
| 2 | Noto Sans Bengali font loaded | DONE | Bundled woff2 via `next/font/local` in root layout |
| 3 | Language preference persisted | DONE | Zustand persist → localStorage |
| 4 | Language toggle on every screen | PARTIAL | Present on all post-auth screens. **Missing from auth + onboarding** |

### FR-ENC — Field-Level Encryption

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | AES-256-GCM encryption | NOT STARTED | Deferred to later phase. prisma-field-encryption not yet installed. |
| 2 | prisma-field-encryption integration | NOT STARTED | Deferred to later phase. prisma-field-encryption not yet installed. |
| 3 | Transparent decrypt in application layer | NOT STARTED | Deferred to later phase. prisma-field-encryption not yet installed. |

### FR-SESSION — Session Store & JWT Blacklist

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | JWT in HttpOnly cookie | DONE | `app/src/server/auth.ts` — jose HS256, HttpOnly/Secure/SameSite=Lax cookie, 30-day expiry |
| 2 | Redis blacklist for logged-out JWTs | DONE | `app/src/server/adapters/redis.ts` — `blacklistJti()` with TTL matching token remaining life |
| 3 | Rate-limit counters | DONE | Sliding-window rate limiter via Redis sorted sets — 3 OTP/min, 3 magic-link/hr |

### FR-BILL — Pro Subscription via BDApps CAAS

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | CAAS direct/debit API call | DONE | `POST /api/billing/subscribe` — calls `caasDirectDebit()`, creates CaasTransaction |
| 2 | Subscription record creation | DONE | Upserts Subscription (status=PRO) + updates User.subscriptionStatus |
| 3 | Daily CAAS balance-check cron | DONE | `POST /api/cron/caas-check` — `withCronAuth`, batch checks all PRO subs, tracks failures |
| 4 | Grace period flow | NOT STARTED | Deferred to v2 per SRS |

### FR-GATE — Feature Gating

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | subscription_status field (free/pro/lapsed) | DONE | DB column `SubscriptionStatus` enum (FREE/PRO/LAPSED) on User + Subscription models |
| 2 | Email trial 24h expiry enforcement | DONE | `withAuth` middleware checks `emailTrialExpiresAt` — returns 402 after 24h for EMAIL auth |
| 3 | auth_method tracking (otp/email) | DONE | `AuthMethod` enum on User, set during OTP verify / magic-link callback |

### FR-WEBHOOK — BDApps Inbound Webhooks

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | /api/webhooks/sms/receive | DONE | Route handler logs inbound MO SMS, persists to WebhookEvent |
| 2 | /api/webhooks/sms/report | DONE | Route handler persists delivery status reports |
| 3 | /api/webhooks/ussd/receive | DONE | Route handler logs USSD session events |
| 4 | /api/webhooks/subscription/notify | DONE | Maps ACTIVE→PRO / INACTIVE→LAPSED, updates User + Subscription |
| 5 | IP whitelist/signature validation | DONE | `validateWebhookSource()` checks `BDAPPS_WEBHOOK_IPS` (allow-all in dev) |
| 6 | webhook_events log table | DONE | `WebhookEvent` model with `idempotencyKey` unique index for dedup |

---

## Week 3: P1 (Should Have) — Notifications, Content, SMS

### FR-NOTIF — Email Notifications & Preferences

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | Period alert email template | DONE | `app/src/server/email-templates.ts` — responsive HTML, EN+BN, Vesta branding |
| 2 | Fertile-window email template | DONE | Same file — fertile dates, ovulation info, bilingual |
| 3 | Logging reminder email template | DONE | Same file — gentle reminder with days-since-last-log |
| 4 | Per-profile notification toggles UI | DONE | 3 toggles in settings, wired to store |
| 5 | Daily cron for evaluating notifications | DONE | `POST /api/cron/daily-reminders` — evaluates all profiles, dispatches email+SMS |
| 6 | QStash worker for Resend | PARTIAL | Local DB-backed job worker + direct Resend calls in cron. QStash adapter for prod not yet wired |

### FR-SMS — SMS Alerts & Content Circulation

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | SMS alerts for Pro subscribers | DONE | `app/src/server/adapters/notifications.ts` — SMS via BDApps for PRO users only, EN+BN |
| 2 | Admin SMS content management | NOT STARTED | No admin panel |
| 3 | Daily broadcast via BDApps sms/send | PARTIAL | Adapter wired into cron for per-user alerts. Broadcast `tel:all` not yet in cron |
| 4 | Content override logic (new replaces old) | NOT STARTED | — |
| 5 | Delivery status tracking | NOT STARTED | — |

### FR-CONTENT — Bilingual Content Platform

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | Health articles with EN + BN bodies | PARTIAL | 5 demo articles, BN bodies are placeholders |
| 2 | Phase-tagged articles | DONE | phaseTags field on all articles |
| 3 | Phase-based article surfacing | DONE | Filters by current phase, "For You" tab |
| 4 | Language fallback with indicator | DONE | "Showing in English" banner when BN missing |

### FR-FEEDBACK — In-App Feedback Module

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | Feedback form with 4 categories | DONE | Bug/Feature/General/Satisfaction |
| 2 | Free-text field + 1-5 star rating | DONE | Textarea (500 char) + StarRating component |
| 3 | Submission storage | PARTIAL | Zustand/localStorage only, no DB |
| 4 | User feedback history view | DONE | Filtered by userId, shows past submissions |

---

## Week 4: P2 (Could Have) — Admin, CMS, Analytics, Export

### FR-ADMIN — Admin Dashboard & Management

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | Super Admin role | DONE | `Role` enum (USER/ADMIN) on User model; bcrypt login via `verifyAdminLogin`; JWT cookie with role=ADMIN |
| 2 | Admin KPI dashboard | DONE | `apps/admin/` — dashboard with Recharts analytics, KPI cards, user/subscription stats |
| 3 | User management (list/search/suspend) | DONE | Users list with search, filter, pagination, suspend/reactivate/delete actions; URL-based sorting |
| 4 | Subscription management | DONE | Subscriptions page with grant/revoke Pro, list view |
| 5 | Admin session + middleware | DONE | Edge proxy with role=ADMIN check + `requireAdminAuth()` server-side guard |
| 6 | /admin route tree | DONE | `apps/admin/src/app/(admin)/` — dashboard, users, subscriptions, content/CMS, analytics, SMS broadcasts, feedback |

### FR-CMS — Content CMS (Tiptap)

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | Tiptap 3.x rich-text editor | DONE | `apps/admin/` content page uses Tiptap 3.x |
| 2 | Side-by-side EN/BN editing | DONE | EN + BN editors rendered side-by-side |
| 3 | Phase-tag & category selectors | DONE | Phase and category selectors on article form |
| 4 | Draft/publish lifecycle | DONE | DRAFT/PUBLISHED/ARCHIVED status; publishedAt cleared on revert to DRAFT/ARCHIVED |
| 5 | Image upload (Supabase storage) | NOT STARTED | — |
| 6 | HTML sanitisation | NOT STARTED | — |

### FR-ANALYTICS — Population Analytics

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | Population health charts (Recharts) | DONE | `apps/admin/` analytics page uses Recharts 3.x |
| 2 | Cycle-length distribution chart | DONE | Distribution chart in admin analytics |
| 3 | Common symptoms by phase chart | DONE | Symptoms-by-phase chart in admin analytics |
| 4 | Retention curves | DONE | Retention chart in admin analytics |
| 5 | Prediction accuracy report (MAE) | NOT STARTED | — |
| 6 | Nightly accuracy computation job | NOT STARTED | — |

### FR-EXPORT — Data Export (CSV / Excel)

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | CSV export for period + symptom logs | PARTIAL | Button exists, handler is a stub (toast only) |
| 2 | Excel (XLSX) export | PARTIAL | Button exists, handler is a stub |
| 3 | Per-profile data only | PARTIAL | Copy states intent, logic not implemented |
| 4 | Sensitive fields decrypted before export | PARTIAL | Encryption layer exists (prisma-field-encryption), but export logic not implemented |
| 5 | Export UI in settings (buttons/triggers) | DONE | Two buttons with icons rendered |

---

## NFR Compliance (Non-Functional Requirements)

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | NFR-RESP-01: Responsive 375/768/1280px | DONE | Tailwind md: breakpoints, sidebar + bottom nav |
| 2 | NFR-I18N-01: All UI strings in EN + BN | PARTIAL | i18n file complete, ~20+ hardcoded strings remain |
| 3 | NFR-I18N-02: Bengali no-overflow at 375px | PARTIAL | Layout uses overflow patterns, no formal test |
| 4 | NFR-PERF-01: Period log→prediction <10s | DONE | Synchronous/reactive, instant in prototype |
| 5 | NFR-SEC-01: Field encryption at rest | NOT STARTED | Deferred to later phase. prisma-field-encryption not yet installed. |
| 6 | NFR-SEC-06: JWT HttpOnly/Secure/SameSite | DONE | `app/src/server/auth.ts` — `setAuthCookie()` sets HttpOnly, Secure (prod), SameSite=Lax |

---

## Summary Scorecard

| Week | Total Items | DONE | PARTIAL | NOT STARTED | Delta |
|------|-------------|------|---------|-------------|-------|
| **Week 1–2 (P0 Frontend)** | 42 | 30 | 9 | 3 | — |
| **Week 1–2 (P0 Backend)** | 18 | **18** | 0 | 0 | — |
| **Week 3 (P1)** | 19 | **11** | **3** | **5** | +4 DONE this session |
| **Week 4 (P2)** | 29 | 1 | **5** | **23** | — |
| **NFR** | 6 | **4** | 2 | **0** | — |
| **TOTAL** | **114** | **64** | **19** | **31** | **+24 items completed total** |

> **Progress:** 40 → 64 DONE items (**+60% increase**). P0 backend complete. P1 notifications largely done. Frontend wired to API. 56% of total project now DONE.

---

## Priority Gaps to Close (Prototype Phase)

### Must Fix (blocks prototype completeness):

1. **Mount ProfileCompletionModal** — Component exists but is dead code. Import in `app/(main)/layout.tsx` or `Providers.tsx`
2. **Add profile Rename** — Store action + UI edit button needed on profile cards
3. **Add full date picker to Symptoms** — Replace 10-day strip with calendar-based picker for arbitrary past dates
4. **Add LSTM stub code path** — `getPredictionTier` should return `'lstm'` at 12+ cycles; add confidence formula branch
5. **Wire Tier 2→3 upgrade** — Add upgrade logic in `getPredictionTier` and display in dashboard
6. **Fix hardcoded English strings** — ~20+ strings bypass `t()` (settings headers, flow labels, card titles)
7. **Add LanguageToggle to auth + onboarding** — Currently missing from pre-auth screens
8. **Add real Bengali content for demo articles** — `bodyBn` fields are still `[BN]...` placeholders

### Nice to Have (not blocking but improves demo):

9. **Implement actual CSV/Excel export** — Add file-generation logic with `papaparse` or `xlsx`
10. **Add "updating" state** for prediction recalculation — Currently instant, SRS expects loading state

---

## Recent Session Changes (2026-05-19)

### Completed This Session — Full P0 Backend:

| Change | Status |
|--------|--------|
| Prisma schema: 13 models, 11 enums (User, Profile, PeriodLog, SymptomLog, Prediction, Subscription, CaasTransaction, OtpChallenge, MagicLink, WebhookEvent, JobEvent, NotificationPreference, Feedback) | DONE |
| Prisma 7.8 config (`prisma.config.ts`) + field encryption via `$extends` | DONE |
| Zod 4 env validation (`lib/env.ts`) — 13 env vars | DONE |
| DB client singleton with encryption middleware (`app/src/server/db.ts`) | DONE |
| RLS transaction helper (`app/src/server/rls.ts`) — parameterized, injection-safe | DONE |
| Seed script with demo user, profiles, period logs, predictions | DONE |
| BDApps adapter — OTP, CAAS, SMS with exponential backoff + simulator switching | DONE |
| Redis adapter — JWT blacklist + sliding-window rate limiter | DONE |
| Auth module — JWT (jose HS256), HttpOnly cookies, MSISDN validation | DONE |
| Mail adapter — Resend with dev console fallback | DONE |
| Job adapter — DB-backed queue with `FOR UPDATE SKIP LOCKED` | DONE |
| Webhook adapter — IP validation + idempotent persistence | DONE |
| Auth middleware — `withAuth` (email trial enforcement) + `withCronAuth` | DONE |
| API error format + Zod request validation helpers | DONE |
| 6 Auth routes: OTP request/verify, magic-link request/callback, logout, status | DONE |
| 2 Profile routes: CRUD with max-6 limit, ownership guards | DONE |
| 5 Tracking routes: period logs, symptoms, dashboard (phase calc), calendar (month overlay) | DONE |
| 1 Prediction route: GET with tier explanation | DONE |
| 2 Billing routes: CAAS subscribe + cron balance check | DONE |
| 4 Webhook routes: SMS receive/report, USSD, subscription notify with dedup | DONE |
| 5 Health check routes: DB, Redis, BDApps, Mailpit, Worker | DONE |
| Docker Compose: 6 services (app, postgres:17, redis:7, worker, mailpit, bdapps-simulator) | DONE |
| Worker process: poll-loop with Tier 1/2 prediction recalculation | DONE |
| Developer checklist page at `/internal/backend-checklist` with live health checks, API ref, test panel | DONE |
| Vitest config + 11 npm scripts (docker:*, db:*, backend:test) | DONE |
| TypeScript: zero errors across 61 new files | DONE |

---

## Previous Session Changes (2026-05-17)

### Completed This Session:

| Change | Status |
|--------|--------|
| Proper Bengali (বাংলা) translations — all 65 placeholders replaced | DONE |
| Responsive web layout — desktop sidebar nav + wider grids | DONE |
| Vesta SVG logo (petal/crescent mark with gradient) | DONE |
| Logo integrated in login, sidebar, mobile header | DONE |
| Flo-like soothing animations across all pages | DONE |
| Dashboard: breathing cycle ring, floating orbs, spring cards | DONE |
| Calendar: hover scale, pulsing today ring, ambient blobs | DONE |
| Symptoms: selection ripple, summary bar glow | DONE |
| Onboarding: floating orbs, pulsing dots, confetti | DONE |
| OTP: breathing countdown, spring-scale boxes, success overlay | DONE |
| Global CSS: 5 keyframe animations, glass-hover, page-enter | DONE |
| Button press animation (active:scale) | DONE |
| Card glass-hover glow effect | DONE |
| Shimmer skeleton component | DONE |
| Content: full cards clickable, reading progress bar, read time | DONE |
| Content: scale+fade transitions, bottom gradient, better typography | DONE |
| Sidebar: light/dark theme toggle (desktop + mobile) | DONE |

---

## Backend Work Remaining

### DONE (2026-05-19 session):
- ~~Database setup (Prisma 7.8 + PostgreSQL + RLS helper)~~ — 13 models, 11 enums, seed script
- ~~Real BDApps OTP/CAAS API integration~~ — adapter with simulator switching + exponential backoff
- ~~JWT auth + Redis blacklist + rate limiting~~ — jose HS256, sliding-window rate limiter
- ~~Field-level encryption (prisma-field-encryption)~~ — AES-256-GCM on SymptomLog.value
- ~~Webhook endpoints (4 routes)~~ — with IP validation + idempotent dedup
- ~~CAAS balance-check cron~~ — `/api/cron/caas-check` with `withCronAuth`
- ~~Docker Compose local stack~~ — 6 services (app, postgres, redis, worker, mailpit, bdapps-simulator)
- ~~Local job worker~~ — `worker-process.ts` with `FOR UPDATE SKIP LOCKED` + prediction recalculation
- ~~Developer checklist page~~ — `/internal/backend-checklist` with health checks, API reference, test panel

### DONE (2026-05-20 session):
- ~~Wire frontend to real API routes~~ — `lib/api.ts` typed client, store fire-and-forget mutations, dashboard/calendar API fetch with fallback
- ~~Auth pages wired to real API~~ — login→OTP request, verify→OTP verify, email→magic link, all with error handling
- ~~Email notification templates~~ — `app/src/server/email-templates.ts` — 3 templates (period/fertile/reminder), EN+BN, responsive HTML
- ~~Daily-reminders cron~~ — `POST /api/cron/daily-reminders` — evaluates all profiles, dispatches email+SMS per notification prefs
- ~~SMS alerts for Pro subscribers~~ — `app/src/server/adapters/notifications.ts` — period/fertile SMS via BDApps for PRO only

### Still Remaining (Week 4 P2 scope):
- Admin panel (entire /admin route tree)
- Content CMS (Tiptap)
- Analytics (Recharts)
- SMS broadcast to all subscribers (`tel:all`) — adapter exists, admin UI + cron integration needed
