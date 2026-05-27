# Project Research Summary

**Project:** Vesta -- Reproductive Health & Cycle Intelligence Platform
**Domain:** Web-based cycle tracking and reproductive health management, Bangladesh-first
**Researched:** 2026-03-26
**Confidence:** HIGH

---

## Executive Summary

Vesta is a web-based reproductive health platform targeting the Bangladesh market, built around a multi-profile account model that allows one account holder to manage health tracking for multiple family members (wife, sister, mother, daughter). This is the product's core architectural differentiator and competitive moat -- no major competitor (Flo, Clue, Maya) offers this. The research is unambiguous: the multi-profile system must be designed into the data model and auth layer from day one. It cannot be retrofitted. Every feature -- notifications, predictions, analytics, partner sharing, admin reporting -- multiplies in complexity when there are N profiles per account instead of 1. This is not a feature; it is the foundation.

The recommended stack is modern, stable, and well-matched to the domain. React 19 + Vite 6 (LTS) + Tailwind v4 on the frontend, Express 5 + PostgreSQL 16 + Prisma 6 on the backend, deployed as a pnpm monorepo with a shared types package. The most critical technical constraint is Prisma version: stay on 6.x (specifically tested against 6.13 for field encryption compatibility) because sensitive health data (sex life entries, medical notes) requires field-level AES-256-GCM encryption via `prisma-field-encryption`, which has not been verified compatible beyond v6.13. Upgrading to Prisma 7 would break encryption silently. Similarly, stay on Vite 6 LTS rather than Vite 8 (Rolldown, March 2026) until the plugin ecosystem stabilizes. The rule is: stability over bleeding edge for a health platform.

The primary market risks are regulatory and reputational, not technical. Two direct analogues -- Flo (FTC 2021) and Premom (FTC 2023) -- received regulatory action for sharing reproductive health data with third-party analytics SDKs. Vesta must establish a zero-third-party-analytics policy for health events before any SDK is installed. The multi-profile architecture also creates a meaningful ethical risk: it could be used by controlling family members to surveil women's reproductive health. This must be addressed with consent mechanisms, profile privacy controls, and an independent account claiming path. These are not v2 features; they belong in Phase 1.

---

## Key Findings

### Recommended Stack

The stack is largely decided and well-validated. The project already has React 19, Vite 6, TypeScript 5.8, Tailwind v4, React Router v7, date-fns, Lucide React, and Motion installed. The principal additions needed are: TanStack Query v5 (server state), Zustand v5 (client state), React Hook Form v7 + Zod v3 (forms/validation), i18next + react-i18next (bilingual UI), Recharts (analytics charts), and Sonner (toasts). On the backend: Express 5 (upgrade from 4.21 in current package.json), Prisma 6.x (pinned), PostgreSQL 16, Redis 7, BullMQ v5 (job queue), argon2 (password hashing), and the standard security middleware suite (helmet, cors, express-rate-limit).

**Core technologies:**
- React 19 + Vite 6 LTS: UI framework + build tool -- already installed; Vite 6 is the stable line for 2026
- Express 5: API server -- upgrade from current 4.21 for promise-based error handling and ReDoS fix
- Prisma 6.x (pinned to 6.13 initially): ORM -- field encryption compatibility ceiling requires version lock
- PostgreSQL 16 + pgcrypto: primary DB -- relational model fits multi-profile, field-level encryption, Row-Level Security
- Redis 7 + BullMQ v5: caching + job queue -- required for SMS/email reminders, medicine alarms, prediction recalc
- i18next + react-i18next: bilingual UI -- must be set up before any UI component is written; Bengali locale supported
- TanStack Query v5: server state -- all API calls go through this; profile-scoped query keys are critical
- Zustand v5: client state -- active profile, UI toggles, locale; lightweight and appropriate for this scope
- argon2 (Argon2id): password hashing -- OWASP-recommended, memory-hard, preferred over bcrypt for new projects
- SSL Wireless SMS gateway: Bangladesh notifications -- write a direct HTTP wrapper, not the npm package
- AWS S3: file storage -- ultrasound images need encryption-at-rest and access control, not Cloudinary's CDN model

**Deferred/conditional:** TensorFlow.js (Tier 3 LSTM -- only add when users have 12+ cycles of data), Python FastAPI sidecar (only if TensorFlow.js performance is inadequate), native mobile apps (after web product-market fit), Playwright E2E suite (Phase 2+).

### Expected Features

The feature research draws heavily on Flo product analysis, Maya competitor analysis, and Bangladesh market data (BTRC, Aponjon).

**Must have (table stakes -- launch blockers):**
- Multi-profile account system with relation types -- the entire product thesis depends on this
- Period start/end logging with flow intensity -- the reason anyone opens a cycle app
- Cycle day counter + phase display -- real-time "where am I?" shown on the dashboard
- Next period prediction (Tier 1: rolling average) -- primary user expectation
- Calendar view with color-coded phases -- universal expectation; month view, retroactive editing
- Fertile window and ovulation display -- expected by all users, critical for TTC
- Symptom logging (top 20-25 symptoms, icon-based) -- at minimum: mood, pain, flow, discharge
- User registration and auth with multi-profile support built in
- Onboarding flow with goal selection (track / TTC / pregnancy / perimenopause)
- Bilingual UI (English + Bengali) -- i18n infrastructure before any UI work
- Web push notifications (period alerts, fertile window, logging nudges)
- Basic admin dashboard (user management, metrics, security controls)
- Responsive design + PWA manifest (home screen install)

**Should have (competitive -- v1.x after validation):**
- SMS reminders via Bangladesh gateway (SSL Wireless / Alpha Net)
- Health analytics dashboard (cycle length trends, symptom patterns with Recharts)
- Partner sharing (read-only calendar + phase insights via sharing code)
- Medicine tracker with alarms (pill adherence, prenatal vitamins)
- Content platform (bilingual articles on menstrual health, fertility)
- ARIMA prediction (Tier 2 -- auto-activate at 6+ logged cycles)
- Sleep and exercise logging (feeds analytics + future Tier 3 data)
- Email notification channel

**Defer (v2+):**
- Pregnancy week-by-week tracker with ultrasound storage
- LSTM prediction (Tier 3 -- needs 12+ cycles; no population data at launch)
- Menopause/perimenopause tracker
- Anonymous community forum (requires moderation infrastructure)
- Sex life tracking with field encryption (culturally sensitive; opt-in, hidden by default)
- Doctor's report PDF export
- Native iOS/Android apps
- Doctor consultation and health marketplace

**Anti-features (explicitly excluded):**
- AI health chatbot (medical liability without Flo's 120-expert review board)
- Social friending/public profiles (reproductive health is private)
- Gamification streaks/badges (trivializes health tracking; creates anxiety)
- Offline-first local storage (incompatible with multi-profile + partner sharing architecture)
- Wearable integration (Web Bluetooth unreliable; iOS HealthKit web-inaccessible)

### Architecture Approach

The system is a React SPA deployed on Vercel (CDN) communicating via REST/JSON over TLS 1.3 with an Express 5 API on Railway. The API connects to PostgreSQL 16 (persistent data), Redis 7 (caching + job queues), and a BullMQ worker process (background jobs). External services are SSL Wireless SMS, Resend email, and AWS S3. The frontend is structured as a pnpm monorepo with three packages: `web` (React + Vite), `api` (Express + Prisma), and `shared` (Zod schemas, TypeScript types, i18n keys). The shared package is the single source of truth for all type contracts between frontend and backend. Three lazy-loaded frontend applications share one SPA shell: the User App, the Admin Panel (role-gated), and the Partner View (limited read-only access).

**Major components:**
1. Web Frontend (React SPA on Vercel) -- UI rendering, profile switcher, TanStack Query data fetching, Zustand client state, i18n locale switching, PWA service worker
2. API Server (Express 5 on Railway) -- JWT auth, `checkProfileOwnership` middleware on every profile-scoped route, Zod request validation, service layer business logic, Prisma database access
3. BullMQ Worker (separate process on Railway) -- SMS delivery, email delivery, period reminder cron jobs, medicine alarms, prediction recalculation triggers
4. Prediction Engine (Strategy Pattern inside API) -- Tier 1 (simple average, Node.js), Tier 2 (ARIMA npm package), Tier 3 (TensorFlow.js LSTM); factory selects tier based on data point count
5. PostgreSQL 16 -- relational data with Row-Level Security for profile isolation; `prisma-field-encryption` for AES-256-GCM on sensitive fields
6. Shared Package -- Zod schemas and TypeScript types shared at build time between web and api; zero runtime footprint
7. Admin Panel (lazy-loaded SPA section) -- phased delivery: 10-12 launch-critical sections in Phase 1; feature-dependent sections (prediction reports, community management) in later phases

**Key patterns:**
- Profile ownership middleware: every request touching a profileId passes through `checkProfileOwnership(req.user.id, req.params.profileId)` before any data access
- Profile-scoped query keys: TanStack Query keys always include profileId (`["cycles", profileId]`); cache cleared on profile switch
- Strategy pattern for predictions: `getPredictionEngine(dataPointCount)` returns the appropriate tier; implementation is swappable without changing callers
- Services layer: service functions have no Express types (Request/Response) and can be tested without HTTP overhead
- Privacy-first data flows: no third-party SDK touches health event data; all analytics are first-party (logged to PostgreSQL)

### Critical Pitfalls

1. **Multi-profile authorization bypass** -- A user manipulates `profileId` in API requests to access another user's health data. Prevention: `checkProfileOwnership` middleware is the first check on every profile-scoped route, before any business logic. Add `PartnerAccess` model with explicit field-level permissions (never blanket read access). Write 403-assert tests in CI.

2. **Prisma version lock breaking field encryption** -- Upgrading Prisma beyond the tested range silently breaks or crashes `prisma-field-encryption`. Prevention: pin to `^6.13.0` initially; write an integration test that encrypts, stores, retrieves, and decrypts a sensitive field, run it in CI, and never upgrade Prisma without it passing. Document the pin constraint in `package.json` with a comment.

3. **Third-party SDK health data exfiltration (regulatory)** -- Installing Google Analytics, Mixpanel, or Amplitude causes health events to transmit to third parties (the Flo FTC 2021 and Premom FTC 2023 pattern). Prevention: zero third-party analytics touching health events; write a `PRIVACY_ARCHITECTURE.md` before any SDK is installed; audit all outbound data flows before launch.

4. **Bengali text/rendering failures** -- Bengali script requires Noto Sans Bengali font, date-fns `bn` locale, 20-40% more UI space than English, and input method testing (Avro/Probhat). Prevention: load Bengali fonts from day one; test every page in Bengali mode during development with Playwright screenshots in both locales; get client sign-off on Bengali numeral format early.

5. **Prediction accuracy vs. expectation mismatch** -- Client expects LSTM to deliver dramatically higher accuracy than simple averages; research shows the biggest gain is Tier 1 to Tier 2, not Tier 2 to Tier 3. Regular cycles top out near 85-87% regardless of algorithm. Prevention: auto-escalate tiers based on data volume (Tier 1 default, Tier 2 at 6+ cycles, Tier 3 at 12+ cycles); show confidence levels to users; document accuracy benchmarks from published research in the scope document.

6. **Admin panel scope explosion (26 sections)** -- 26 admin sections treated as one line item can consume 60-70% of total development hours. Prevention: tier sections by dependency (launch-critical vs. feature-dependent); estimate each section separately; propose phased delivery in scope document (10-12 sections in Phase 1).

7. **TanStack Query cache leakage on profile switch** -- Switching profiles shows previous profile's health data briefly. Prevention: always include `profileId` in all query keys; clear cache on profile switch; create a `useProfileQuery` abstraction.

8. **CORS misconfiguration (Vercel + Railway split)** -- `credentials: true` + `origin: "*"` is browser-rejected. Prevention: whitelist exact Vercel domain + preview pattern in environment variable; configure `credentials: true` with explicit origin.

---

## Implications for Roadmap

### Phase 1: Foundation and Security Bedrock

**Rationale:** Multi-profile auth and data isolation are the first things to get right. Every feature built afterward inherits this foundation. A mistake here means retrofitting authorization checks across hundreds of endpoints. Field encryption constraints (Prisma version pin) and privacy architecture (no third-party health event tracking) must be established before any feature code is written.

**Delivers:** Monorepo structure, pnpm + Turborepo, shared types package, Express 5 upgrade, PostgreSQL schema with multi-profile model, Prisma 6.x pinned with encryption integration test, `checkProfileOwnership` middleware, JWT auth (access + refresh tokens in HttpOnly cookies), Redis setup, basic CI pipeline, `PRIVACY_ARCHITECTURE.md`, basic React shell with React Router lazy-loading, i18n infrastructure (i18next initialized, both locale files scaffolded, Bengali fonts loaded).

**Addresses:** Authentication (table stakes), multi-profile account system (core differentiator), bilingual foundation (non-negotiable for Bangladesh market)

**Avoids:** Pitfall 1 (multi-profile auth bypass), Pitfall 2 (Prisma encryption), Pitfall 3 (third-party data exfiltration), Pitfall 7 (TanStack Query cache leakage)

**Research flag:** Standard patterns -- well-documented. No additional phase research needed.

---

### Phase 2: Core Cycle Tracking (Table Stakes)

**Rationale:** Once the foundation is solid, build the reason users come to the product. These features have well-documented patterns and low risk. i18n infrastructure from Phase 1 must be in place before any UI work begins here.

**Delivers:** Period start/end logging, flow intensity, cycle day counter, phase display (follicular/ovulatory/luteal/menstrual), Tier 1 prediction (rolling average of last 3-6 cycles), calendar view with color-coded phases, fertile window and ovulation display, retroactive date editing, profile switcher UI (always accessible), onboarding wizard (goal selection, data collection, trust screens), responsive design + PWA manifest, Bengali translations for all cycle and onboarding strings.

**Addresses:** Period tracking, next period prediction, calendar view, fertile window display, cycle settings, onboarding flow (all table stakes)

**Avoids:** Pitfall 4 (Bengali rendering -- test every page in both locales from this phase forward), Pitfall 5 (prediction expectations -- show confidence and ranges, never single-point predictions), Pitfall 7 (ovulation medical liability -- disclaimers on every prediction screen)

**Research flag:** Standard patterns -- well-documented cycle calculation algorithms. No additional research needed.

---

### Phase 3: Symptom Logging and Notifications

**Rationale:** Symptom logging drives the data collection that makes advanced features (analytics, Tier 2/3 predictions) valuable. Notifications are the retention layer -- users who do not log regularly get no value from predictions. BullMQ worker process must be stood up in this phase.

**Delivers:** Symptom logging (top 25 symptoms, 6 categories, icon-based tap selection), one log per symptom per day, BullMQ worker setup, web push notifications (service worker), period prediction alerts, fertile window alerts, logging nudge reminders, notification preference toggles, medicine tracker with alarms (BullMQ delayed jobs), profile-scoped symptom data, Bengali symptom labels and notification strings.

**Addresses:** Symptom logging (table stakes), notification/reminder system (table stakes), notification preferences, medicine tracker (differentiator)

**Avoids:** Pitfall 8 (SMS provider reliability -- web push first, validate engagement before SMS)

**Research flag:** BullMQ + web push service worker setup may need brief phase research to confirm patterns for the Railway deployment model.

---

### Phase 4: Admin Panel (Launch-Critical Sections)

**Rationale:** Client requires operational tooling from launch. Scoping this as a dedicated phase prevents scope explosion. Only launch-critical sections ship here; feature-dependent sections (prediction reports, community management) follow the features they monitor.

**Delivers:** Admin auth (separate role, `requireRole('admin')` middleware), admin dashboard (user metrics, account/profile counts, activity charts with Recharts), user management (list, search, view, suspend, delete), security and access control (active session listing, force-logout, admin audit log), basic data export (CSV), admin-scoped API endpoints, admin SPA section (lazy-loaded, role-gated).

**Addresses:** Admin panel (10-12 launch-critical sections out of 26)

**Avoids:** Pitfall 6 (admin scope explosion -- this phase is scoped explicitly; remaining sections are tagged as feature-dependent)

**Research flag:** Standard patterns (shadcn/ui data tables, RBAC). No additional research needed.

---

### Phase 5: Health Analytics and Partner Sharing

**Rationale:** After users have been onboarding and logging for 1-3 cycles, analytics become meaningful. Partner sharing is Flo's most-requested feature and directly serves the Bangladesh family health model. Both features depend on accumulated data and the core tracking infrastructure.

**Delivers:** Health analytics dashboard (cycle length trends, symptom frequency by phase, mood patterns, sleep/exercise overlays with Recharts), sleep and exercise manual logging, partner sharing system (sharing code generation, read-only Partner View SPA section with calendar + phase insights), partner permission model (`PartnerAccess` with explicit field grants, no sex life or medical notes access), revocation from primary user settings, ARIMA prediction (Tier 2 -- auto-activated for profiles with 6+ logged cycles), analytics admin sections in admin panel.

**Addresses:** Health analytics dashboard (differentiator), partner sharing (differentiator), sleep/exercise logging (differentiator), ARIMA prediction (differentiator)

**Avoids:** Pitfall 1 (partner access must use `checkPartnerAccess` scoped projection, not full profile read)

**Research flag:** ARIMA npm package in production Node.js context may need validation research (currently MEDIUM confidence -- AutoARIMA configuration for cycle data is not well-documented).

---

### Phase 6: Content Platform and SMS Notifications

**Rationale:** Content fills the critical educational gap in the Bangladesh market and drives retention between logging events. SMS adds the notification channel most relevant to Bangladesh's mobile-first users. Both require backend work (CMS, SMS gateway) that builds on the BullMQ infrastructure from Phase 3.

**Delivers:** Content CMS (admin side -- article and video creation, bilingual, category tagging, phase-specific recommendations), content feed (user side -- article cards, phase-specific surfacing), SSL Wireless SMS integration (direct HTTP wrapper, not npm package), SMS delivery tracking (`queued`/`sent`/`delivered`/`failed`), Alpha Net BD fallback provider, BullMQ SMS jobs with exponential backoff, SMS reminder delivery for period predictions and medicine alarms, email notification channel (Resend), email reminder templates (period predictions, password reset, welcome), admin notification management sections.

**Addresses:** Content platform (differentiator), SMS reminders (Bangladesh market requirement), email notifications

**Avoids:** Pitfall 8 (SMS provider reliability -- direct HTTP wrapper, delivery tracking, fallback provider, IP whitelisting with SSL Wireless upfront)

**Research flag:** SSL Wireless API integration needs dedicated phase research. Documentation is described as "inadequate" for Node.js. The API itself is reportedly simple but underdocumented. Budget 2x the normal SMS integration estimate.

---

### Phase 7: Extended Health Modules

**Rationale:** Pregnancy tracker, menopause mode, and sex life tracking expand Vesta from a cycle app into a full reproductive lifecycle platform. These are higher-complexity modules that depend on the core tracking and notification infrastructure being stable. Sex life tracking requires field-level encryption and cultural sensitivity controls.

**Delivers:** Pregnancy week-by-week tracker (gestational age calculator, baby size milestones, pregnancy symptom logging, due date display, appointment tracker), ultrasound image upload (Multer + S3 presigned URLs), kick counter, pregnancy mode UI shift (color scheme + dashboard reconfiguration), menopause/perimenopause tracker (hot flashes, night sweats, irregular cycle mode, brain fog -- mode switch that changes dashboard), sex life tracking (opt-in, hidden by default, separate PIN lock, TTC fertile window correlation -- field-level encrypted storage), Ramadan fasting mode (cycle prediction adjustment note), admin sections for pregnancy and health module analytics.

**Addresses:** Pregnancy tracker (differentiator), menopause tracker (differentiator), sex life tracking (differentiator), Ramadan cultural consideration

**Avoids:** Pitfall 9 (encrypted field query limitations -- document "no query on encrypted fields" before sex life code is written), Pitfall 10 (cultural sensitivity -- sex life tracking hidden by default, separate PIN, partnership language neutral)

**Research flag:** S3 multipart upload for ultrasound images and Prisma field encryption for sex life data both warrant brief phase research to confirm integration patterns.

---

### Phase 8: LSTM Prediction and Community

**Rationale:** Tier 3 predictions require 12+ months of accumulated user data from real usage -- this is not buildable earlier. The anonymous community is high-engagement but requires moderation infrastructure, content policies, and active management capacity. Both are v2 features contingent on product-market fit.

**Delivers:** LSTM prediction engine (TensorFlow.js, multi-factor inputs: cycle lengths, symptoms, lifestyle, age), auto-escalation from Tier 2 to Tier 3 at 12+ cycles, prediction accuracy dashboard in admin panel (predicted vs. actual per tier, per cohort), anonymous community forum (random avatars, pre-moderation queue, category topics, age-gating), community moderation admin sections, doctor report PDF export (6-month cycle summary).

**Addresses:** LSTM prediction (Tier 3 differentiator), anonymous community forum (differentiator), doctor's report export

**Avoids:** Pitfall 5 (prediction accuracy expectations -- accuracy metrics in admin panel, confidence levels shown to users)

**Research flag:** TensorFlow.js LSTM training pipeline and cold-start strategy (using published research datasets before real user data accumulates) need dedicated research. Community moderation pipeline (human vs. AI-assisted) needs planning. Both are MEDIUM-confidence areas.

---

### Phase Ordering Rationale

- Foundation before features: multi-profile auth and Prisma encryption constraints affect every subsequent phase
- i18n before UI: Bengali infrastructure must precede any UI component; retrofitting is a full rewrite
- Table stakes before differentiators: cycle tracking before analytics before community
- BullMQ before notifications: job queue infrastructure is shared by SMS, email, and medicine alarms
- Data accumulation gates advanced ML: ARIMA at Phase 5 requires 6+ real cycles; LSTM at Phase 8 requires 12+ cycles
- Admin sections track the features they monitor: admin panel is phased across the roadmap, not batched
- Cultural and legal constraints front-loaded: `PRIVACY_ARCHITECTURE.md`, medical disclaimers, and consent model belong in Phase 1/2, not as afterthoughts

### Research Flags

**Phases needing deeper research before planning:**
- **Phase 5 (ARIMA):** `arima` npm package AutoARIMA configuration for menstrual cycle data -- MEDIUM confidence; only ~10 npm dependents; needs validation with sample cycle datasets before estimating
- **Phase 6 (SMS):** SSL Wireless API integration -- documentation described as "inadequate for Node.js"; need to prototype the HTTP wrapper and confirm delivery receipt format before estimating
- **Phase 8 (LSTM + Community):** TensorFlow.js LSTM training pipeline, cold-start strategy using published datasets, and community moderation approach -- both are MEDIUM/LOW confidence areas with high implementation complexity

**Phases with standard patterns (skip phase research):**
- **Phase 1 (Foundation):** pnpm monorepo, JWT auth, Prisma, Express 5 -- all well-documented
- **Phase 2 (Core Tracking):** cycle math is deterministic; calendar UI patterns are well-established
- **Phase 3 (Symptoms + Notifications):** BullMQ job setup and web push service workers are well-documented
- **Phase 4 (Admin Panel):** shadcn/ui data tables + RBAC are standard patterns

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against official docs and changelogs. The Prisma 6.13 encryption ceiling is the one unverified claim -- confirmed by the library's own README but v6.19 compatibility needs an integration test to validate. |
| Features | HIGH | Based on Flo product research, Bangladesh market data (BTRC, Aponjon), and direct competitor analysis. MVP definition is well-grounded. Anti-features are explicitly reasoned. |
| Architecture | HIGH | Standard patterns (Express + PostgreSQL + BullMQ + Vercel/Railway) with well-understood complexity spikes (multi-profile RLS, field encryption query limitations). Strategy Pattern for prediction engine is appropriate and extensible. |
| Pitfalls | HIGH | 7 critical and 5 moderate pitfalls documented with specific prevention strategies. Two pitfalls (Flo FTC 2021, Premom FTC 2023) are based on real regulatory actions -- high confidence that they are real risks. |

**Overall confidence:** HIGH

### Gaps to Address

- **Prisma 6.19 vs. 6.13 for field encryption:** Write the encryption integration test in Phase 1 and run it immediately. If 6.19 fails, pin to 6.13 and document it. This gap has a clear resolution path.
- **SSL Wireless API documentation:** The npm package is underdocumented. Phase 6 research should prototype the direct HTTP API before estimation. Verify IP whitelisting requirements and delivery receipt format with SSL Wireless support.
- **ARIMA configuration for menstrual data:** The `arima` npm package has sparse usage examples. Phase 5 research should run AutoARIMA against a published menstrual cycle dataset (e.g., the Sympto-Thermal dataset or Apple Women's Health Study data) before committing to this approach.
- **TensorFlow.js LSTM cold-start strategy:** Flo's model accuracy relies on 450GB+ of training data. At launch, Vesta has zero. Phase 8 research must identify published, licensed menstrual cycle datasets for initial model training. The CLUE dataset (125K cycles) and the Apple Women's Health Study are known candidates.
- **Multi-profile consent model (ethical):** The research identifies a real ethical risk (controlling family members using the multi-profile model for surveillance). The consent mechanism, profile privacy settings, and independent account claiming path need legal and cultural review, ideally before Phase 1 scope is finalized.
- **Bangladesh Data Protection Act compliance:** The 2023 draft act (cabinet-approved, pending enactment) classifies health data as "sensitive" and requires 72-hour breach notification. Monitor for enactment; compliance may affect data retention policies and privacy architecture.

---

## Sources

### Primary (HIGH confidence)

- [React Versions](https://react.dev/versions) -- React 19.2.4 latest stable
- [Vite Releases](https://vite.dev/releases) -- Vite 8.0.2 latest, v6 LTS supported
- [Tailwind CSS v4.0](https://tailwindcss.com/blog/tailwindcss-v4) -- v4.2 latest, CSS-first config
- [Express.js](https://expressjs.com/) -- Express 5.2.1 stable with promise error handling, ReDoS fix
- [Prisma Changelog](https://www.prisma.io/changelog) -- Prisma 6.19.0, Prisma 7.2.0
- [TanStack Query](https://tanstack.com/query/latest) -- v5 stable with React 19
- [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4) -- Full Tailwind v4 + React 19 support
- [BullMQ](https://bullmq.io/) -- v5.71 latest
- [Resend Pricing](https://resend.com/pricing) -- 3,000 emails/month free
- [prisma-field-encryption](https://github.com/47ng/prisma-field-encryption) -- Supports Prisma 4.7.0 to 6.13.0
- [HIPAA Encryption 2025](https://censinet.com/perspectives/hipaa-encryption-protocols-2025-updates) -- AES-256 at rest, TLS 1.3 in transit
- [arima npm](https://www.npmjs.com/package/arima) -- v0.2.8, ARIMA/SARIMA/AutoARIMA for Node.js
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html) -- helmet + cors + rate-limit baseline
- FTC complaint against Flo Health (2021) -- regulatory precedent for reproductive health data sharing
- FTC complaint against Premom (2023) -- $200K fine, Health Breach Notification Rule

### Secondary (MEDIUM confidence)

- [Password Hashing Guide 2025](https://guptadeepak.com/the-complete-guide-to-password-hashing-argon2-vs-bcrypt-vs-scrypt-vs-pbkdf2-2026/) -- Argon2id recommended for new projects
- [SSL Wireless SMS npm](https://www.npmjs.com/package/ssl-wireless-sms-send) -- Bangladesh SMS gateway npm package
- [Alpha SMS API](https://www.alpha.net.bd/sms/) -- Fallback Bangladesh SMS provider
- [TensorFlow.js](https://www.tensorflow.org/js) -- LSTM in Node.js viable; 38% speed claim from single benchmark
- [Railway vs Vercel](https://docs.railway.com/platform/compare-to-vercel) -- Railway for persistent Express.js processes
- [Resend vs SendGrid 2025](https://medium.com/@nermeennasim/email-apis-in-2025-sendgrid-vs-resend-vs-aws-ses-a-developers-journey-8db7b5545233) -- Resend superior DX, better free tier
- [React i18next](https://react.i18next.com/) -- Bengali locale fully supported
- Flo app product analysis -- feature landscape, onboarding patterns, engagement drivers
- Maya app analysis (~350K MAU, Bangladesh mobile-only competitor)
- Bangladesh BTRC regulations -- Bengali required for bulk SMS
- Bangladesh internet penetration statistics (48.9% internet, 98% Bengali-speaking)

### Tertiary (LOW confidence -- needs validation)

- Prisma 6.19 compatibility with prisma-field-encryption -- README says ceiling is 6.13; 6.19 untested
- ssl-wireless-sms-send npm package quality -- documentation described as inadequate; may need direct HTTP wrapper
- TensorFlow.js LSTM 38% speed advantage -- single-source benchmark, not independently verified
- Bangladesh Data Protection Act 2023 -- cabinet-approved draft; enactment timeline and final provisions uncertain

---

*Research completed: 2026-03-26*
*Ready for roadmap: yes*
