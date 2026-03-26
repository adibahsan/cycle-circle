# Requirements: Vesta

**Defined:** 2026-03-26
**Core Value:** Enable families in Bangladesh to track and understand reproductive health for multiple women from a single account, with accurate cycle predictions and actionable health insights.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication & Multi-Profile

- [ ] **AUTH-01**: User can create account with email and password
- [ ] **AUTH-02**: User receives email verification after signup
- [ ] **AUTH-03**: User can reset password via email link
- [ ] **AUTH-04**: User session persists across browser refresh (JWT)
- [ ] **AUTH-05**: User can create multiple health profiles with name, relation type (self/wife/sister/mother/daughter/girlfriend), date of birth, height, weight, cycle length, last period date
- [ ] **AUTH-06**: User can switch between profiles via profile switcher UI
- [ ] **AUTH-07**: All health data is scoped to individual profiles (per-profile data isolation)
- [ ] **AUTH-08**: User can edit or delete any profile they manage

### Partner Sharing

- [ ] **PRTN-01**: Profile owner generates sharing code for partner
- [ ] **PRTN-02**: Partner gets read-only access to current cycle calendar and phase insights
- [ ] **PRTN-03**: Partner receives daily insights about partner's current phase
- [ ] **PRTN-04**: Partner sees fertile window visibility (if TTC mode)
- [ ] **PRTN-05**: Partner cannot see logged symptoms or edit any data
- [ ] **PRTN-06**: Primary user can revoke partner access instantly

### Onboarding

- [ ] **ONBD-01**: New user sees trust/privacy screens before entering personal data
- [ ] **ONBD-02**: User selects primary health goal (track period, try to conceive)
- [ ] **ONBD-03**: User enters cycle history (last period date, cycle length estimate, period duration)
- [ ] **ONBD-04**: User enters personal data (date of birth, height, weight)
- [ ] **ONBD-05**: App generates first prediction after onboarding without prior logged data
- [ ] **ONBD-06**: Onboarding flow supports both English and Bengali

### Period Tracking & Cycle Dashboard

- [ ] **CYCL-01**: User can log period start with flow intensity (light/medium/heavy) in 2-3 taps
- [ ] **CYCL-02**: User can log period end date
- [ ] **CYCL-03**: User can see current cycle day, phase name (follicular, ovulatory, luteal, menstrual), and days until next period at a glance
- [ ] **CYCL-04**: Dashboard shows cycle day as the largest/most prominent UI element
- [ ] **CYCL-05**: Predictions recalculate immediately when user logs new data
- [ ] **CYCL-06**: User can edit or correct past period dates retroactively

### Calendar

- [ ] **CALR-01**: User can view full month calendar with color-coded markers (red/pink = period, teal = fertile window, accent = ovulation, muted = low-fertility)
- [ ] **CALR-02**: Calendar shows predicted future periods and fertile windows
- [ ] **CALR-03**: User can tap any date to view/edit logged data for that day
- [ ] **CALR-04**: Calendar supports navigating to past and future months

### Ovulation & Fertility

- [ ] **FERT-01**: Fertile window (5 days before ovulation + ovulation day) displayed on calendar and dashboard
- [ ] **FERT-02**: Ovulation day clearly marked with distinct visual indicator
- [ ] **FERT-03**: TTC mode shows daily conception tips based on cycle phase

### Symptom Logging

- [ ] **SYMP-01**: User can log symptoms via icon-based tap selection (not text-heavy forms)
- [ ] **SYMP-02**: Physical symptoms available: cramps, headache, breast tenderness, bloating, back pain, fatigue, nausea, acne
- [ ] **SYMP-03**: Mood/emotional symptoms available: calm, sad, happy, anxious, mood swings, irritable, energetic, depressed
- [ ] **SYMP-04**: Vaginal discharge tracking: sticky, creamy, watery, egg white, spotting, atypical
- [ ] **SYMP-05**: Lifestyle factors: sleep quality, water intake, exercise, weight, stress
- [ ] **SYMP-06**: User can customize which symptom categories appear on their logging screen
- [ ] **SYMP-07**: User can edit a symptom log already submitted for the current day
- [ ] **SYMP-08**: Logged symptoms feed into prediction engine and content personalization

### Prediction Engine (Three Tiers -- Estimated Separately)

- [ ] **PRED-01**: Tier 1 (Simple Average) -- rolling average of last 3-6 cycle lengths for next period prediction; works from cycle 1
- [ ] **PRED-02**: Tier 2 (ARIMA) -- time-series statistical model; activates after 6+ logged cycles
- [ ] **PRED-03**: Tier 3 (LSTM/ML) -- neural network with multi-factor inputs (symptoms, lifestyle, age); activates after 12+ logged cycles
- [ ] **PRED-04**: System auto-escalates prediction tier as data accumulates (Tier 1 -> 2 -> 3)
- [ ] **PRED-05**: Prediction accuracy visible to user (confidence percentage)

### Notifications & Reminders

- [ ] **NOTF-01**: Period start prediction alert via email and SMS
- [ ] **NOTF-02**: Period logging reminder via email and SMS
- [ ] **NOTF-03**: Fertile window alert via email and SMS
- [ ] **NOTF-04**: User can toggle each notification type on/off
- [ ] **NOTF-05**: Notification routing works per-profile in multi-profile system
- [ ] **NOTF-06**: SMS delivery via SSL Wireless (Bangladesh provider)
- [ ] **NOTF-07**: SMS content in Bengali per BTRC requirements

### Content Platform

- [ ] **CONT-01**: Blog-style articles on menstrual health, fertility, reproductive wellness
- [ ] **CONT-02**: All content available in English and Bengali
- [ ] **CONT-03**: Content categorized by topic and tagged by cycle phase
- [ ] **CONT-04**: Phase-specific content recommendations on dashboard
- [ ] **CONT-05**: Content addresses Bangladeshi cultural context and menstrual myths

### Bilingual Support

- [ ] **I18N-01**: Every UI string translatable between English and Bengali
- [ ] **I18N-02**: User can switch language at any time
- [ ] **I18N-03**: Date and number formatting adapts to selected language
- [ ] **I18N-04**: Bengali language is the default for Bangladesh-based users

### Privacy & Security

- [ ] **PRIV-01**: Health data (symptoms, cycle data) encrypted at field level in database
- [ ] **PRIV-02**: User can delete their account and all associated data
- [ ] **PRIV-03**: Clear privacy policy explaining multi-profile data handling
- [ ] **PRIV-04**: Terms of service available in English and Bengali
- [ ] **PRIV-05**: Multi-profile consent mechanism (profile owner acknowledgment)

### Admin Panel

- [ ] **ADMN-01**: Admin dashboard showing total/active users, profiles created, tracking activity metrics
- [ ] **ADMN-02**: Visual charts: daily new users, monthly active users, profile creation trends
- [ ] **ADMN-03**: User management: list, view details, suspend, reactivate, delete, reset password
- [ ] **ADMN-04**: Profile monitoring: aggregated cycle insights (privacy-protected)
- [ ] **ADMN-05**: Health data analytics: aggregated population-level insights (average cycle length, irregular cycle %, common symptoms)
- [ ] **ADMN-06**: Prediction accuracy reports: predicted vs actual dates, accuracy percentages
- [ ] **ADMN-07**: Content management system: create/edit/delete articles, manage categories and languages
- [ ] **ADMN-08**: Notification management: control reminder types, broadcast notifications
- [ ] **ADMN-09**: Security & access control: Super Admin, Content Admin roles
- [ ] **ADMN-10**: Data export: analytics/research data as CSV or Excel
- [ ] **ADMN-11**: Feature usage report: usage percentages per feature area
- [ ] **ADMN-12**: Alert engagement report: reminders delivered, opened, action taken
- [ ] **ADMN-13**: Multi-profile usage analytics: accounts, profiles per account, relation type breakdown
- [ ] **ADMN-14**: Data completeness report: complete vs partial vs inactive profiles

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Pregnancy

- **PREG-01**: Switch to pregnancy mode with due date or LMP entry
- **PREG-02**: Week-by-week fetal development visualization
- **PREG-03**: Pregnancy-specific symptom logging (nausea, swelling, fatigue)
- **PREG-04**: Appointment tracking and ultrasound image storage
- **PREG-05**: Due date, hCG, IVF/FET calculators
- **PREG-06**: Baby kick counter
- **PREG-07**: Weekly checklists (prenatal appointments, childbirth classes)

### Medicine Tracker

- **MEDC-01**: Add medicines with name, dosage, schedule, duration
- **MEDC-02**: Automated reminders at scheduled times
- **MEDC-03**: Mark medicine as taken or missed
- **MEDC-04**: Medicine history and adherence tracking
- **MEDC-05**: Per-profile medicine tracking

### Sleep Monitor

- **SLEP-01**: Log sleep duration, start/wake times, quality
- **SLEP-02**: Correlate sleep patterns with cycle phases
- **SLEP-03**: Predict mood and fatigue based on sleep + cycle

### Exercise Tracking

- **EXRC-01**: Log steps, workouts, calories burned
- **EXRC-02**: Analyze exercise vs. cycle regularity correlation
- **EXRC-03**: Cycle-phase-appropriate exercise insights

### Sex Life Tracking

- **SXLF-01**: Log intercourse date and protection status (encrypted, opt-in)
- **SXLF-02**: Fertility window matching for pregnancy probability
- **SXLF-03**: Libido pattern tracking

### Health Analytics

- **ANLT-01**: Monthly charts showing period history and cycle variation
- **ANLT-02**: Symptom frequency analysis with insights
- **ANLT-03**: Sleep and exercise correlation with cycle phases
- **ANLT-04**: Exportable health report as PDF for doctor visits

### Menopause & Perimenopause

- **MNPS-01**: Perimenopause mode switch for women 40+
- **MNPS-02**: Track hot flashes, night sweats, mood changes, irregular cycles
- **MNPS-03**: Menopause symptom pattern analysis

### Anonymous Community

- **COMM-01**: Anonymous posting with random avatars
- **COMM-02**: Pre-moderation of all posts
- **COMM-03**: Topic categorization, comments, upvotes
- **COMM-04**: Content reporting and age-gating (under-18/over-18)

### Monetization

- **MONE-01**: Doctor consultation booking system
- **MONE-02**: Health product marketplace
- **MONE-03**: Sponsored content/advertising

### Extended Features

- **EXTD-01**: Food & recipe suggestions (area-based, cycle-phase-specific)
- **EXTD-02**: Video content (doctor interviews, health guides)
- **EXTD-03**: Native mobile apps (iOS/Android)
- **EXTD-04**: Wearable/smartwatch integration
- **EXTD-05**: AI health chatbot (rule-based then LLM-based)
- **EXTD-06**: Web push notifications (in addition to SMS/email)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Native mobile apps | Web-first validates PMF; triples cost. PWA covers 80% of native UX. Phase 2. |
| AI health chatbot | Enormous medical liability without 120+ expert advisory board. Use curated content instead. |
| Real-time WebSocket features | Cycle data changes once/day max. Polling is sufficient. Massive infrastructure overhead for zero user value. |
| Gamification (streaks, badges) | Trivializes health tracking. Period tracking is not a game. Creates anxiety during irregular cycles. |
| Social features (profiles, following) | Reproductive health is deeply private. Anonymous community only (v2). |
| Offline-first/local storage | Multi-profile architecture fundamentally requires server-side data. |
| Symptom prediction | Requires massive training data Vesta doesn't have at launch. Inaccurate predictions erode trust. |
| OAuth/social login | Email/password sufficient for v1. Social login adds complexity with minimal benefit for Bangladesh market. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| AUTH-06 | Phase 1 | Pending |
| AUTH-07 | Phase 1 | Pending |
| AUTH-08 | Phase 1 | Pending |
| PRTN-01 | Phase 3 | Pending |
| PRTN-02 | Phase 3 | Pending |
| PRTN-03 | Phase 3 | Pending |
| PRTN-04 | Phase 3 | Pending |
| PRTN-05 | Phase 3 | Pending |
| PRTN-06 | Phase 3 | Pending |
| ONBD-01 | Phase 1 | Pending |
| ONBD-02 | Phase 1 | Pending |
| ONBD-03 | Phase 1 | Pending |
| ONBD-04 | Phase 1 | Pending |
| ONBD-05 | Phase 1 | Pending |
| ONBD-06 | Phase 1 | Pending |
| CYCL-01 | Phase 2 | Pending |
| CYCL-02 | Phase 2 | Pending |
| CYCL-03 | Phase 2 | Pending |
| CYCL-04 | Phase 2 | Pending |
| CYCL-05 | Phase 2 | Pending |
| CYCL-06 | Phase 2 | Pending |
| CALR-01 | Phase 2 | Pending |
| CALR-02 | Phase 2 | Pending |
| CALR-03 | Phase 2 | Pending |
| CALR-04 | Phase 2 | Pending |
| FERT-01 | Phase 2 | Pending |
| FERT-02 | Phase 2 | Pending |
| FERT-03 | Phase 2 | Pending |
| SYMP-01 | Phase 2 | Pending |
| SYMP-02 | Phase 2 | Pending |
| SYMP-03 | Phase 2 | Pending |
| SYMP-04 | Phase 2 | Pending |
| SYMP-05 | Phase 2 | Pending |
| SYMP-06 | Phase 2 | Pending |
| SYMP-07 | Phase 2 | Pending |
| SYMP-08 | Phase 2 | Pending |
| PRED-01 | Phase 2 | Pending |
| PRED-02 | Phase 2 | Pending |
| PRED-03 | Phase 2 | Pending |
| PRED-04 | Phase 2 | Pending |
| PRED-05 | Phase 2 | Pending |
| NOTF-01 | Phase 3 | Pending |
| NOTF-02 | Phase 3 | Pending |
| NOTF-03 | Phase 3 | Pending |
| NOTF-04 | Phase 3 | Pending |
| NOTF-05 | Phase 3 | Pending |
| NOTF-06 | Phase 3 | Pending |
| NOTF-07 | Phase 3 | Pending |
| CONT-01 | Phase 3 | Pending |
| CONT-02 | Phase 3 | Pending |
| CONT-03 | Phase 3 | Pending |
| CONT-04 | Phase 3 | Pending |
| CONT-05 | Phase 3 | Pending |
| I18N-01 | Phase 1 | Pending |
| I18N-02 | Phase 1 | Pending |
| I18N-03 | Phase 1 | Pending |
| I18N-04 | Phase 1 | Pending |
| PRIV-01 | Phase 1 | Pending |
| PRIV-02 | Phase 1 | Pending |
| PRIV-03 | Phase 1 | Pending |
| PRIV-04 | Phase 1 | Pending |
| PRIV-05 | Phase 1 | Pending |
| ADMN-01 | Phase 4 | Pending |
| ADMN-02 | Phase 4 | Pending |
| ADMN-03 | Phase 4 | Pending |
| ADMN-04 | Phase 4 | Pending |
| ADMN-05 | Phase 4 | Pending |
| ADMN-06 | Phase 4 | Pending |
| ADMN-07 | Phase 4 | Pending |
| ADMN-08 | Phase 4 | Pending |
| ADMN-09 | Phase 4 | Pending |
| ADMN-10 | Phase 4 | Pending |
| ADMN-11 | Phase 4 | Pending |
| ADMN-12 | Phase 4 | Pending |
| ADMN-13 | Phase 4 | Pending |
| ADMN-14 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 81 total
- Mapped to phases: 81
- Unmapped: 0

---
*Requirements defined: 2026-03-26*
*Last updated: 2026-03-26 -- Traceability updated with phase mappings (4 phases, 81/81 mapped)*
