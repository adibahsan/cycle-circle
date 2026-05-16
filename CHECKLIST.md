# Vesta v1 — Developer Checklist (4-Week Sprint)

**Generated:** 2026-05-17  
**Status Legend:** DONE | PARTIAL | NOT STARTED  
**Context:** Frontend prototype with Next.js 16 + dummy data. No backend/DB yet.

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
| 2 | Noto Sans Bengali font loaded | DONE | Google Fonts link in root layout |
| 3 | Language preference persisted | DONE | Zustand persist → localStorage |
| 4 | Language toggle on every screen | PARTIAL | Present on all post-auth screens. **Missing from auth + onboarding** |

### FR-ENC — Field-Level Encryption

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | AES-256-GCM encryption | NOT STARTED | No crypto code (UI mentions it only) |
| 2 | prisma-field-encryption integration | NOT STARTED | No Prisma in project |
| 3 | Transparent decrypt in application layer | NOT STARTED | All data is plain objects |

### FR-SESSION — Session Store & JWT Blacklist

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | JWT in HttpOnly cookie | NOT STARTED | Auth is simulated in Zustand |
| 2 | Redis blacklist for logged-out JWTs | NOT STARTED | No Redis |
| 3 | Rate-limit counters | NOT STARTED | No server-side infra |

### FR-BILL — Pro Subscription via BDApps CAAS

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | CAAS direct/debit API call | NOT STARTED | UI simulates with setTimeout |
| 2 | Subscription record creation | NOT STARTED | Local state only, no DB |
| 3 | Daily CAAS balance-check cron | NOT STARTED | No cron infrastructure |
| 4 | Grace period flow | NOT STARTED | Deferred to v2 per SRS |

### FR-GATE — Feature Gating

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | subscription_status field (free/pro/lapsed) | PARTIAL | Type + UI exists, no DB column |
| 2 | Email trial 24h expiry enforcement | PARTIAL | Timer countdown UI, no server-side gate |
| 3 | auth_method tracking (otp/email) | PARTIAL | Stored in Zustand, no DB |

### FR-WEBHOOK — BDApps Inbound Webhooks

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | /api/webhooks/sms/receive | NOT STARTED | No app/api/ directory |
| 2 | /api/webhooks/sms/report | NOT STARTED | — |
| 3 | /api/webhooks/ussd/receive | NOT STARTED | — |
| 4 | /api/webhooks/subscription/notify | NOT STARTED | — |
| 5 | IP whitelist/signature validation | NOT STARTED | — |
| 6 | webhook_events log table | NOT STARTED | — |

---

## Week 3: P1 (Should Have) — Notifications, Content, SMS

### FR-NOTIF — Email Notifications & Preferences

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | Period alert email template | NOT STARTED | No email templates |
| 2 | Fertile-window email template | NOT STARTED | — |
| 3 | Logging reminder email template | NOT STARTED | — |
| 4 | Per-profile notification toggles UI | DONE | 3 toggles in settings, wired to store |
| 5 | Daily cron for evaluating notifications | NOT STARTED | No cron |
| 6 | QStash worker for Resend | NOT STARTED | No QStash |

### FR-SMS — SMS Alerts & Content Circulation

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | SMS alerts for Pro subscribers | NOT STARTED | Mentioned as Pro feature label only |
| 2 | Admin SMS content management | NOT STARTED | No admin panel |
| 3 | Daily broadcast via BDApps sms/send | NOT STARTED | No cron or API calls |
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
| 1 | Super Admin role | NOT STARTED | No role field, no admin enum |
| 2 | Admin KPI dashboard | NOT STARTED | No /admin route tree |
| 3 | User management (list/search/suspend) | NOT STARTED | — |
| 4 | Subscription management | NOT STARTED | — |
| 5 | Admin session + middleware | NOT STARTED | — |
| 6 | /admin route tree | NOT STARTED | Directory doesn't exist |

### FR-CMS — Content CMS (Tiptap)

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | Tiptap 3.x rich-text editor | NOT STARTED | Not in package.json |
| 2 | Side-by-side EN/BN editing | NOT STARTED | — |
| 3 | Phase-tag & category selectors | NOT STARTED | — |
| 4 | Draft/publish lifecycle | NOT STARTED | Article type has `published` field (model-ready) |
| 5 | Image upload (Supabase storage) | NOT STARTED | — |
| 6 | HTML sanitisation | NOT STARTED | — |

### FR-ANALYTICS — Population Analytics

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | Population health charts (Recharts) | NOT STARTED | Recharts not in package.json |
| 2 | Cycle-length distribution chart | NOT STARTED | — |
| 3 | Common symptoms by phase chart | NOT STARTED | — |
| 4 | Retention curves | NOT STARTED | — |
| 5 | Prediction accuracy report (MAE) | NOT STARTED | — |
| 6 | Nightly accuracy computation job | NOT STARTED | — |

### FR-EXPORT — Data Export (CSV / Excel)

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | CSV export for period + symptom logs | PARTIAL | Button exists, handler is a stub (toast only) |
| 2 | Excel (XLSX) export | PARTIAL | Button exists, handler is a stub |
| 3 | Per-profile data only | PARTIAL | Copy states intent, logic not implemented |
| 4 | Sensitive fields decrypted before export | NOT STARTED | No encryption layer exists |
| 5 | Export UI in settings (buttons/triggers) | DONE | Two buttons with icons rendered |

---

## NFR Compliance (Non-Functional Requirements)

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | NFR-RESP-01: Responsive 375/768/1280px | DONE | Tailwind md: breakpoints, sidebar + bottom nav |
| 2 | NFR-I18N-01: All UI strings in EN + BN | PARTIAL | i18n file complete, ~20+ hardcoded strings remain |
| 3 | NFR-I18N-02: Bengali no-overflow at 375px | PARTIAL | Layout uses overflow patterns, no formal test |
| 4 | NFR-PERF-01: Period log→prediction <10s | DONE | Synchronous/reactive, instant in prototype |
| 5 | NFR-SEC-01: Field encryption at rest | NOT STARTED | No crypto layer |
| 6 | NFR-SEC-06: JWT HttpOnly/Secure/SameSite | NOT STARTED | No real JWT |

---

## Summary Scorecard

| Week | Total Items | DONE | PARTIAL | NOT STARTED |
|------|-------------|------|---------|-------------|
| **Week 1–2 (P0 Frontend)** | 42 | 30 | 9 | 3 |
| **Week 1–2 (P0 Backend)** | 18 | 0 | 3 | 15 |
| **Week 3 (P1)** | 19 | 7 | 2 | 10 |
| **Week 4 (P2)** | 29 | 1 | 3 | 25 |
| **NFR** | 6 | 2 | 2 | 2 |
| **TOTAL** | **114** | **40** | **19** | **55** |

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

## Backend Work Remaining (Post-Prototype)

All backend infrastructure is NOT STARTED:
- Database setup (Supabase + Prisma + RLS)
- Real BDApps OTP/CAAS API integration
- JWT auth + Redis blacklist + rate limiting
- Field-level encryption (prisma-field-encryption)
- Webhook endpoints (4 routes)
- Email notification system (Resend + QStash)
- SMS broadcast system (BDApps SMS Send API)
- Cron jobs (daily-reminders + caas-check)
- Admin panel (entire /admin route tree)
- Content CMS (Tiptap)
- Analytics (Recharts)
