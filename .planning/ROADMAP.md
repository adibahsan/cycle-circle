# Roadmap: Vesta

## Overview

Vesta delivers a bilingual, multi-profile reproductive health platform for the Bangladesh market in four phases. Phase 1 establishes the multi-profile account architecture, bilingual infrastructure, privacy model, and onboarding -- the foundation every subsequent feature inherits. Phase 2 builds the core product: cycle tracking, calendar, fertility display, symptom logging, and the three-tier prediction engine. Phase 3 adds the engagement and retention layer: notifications via email/SMS, educational content, and partner sharing. Phase 4 delivers the admin panel the client requires for launch operations. Every phase produces a coherent, verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation, Auth, and Multi-Profile System** - Account system with multi-profile architecture, bilingual infrastructure, privacy model, and onboarding flow
- [ ] **Phase 2: Core Cycle Tracking and Predictions** - Period tracking, calendar, fertility display, symptom logging, and three-tier prediction engine
- [ ] **Phase 3: Engagement Layer** - Notifications and reminders, educational content platform, and partner sharing system
- [ ] **Phase 4: Admin Panel** - Operational dashboard, user management, analytics, content management, and security controls

## Phase Details

### Phase 1: Foundation, Auth, and Multi-Profile System
**Goal**: Users can create accounts, manage multiple health profiles for family members, complete onboarding in English or Bengali, and trust that their data is private and secure
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, ONBD-01, ONBD-02, ONBD-03, ONBD-04, ONBD-05, ONBD-06, I18N-01, I18N-02, I18N-03, I18N-04, PRIV-01, PRIV-02, PRIV-03, PRIV-04, PRIV-05
**Success Criteria** (what must be TRUE):
  1. User can sign up with email/password, verify email, log in, and stay logged in across browser sessions
  2. User can create multiple health profiles (with name, relation type, DOB, cycle data), switch between them, edit them, and delete them -- and all data is isolated per profile
  3. User completes onboarding (trust screens, goal selection, cycle history, personal data) and receives a first cycle prediction without prior logged data
  4. User can switch the entire UI between English and Bengali at any time, with dates and numbers adapting to the selected language, and Bengali is the default for Bangladesh-based users
  5. Health data is encrypted at field level in the database, account deletion removes all data, privacy policy and terms of service are available in both languages, and multi-profile consent is obtained
**Plans**: 5 plans

Plans:
- [ ] 01-01-PLAN.md -- Monorepo setup, shared contracts, Prisma schema with field encryption
- [ ] 01-02-PLAN.md -- Authentication system (Express 5 server, JWT, email verification, password reset)
- [ ] 01-03-PLAN.md -- Bilingual i18n infrastructure (English + Bengali), privacy/ToS pages
- [ ] 01-04-PLAN.md -- Multi-profile CRUD with ownership middleware, Tier 1 prediction, profile switcher
- [ ] 01-05-PLAN.md -- Onboarding wizard, dashboard, account deletion

### Phase 2: Core Cycle Tracking and Predictions
**Goal**: Users can track their periods, view their cycle on a calendar, understand their fertile window, log symptoms, and receive increasingly accurate predictions as data accumulates
**Depends on**: Phase 1
**Requirements**: CYCL-01, CYCL-02, CYCL-03, CYCL-04, CYCL-05, CYCL-06, CALR-01, CALR-02, CALR-03, CALR-04, FERT-01, FERT-02, FERT-03, SYMP-01, SYMP-02, SYMP-03, SYMP-04, SYMP-05, SYMP-06, SYMP-07, SYMP-08, PRED-01, PRED-02, PRED-03, PRED-04, PRED-05
**Success Criteria** (what must be TRUE):
  1. User can log period start (with flow intensity in 2-3 taps) and end date, edit past entries retroactively, and see predictions recalculate immediately when new data is logged
  2. Dashboard prominently shows current cycle day, phase name (follicular/ovulatory/luteal/menstrual), and days until next period -- cycle day is the largest UI element
  3. Calendar displays a full month with color-coded markers for period, fertile window, ovulation, and low-fertility days, shows predicted future periods and fertile windows, and allows tapping any date to view or edit logged data
  4. User can log symptoms via icon-based tap selection across physical, mood, discharge, and lifestyle categories, customize which categories appear, edit same-day logs, and logged symptoms feed into the prediction engine
  5. Prediction engine starts with Tier 1 (rolling average) from cycle 1, auto-escalates to Tier 2 (ARIMA) at 6+ cycles and Tier 3 (LSTM) at 12+ cycles, and shows prediction confidence to the user
**Plans**: 6 plans

Plans:
- [ ] 02-01-PLAN.md -- Shared contracts (Zod schemas, types, constants, phase calculations) and Prisma schema additions (CycleLog, SymptomLog, Prediction models)
- [ ] 02-02-PLAN.md -- Three-tier prediction engine (Strategy Pattern): Tier 1 rolling average, Tier 2 ARIMA wrapper, Tier 3 LSTM stub, factory with auto-escalation
- [ ] 02-03-PLAN.md -- Cycle tracking API (period start/end, retroactive editing, validation) and prediction service with BullMQ recalculation
- [ ] 02-04-PLAN.md -- Symptom logging vertical slice: REST API (CRUD, preferences, prediction integration) and frontend icon-based UI
- [ ] 02-05-PLAN.md -- Dashboard: cycle ring hero, phase display, fertile window, TTC tips, period logger (2-3 taps), prediction confidence
- [ ] 02-06-PLAN.md -- Calendar: color-coded month grid, logged vs predicted distinction, day detail panel, retroactive editing, month navigation

### Phase 3: Engagement Layer
**Goal**: Users stay engaged through timely notifications, learn from culturally relevant health content, and can share cycle information with partners
**Depends on**: Phase 2
**Requirements**: NOTF-01, NOTF-02, NOTF-03, NOTF-04, NOTF-05, NOTF-06, NOTF-07, CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, PRTN-01, PRTN-02, PRTN-03, PRTN-04, PRTN-05, PRTN-06
**Success Criteria** (what must be TRUE):
  1. User receives period prediction, logging reminder, and fertile window alerts via email and SMS -- notifications route correctly per-profile in multi-profile accounts, SMS delivers in Bengali via SSL Wireless, and user can toggle each notification type on or off
  2. User can browse bilingual health articles categorized by topic and tagged by cycle phase, sees phase-specific content recommendations on the dashboard, and content addresses Bangladeshi cultural context
  3. Profile owner can generate a sharing code for a partner, partner gets read-only access to cycle calendar and phase insights (with daily updates and fertile window visibility in TTC mode), partner cannot see symptoms or edit data, and primary user can revoke access instantly
**Plans**: 4 plans

Plans:
- [ ] 03-01-PLAN.md -- Shared infrastructure: Prisma schema (6 new models), BullMQ queues, SMS/email delivery utilities, notification preferences API
- [ ] 03-02-PLAN.md -- Notification delivery pipeline: React Email templates, cron job processors, multi-profile routing, notification settings UI
- [ ] 03-03-PLAN.md -- Content platform: article service with phase-based filtering, browsing pages, dashboard content feed, bilingual seed data
- [ ] 03-04-PLAN.md -- Partner sharing: share code lifecycle, read-only access middleware, daily partner insights, partner frontend

### Phase 4: Admin Panel
**Goal**: Operations team can monitor platform health, manage users, oversee content, track prediction accuracy, and export data for analysis
**Depends on**: Phase 3
**Requirements**: ADMN-01, ADMN-02, ADMN-03, ADMN-04, ADMN-05, ADMN-06, ADMN-07, ADMN-08, ADMN-09, ADMN-10, ADMN-11, ADMN-12, ADMN-13, ADMN-14
**Success Criteria** (what must be TRUE):
  1. Admin dashboard displays total/active users, profiles created, and tracking activity metrics with visual charts for daily new users, monthly active users, and profile creation trends
  2. Admin can list, view, suspend, reactivate, delete users, and reset passwords -- with Super Admin and Content Admin role separation and full security/access controls
  3. Admin can view aggregated population-level health insights (average cycle length, irregular cycle percentage, common symptoms), prediction accuracy reports (predicted vs actual, accuracy percentages), feature usage reports, alert engagement reports, multi-profile usage analytics, and data completeness reports
  4. Admin can create, edit, and delete content articles, manage categories and languages, control notification/reminder types, send broadcast notifications, and export analytics data as CSV or Excel
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation, Auth, and Multi-Profile System | 0/5 | Planned | - |
| 2. Core Cycle Tracking and Predictions | 0/6 | Planned | - |
| 3. Engagement Layer | 0/4 | Planned | - |
| 4. Admin Panel | 0/2 | Not started | - |
