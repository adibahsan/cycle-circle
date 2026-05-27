# Feature Research

**Domain:** Reproductive Health & Cycle Intelligence Platform (Web-based, Bangladesh-first)
**Researched:** 2026-03-26
**Confidence:** HIGH (based on extensive Flo product research, competitor analysis, Bangladesh market data)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any cycle tracking platform. Missing these means the product feels broken or incomplete. These are non-negotiable for launch.

#### Core Tracking

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Period start/end logging | The single reason anyone opens a cycle app. Every competitor (Flo, Clue, Maya, Natural Cycles) has this. | LOW | Tap-based logging. Must support retroactive editing. Mark start, select flow intensity (light/medium/heavy), mark end. 2-3 taps maximum. |
| Cycle day counter and phase display | Users need to know "where am I in my cycle?" at a glance. Flo centers this as the largest element on screen. | LOW | Derived from logged periods. Show current day number, phase name (follicular, ovulatory, luteal, menstrual), and days until next period. |
| Next period prediction | The primary reason users adopt cycle apps. 85%+ of users cite prediction as their main use case. | MEDIUM | Tier 1: rolling average of last 3-6 cycle lengths. Must show predicted start date on calendar. Recalculate when new data is logged. |
| Calendar view with color-coded phases | Universal in every competitor. Users expect visual representation of cycle history and future predictions. | MEDIUM | Month view. Color code: red/pink = period days, teal = fertile window, accent dot = ovulation day, muted = low-fertility. Support for retroactive date correction. |
| Fertile window and ovulation display | Expected by all users, critical for TTC users. Flo, Clue, Maya all show this prominently. | MEDIUM | Simple calculation: ovulation = cycle length - 14 days. Fertile window = 5 days before ovulation + ovulation day. Display on calendar and dashboard. |
| Symptom logging | Flo tracks 80+ symptoms, Clue tracks 100+. At minimum, users expect to log mood, pain, and flow. | MEDIUM | Start with top 20-30 most-logged symptoms across 6 categories: physical pain, mood/emotional, vaginal discharge, lifestyle, sexual activity, medical. Icon-based tap selection, not text-heavy forms. |
| User registration and authentication | Standard account management. Users expect email/password and social login. | MEDIUM | Email/password with JWT. Must support the multi-profile architecture from day one — this is not a standard auth setup. |
| Onboarding flow with goal selection | Flo's 70-screen onboarding converts at exceptional rates. Users expect the app to ask about their goal and adapt. | MEDIUM | Goal fork: Track my period / Try to conceive / Track pregnancy / Perimenopause. Collect: last period date, cycle length estimate, date of birth. Show trust/privacy reassurance screens. |
| Bilingual UI (English + Bengali) | Bangladesh market requirement. 98% of the population speaks Bengali. | MEDIUM | Every string, date format, number format must be translatable. Bengali numerals optional but valuable. Right-to-left not needed (Bengali is left-to-right). i18n must be set up before any UI work begins. |
| Notification and reminder system | Every competitor sends period predictions, logging prompts, and fertile window alerts. Users rely on these. | MEDIUM | At minimum: period start prediction alert, period logging reminder, fertile window alert. Web push notifications via service worker. Email as fallback. SMS for Bangladesh users who prefer it. |

#### Account and Settings

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Profile management | Users expect to edit personal info, change password, manage preferences. | LOW | Standard settings page with profile photo, name, email, password change. |
| Cycle settings configuration | Users need to tell the app their typical cycle length and period duration for initial predictions. | LOW | Input fields for average cycle length (21-35 days), period duration (3-7 days), last period start date. |
| Notification preferences | Users expect granular control over which notifications they receive and when. | LOW | Toggle per notification type: period reminders, fertile window, logging nudges, content updates. Time-of-day preference for pill/medicine reminders. |
| Data privacy controls | Post-Roe awareness means users are privacy-conscious about reproductive data. Flo introduced Anonymous Mode for this reason. | MEDIUM | At minimum: ability to delete account and all data, clear statement about what data is stored and why. Encryption for sensitive fields (sex life data especially). |
| Terms of service and privacy policy | Legal requirement, but also a trust signal. Users in health apps check these more than typical consumer apps. | LOW | Must exist before launch. Clear language about data handling, especially for the multi-profile model where one person manages others' data. |

---

### Differentiators (Competitive Advantage)

Features that set Vesta apart from Flo, Clue, Maya, and other competitors. Not required by users, but these create the product's unique value proposition.

#### Primary Differentiators (Core to Vesta's Identity)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Multi-profile accounts | **The single most important differentiator.** One account manages multiple women's health profiles with relation types (self, wife, sister, mother, daughter). No major competitor offers this. Culturally tailored to South Asian families where a husband, brother, or parent assists in health management. | HIGH | Requires: profile switcher UI, per-profile data isolation, relation type system, per-profile notification routing, per-profile prediction engines. This is architecturally invasive — it touches auth, data models, UI, notifications, analytics. Must be designed into the foundation, not bolted on. |
| Web-first tracking experience | **Flo, Clue, Maya, and Natural Cycles are all mobile-only for core tracking.** Their web presence is marketing/content only. A web-based cycle tracker fills a genuine unserved market position. Valuable for desktop users, workplace wellness, users with limited smartphone storage, and browser-first Bangladesh users. | MEDIUM | Must be responsive (works on mobile browsers too). PWA capabilities (home screen install, push notifications via service worker) bridge the gap to native. This IS the market gap per Flo research. |
| Bangladesh-first localization | **Maya is the closest Bangladesh competitor** (~350K MAU) but is mobile-only. No web-based cycle tracker serves Bangladesh specifically. Bengali language, Bengali numerals, local SMS integration, culturally appropriate content about menstrual health (addressing taboos directly). | MEDIUM | Goes beyond translation: culturally sensitive onboarding that normalizes period tracking in a society where 36% of girls don't know what menstruation is before menarche. Educational content that addresses cultural myths (demon possession beliefs, food restrictions during periods). SMS reminders critical — BTRC requires Bengali for bulk SMS (only OTP/numbers allowed in English). |
| Three-tier prediction engine | Offering Simple / ARIMA / LSTM prediction models lets the client price-differentiate and lets users see value in upgrading. No competitor explicitly offers tiered prediction transparency. | HIGH | Tier 1 (Simple): rolling average, works from cycle 1. Tier 2 (ARIMA): time-series prediction, needs 6+ cycles. Tier 3 (LSTM): neural net with multi-factor inputs (symptoms, lifestyle, age), needs 12+ cycles and significant training data. The cold-start problem is real — start with published research datasets for initial model training. |

#### Secondary Differentiators (High Value, Distinct Features)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Pregnancy week-by-week tracker | Transitions Vesta from a cycle app to a full reproductive lifecycle platform. Flo's pregnancy mode is a major retention driver. No web-based competitor offers this. | HIGH | Week-by-week development milestones, baby size comparisons, body change information, symptom logging (pregnancy-specific: nausea, swelling, fatigue), appointment tracking, ultrasound image storage (S3), kick counter, due date calculator. UI color scheme shift (Flo uses yellow/warm tones for pregnancy). |
| Partner sharing system | Flo's "Flo for Partners" has 1M+ MAU — it was their most-requested feature. Enables husbands/partners to understand and support their partner's cycle. Particularly valuable in Bangladesh where men are often involved in family health decisions. | MEDIUM | Invite via sharing code. Partner gets: read-only cycle calendar (current data only, not historical), daily phase insights ("Your partner may be experiencing..."), fertile window visibility (if TTC), pregnancy updates. Partner CANNOT see personally logged symptoms or edit data. Primary user can revoke access instantly. |
| Medicine tracker with alarms | Birth control pill adherence is a real problem — missed pills cause unintended pregnancies. Prenatal vitamin tracking during pregnancy. Menopause HRT tracking. Most cycle apps don't have robust medicine tracking. | MEDIUM | Medicine name, dosage, schedule (daily/weekly/custom), alarm system. Alarms via push notification + SMS (critical for Bangladesh). Pill streak tracking. History log. Must work per-profile in the multi-profile model. |
| Health analytics dashboard | Users who log consistently deserve to see patterns. Flo gates this behind Premium. Showing cycle length trends, symptom correlations, and phase patterns creates "aha moments" that drive retention. | MEDIUM | Charts: cycle length variation over time, symptom frequency by phase, mood patterns, sleep/exercise correlation with cycle. Use Recharts or Chart.js. Per-profile analytics. Exportable as PDF for doctor visits (like Flo's Doctor Report). |
| Menopause and perimenopause tracker | Growing and underserved market segment. Clue just launched Clue Perimenopause. Flo added perimenopause mode. Dedicated menopause apps (Balance, Health & Her, MenoLife) exist but none web-based. In Bangladesh, women over 40 have almost zero digital health support. | MEDIUM | Track: hot flashes (frequency/severity), night sweats, irregular cycles, mood changes, brain fog, joint pain, sleep disruption. Show pattern analysis over time. Perimenopause-specific educational content. This is a mode switch (like pregnancy mode) that changes the dashboard focus. |
| Content platform (articles + videos) | Flo's content ecosystem is reviewed by 120+ medical experts and drives significant engagement. In Bangladesh, menstrual health education is critically needed — 36% of girls are unaware about periods before menarche. Content fills a genuine educational gap. | MEDIUM | CMS-managed articles and videos. Bilingual (EN/BN). Categories: menstrual health, fertility, pregnancy, menopause, nutrition, exercise, mental health. Phase-specific content recommendations (show relevant articles based on where user is in their cycle). Admin CMS for content creation/editing. |
| Sleep and exercise tracking with cycle correlation | Showing users how their sleep quality and exercise patterns correlate with cycle phases is a genuine insight most users have never seen. This data also feeds Tier 3 predictions. | MEDIUM | Manual entry: sleep duration + quality rating, exercise type + duration + intensity. Analytics: overlay sleep/exercise data on cycle calendar, show averages by cycle phase, highlight correlations. |
| Sex life tracking (encrypted) | Essential for TTC users and fertility matching. Flo includes this in their standard symptom categories. Must be encrypted and optional given cultural sensitivity in Bangladesh. | MEDIUM | Track: intercourse date, protected/unprotected, fertility matching (auto-correlate with fertile window). Must be encrypted at field level. Optional — users opt in. Hidden behind a privacy gate. Important for TTC mode accuracy. |
| Anonymous community forum | Flo's Secret Chats has 7M monthly users — it's a massive engagement driver. In Bangladesh, where reproductive health is stigmatized, anonymous community is even more valuable. | HIGH | Random anonymous avatars, pre-moderation of all posts (human or AI-assisted), topic categories (periods, pregnancy, TTC, menopause, relationships), age-gated content (under-18 vs over-18 separation). Requires moderation infrastructure and content policies. |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem appealing but create problems — scope creep, liability, architectural complexity, or user harm. Explicitly NOT building these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Native mobile apps (iOS/Android) | "Everyone uses mobile apps" | Triples development cost and timeline. Web-first validates product-market fit. Bangladesh has 72.4% smartphone household penetration but web browser is universal. PWA covers 80% of native app UX. | PWA with home screen install, push notifications via service worker, responsive design that feels native on mobile browsers. Ship native in Phase 2 after validation. |
| AI health chatbot | Flo's "Ask Flo" is popular and uses LLMs | Medical liability is enormous. Bad health advice can cause real harm. Requires extensive medical review pipeline, fine-tuned models, and guardrails. A startup cannot replicate Flo's 120-expert medical advisory board. | Curated, medically reviewed content articles. Phase-specific article recommendations that feel "intelligent" without the liability of generative responses. Consider rule-based FAQ bot as a mid-ground in Phase 2. |
| Doctor consultation system | Maya in Bangladesh offers health queries. Telehealth is growing. | Requires: doctor onboarding and verification, scheduling system, payment processing, medical licensing compliance, malpractice considerations. This is a separate business. | Link to external health resources and local clinic directories. Phase 2 monetization feature. |
| E-commerce / health product marketplace | Maya runs "Maya Shop." Revenue potential. | Requires: inventory management, payment processing (Bangladesh payment gateways are complex), logistics/delivery, product liability. Completely different business domain. | Recommend products in educational content articles with affiliate links. Phase 2 revenue stream. |
| Wearable / smartwatch integration | Natural Cycles uses BBT thermometer. Apple Health integration is standard. | Web apps cannot access Apple HealthKit (iOS-only SDK). Web Bluetooth is limited and unreliable. Wearable data import requires hardware partnerships. | Manual data entry for BBT, sleep, exercise. CSV import as a power-user feature. Wearable integration in Phase 2 mobile app. |
| Gamification (streaks, badges, points) | "Engagement" metric optimization. Duolingo-style retention. | Trivializes health tracking. Period tracking is not a game. Flo receives criticism for gamified elements feeling tone-deaf during painful periods. Creates anxiety when streaks break during irregular cycles. | Focus on insights and education as engagement drivers. "Your cycle insight is ready" is more motivating than "You logged 7 days in a row!" |
| Social features (friending, public profiles, following) | "Community engagement" and "social proof" | Reproductive health is deeply private. Social features risk exposing health data. Nobody wants their cycle visible to acquaintances. Even Flo's community is strictly anonymous. | Anonymous community only. Partner sharing is the only non-anonymous social feature, and it's strictly controlled by the primary user. |
| Offline-first / local-only storage | Privacy maximalists want zero cloud storage. Clue historically stored data locally. | Complex sync logic, data loss risk on device failure, impossible with multi-profile model (profiles need server coordination), impossible with partner sharing, impossible with SMS reminders, impossible with admin panel. | Server-side storage with strong encryption. Clear privacy policy. Optional data export. The multi-profile architecture fundamentally requires server-side data. |
| Real-time everything (WebSocket notifications, live dashboards, live community) | "Modern apps should be real-time" | Massive infrastructure overhead for minimal user value. Cycle data changes at most once per day. Community posts are pre-moderated anyway (not real-time). | Polling with sensible intervals (dashboard refresh on page load, community refresh every 30 seconds). WebSocket only for truly real-time features like active chat, which is Phase 2+ at best. |
| Symptom prediction ("You'll likely feel cramps tomorrow") | Flo Premium offers forward-looking symptom predictions. Sounds impressive. | Requires massive training data that Vesta does not have at launch. Inaccurate predictions erode trust faster than no predictions at all. Flo has 450GB+ of training data from 420M+ users. | Show historical patterns: "In your last 3 cycles, you logged cramps on days 24-26." Let users draw their own conclusions. Add predictive features after accumulating sufficient data (12+ months post-launch). |
| Comprehensive food/recipe suggestions | Flo research mentions phase-specific nutrition. Users want dietary guidance. | Requires nutritional expertise, cultural adaptation (Bangladeshi cuisine is specific), content creation pipeline, potential allergies/dietary restrictions. This is a content vertical, not a tracking feature. | Include basic nutrition tips in educational content articles. Tag articles by cycle phase. Defer recipe/meal planning to Phase 2 content expansion. |

---

## Feature Dependencies

```
[Authentication System]
    |
    +---> [Multi-Profile System] (CRITICAL: must be in foundation)
    |         |
    |         +---> [Profile Switcher UI]
    |         |         |
    |         |         +---> [All per-profile tracking features]
    |         |
    |         +---> [Per-Profile Notification Routing]
    |         |
    |         +---> [Per-Profile Prediction Engines]
    |         |
    |         +---> [Partner Sharing] (links to specific profile)
    |
    +---> [Admin Panel Auth] (separate role system)

[i18n Framework Setup] (CRITICAL: must be first, before any UI)
    |
    +---> [All UI Components]
    +---> [Bengali Translation Strings]
    +---> [Bengali Date/Number Formatting]

[Period Logging]
    |
    +---> [Cycle Length Calculation]
    |         |
    |         +---> [Next Period Prediction (Tier 1 - Simple Average)]
    |         |
    |         +---> [Fertile Window Display]
    |         |
    |         +---> [Ovulation Day Marker]
    |         |
    |         +---> [Calendar Color-Coding]
    |
    +---> [6+ cycles accumulated] ---> [ARIMA Prediction (Tier 2)]
    |
    +---> [Period + Symptoms + Lifestyle data] ---> [LSTM Prediction (Tier 3)]

[Symptom Logging]
    |
    +---> [Health Analytics Dashboard] (pattern charts)
    +---> [Menopause Symptom Tracking] (subset of symptoms)
    +---> [Content Personalization] (recommend articles by symptoms)

[Period Logging] + [Goal = Pregnancy]
    |
    +---> [Pregnancy Mode Toggle]
              |
              +---> [Pregnancy Week-by-Week Tracker]
              +---> [Ultrasound Image Storage] --requires--> [S3/Object Storage]
              +---> [Due Date Calculator]
              +---> [Appointment Tracker]

[Background Job System (BullMQ)]
    |
    +---> [Reminder System]
    |         |
    |         +---> [Push Notifications] --requires--> [Service Worker]
    |         +---> [Email Notifications] --requires--> [Email Service]
    |         +---> [SMS Notifications] --requires--> [Bangladesh SMS Gateway]
    |
    +---> [Medicine Alarm Scheduling]

[Content Management (Admin Side)]
    |
    +---> [Content Display (User Side)]
    +---> [Phase-Specific Content Recommendations]

[User Management (Admin Side)]
    |
    +---> [Community Moderation System]
    +---> [User Suspension/Deletion]
    +---> [Data Export (CSV/Excel)]

[Sleep Logging] --enhances--> [Health Analytics Dashboard]
[Exercise Logging] --enhances--> [Health Analytics Dashboard]
[Sex Life Tracking] --enhances--> [Fertile Window Accuracy] (for TTC users)

CONFLICTS:
[Anonymous Community] --conflicts-with--> [Social Profiles/Friending]
    (anonymity is the core value; social features would undermine it)

[Offline-First Storage] --conflicts-with--> [Multi-Profile System]
    (multi-profile requires server coordination)

[Offline-First Storage] --conflicts-with--> [Partner Sharing]
    (partner access requires server-side data)
```

### Dependency Notes

- **Multi-Profile System requires Authentication**: The auth model is non-standard. One authenticated user owns multiple health profiles. This cannot be retrofitted — it must be the foundation of the data model.
- **i18n requires setup before UI work**: Every component, every string, every date format must go through i18n. Adding bilingual support after building UI means rewriting every component. Set up i18next (or equivalent) on day one.
- **ARIMA/LSTM require accumulated data**: Tier 2 needs 6+ logged cycles (6+ months of real user data). Tier 3 needs 12+ cycles plus symptom/lifestyle data. These cannot be useful at launch unless pre-trained on published research datasets.
- **SMS integration requires Bangladesh SMS gateway**: BTRC (Bangladesh Telecommunication Regulatory Commission) requires Bengali for bulk SMS. Only OTP, numbers, and URLs may be in English. This affects reminder message formatting.
- **Pregnancy mode requires period logging history**: Users switch to pregnancy mode from cycle tracking. The system needs last period date to calculate gestational age. Pregnancy mode is a "mode switch" that changes the entire UI.
- **Partner sharing requires server-side data**: Partners access the cycle calendar remotely. This fundamentally requires server-side storage — confirming that offline-first architecture is incompatible with this feature.
- **Community moderation requires admin infrastructure**: Pre-moderation of all posts (as Flo does) means content goes through a review queue before appearing. This needs admin panel tooling and either human reviewers or AI-assisted moderation.

---

## The Multi-Profile Model: How It Changes Everything

The multi-profile system is not just a feature — it fundamentally reshapes the product architecture. Here is how it affects every feature area:

| Feature Area | Single-Profile (Standard) | Multi-Profile (Vesta) | Architectural Impact |
|-------------|--------------------------|----------------------|---------------------|
| Authentication | 1 user = 1 account = 1 set of health data | 1 user = 1 account = N health profiles | Custom auth model. "Account owner" vs "health profile" are separate concepts. Account owner may not even be the person whose health is tracked. |
| Period tracking | Log data for yourself | Log data for the active profile, switch profiles to log for another person | Profile switcher must be accessible from every logging screen. Visual indicator of which profile is active. Accidental cross-profile logging prevention. |
| Predictions | One prediction engine per user | One prediction engine per profile | Each profile has independent cycle history, prediction models, and accuracy metrics. Multiplied compute cost. |
| Notifications | Notify the user about their own cycle | Notify the account owner about each profile's events, with configurable per-profile preferences | "Amina's period is predicted for Thursday" vs "Your period is predicted for Thursday." Per-profile notification preferences and routing. |
| Partner sharing | Share your data with your partner | Which profile's data is being shared? Account owner may share different profiles with different partners. | Sharing is per-profile, not per-account. Complex permission model. |
| Privacy | Your data, your control | Account owner sees others' health data. Consent model required. | Who gave consent? The account owner or the profile subject? What if the profile subject wants to revoke access? Important for women's autonomy — the multi-profile model must not become a surveillance tool. |
| Admin analytics | Straightforward per-user analytics | Account-level metrics vs profile-level metrics. Population analytics must de-duplicate (one account with 3 profiles is 3 women, not 1). | Admin dashboard must distinguish between accounts and profiles in all analytics. |
| Data export | Export your data | Export which profile? All profiles? Per-profile export? | Data export UI needs profile selection. |

### Multi-Profile Privacy Safeguards

This is the single biggest ethical concern with the multi-profile model. In South Asian cultural dynamics, a husband managing his wife's health profile is the happy path. But the same architecture could enable:
- A controlling family member monitoring a woman's reproductive health without her knowledge
- A parent tracking a daughter's sexual activity through sex life logs
- Health data used as evidence in family disputes

**Required safeguards:**
1. Consent mechanism: When adding a profile, system should explain what data the account owner can see
2. Profile-level privacy settings: Certain tracking categories (sex life, pregnancy tests) should be hideable per-profile
3. Independent access option: A profile subject should be able to create their own account and "claim" their profile, transferring data ownership
4. Audit log: Track who viewed what data and when (useful for admin/legal purposes)

---

## Bangladesh Market-Specific Features

Features that matter specifically because the primary market is Bangladesh.

| Feature | Why It Matters for Bangladesh | Priority | Notes |
|---------|-------------------------------|----------|-------|
| Bengali language UI | 98% of population speaks Bengali. English-only excludes the target demographic. | P1 (launch) | Full translation. Bengali numerals optional. Bengali date formatting (e.g., Bangla calendar months). |
| SMS reminders | 48.9% internet penetration, but 188M+ mobile subscriptions. SMS reaches users who may not check web apps regularly. | P1 (launch) | BTRC requires Bengali for bulk SMS. Providers: Alpha Net, SMS.BD, MiMSMS, BD Bulk SMS. Delivery up to 50K SMS/min. Cost-effective for reminders. |
| Menstrual health education content | 36% of girls are unaware about menstruation before menarche. 40% of girls miss school during periods. Cultural taboos and myths (demon possession, food restrictions) are widespread. | P1 (launch) | Myth-busting content is genuinely life-changing in this market. Content should address: what menstruation is, why it happens, hygiene management, when to see a doctor, cultural myths debunked. In both English and Bengali. |
| Low-bandwidth optimization | Mobile internet averages 28 Mbps (median) but rural areas are slower. Users on 2G/3G data plans care about data usage. | P1 (launch) | Compress images, lazy-load content, minimize JavaScript bundle, use efficient data formats. Target < 2MB initial load. Service worker caching for returning users. |
| Family-oriented onboarding | In Bangladesh, a husband or family member may be setting up the app for a wife/sister/mother. The onboarding must accommodate this without being patronizing. | P1 (launch) | Ask "Who are you setting this up for?" early in onboarding. If "someone else" — collect relationship type and explain what data the account owner will see. Consent language appropriate for the cultural context. |
| Affordable/free tier | Most users in Bangladesh cannot afford $5-10/month subscriptions. Maya's services are specifically described as "affordable." | P1 (launch) | Core tracking must be fully free. If monetizing, keep it under 200-500 BDT/month ($1.70-$4.25). Consider ads-free as the free tier value proposition. |
| Vaccine and appointment reminders | Maya includes vaccine reminders. Prenatal care appointments are critical and often missed. | P2 | Integrate with pregnancy tracker. Remind about tetanus toxoid doses, prenatal checkups by trimester. |

---

## MVP Definition

### Launch With (v1)

Minimum viable product that validates the core thesis: "Families in Bangladesh will use a web-based cycle tracker with multi-profile support."

- [ ] **Multi-profile account system** -- The differentiator. One account, create/switch between health profiles with relation types. Without this, Vesta is just another cycle tracker.
- [ ] **Period tracking with calendar** -- Table stakes. Log period start/end, flow intensity. Month calendar view with color-coded phases. Retroactive editing.
- [ ] **Tier 1 cycle prediction** -- Simple rolling average. Shows predicted next period date and fertile window. Good enough for launch; accuracy improves with more logged cycles.
- [ ] **Basic symptom logging** -- Top 20-25 symptoms across physical, mood, and discharge categories. Icon-based tap selection. One log per symptom per day, editable.
- [ ] **Bilingual UI (English + Bengali)** -- i18n from day one. Full translation of all UI strings. Bengali date formatting.
- [ ] **Onboarding flow** -- Goal selection (period tracking / TTC / pregnancy / perimenopause), basic data collection (last period, cycle length, DOB), trust screens, profile creation.
- [ ] **Push notification reminders** -- Period prediction alerts, logging prompts, fertile window alerts via web push (service worker).
- [ ] **Basic admin dashboard** -- Client requires operational tooling from launch. User metrics, user management (list/suspend/delete), basic activity charts.
- [ ] **Responsive web design** -- Works on desktop and mobile browsers. PWA manifest for home screen install.

### Add After Validation (v1.x)

Features to add once core tracking is working and initial users are onboarded.

- [ ] **SMS reminders** -- After validating that users engage with web push, add SMS for users who prefer it. Requires Bangladesh SMS gateway integration.
- [ ] **Health analytics dashboard** -- Charts showing cycle length trends, symptom frequency by phase, basic pattern insights. Adds value for users who have 3+ logged cycles.
- [ ] **Partner sharing** -- Generate sharing code, partner gets read-only cycle calendar and daily phase insights. High demand feature (Flo's most-requested).
- [ ] **Medicine tracker** -- Pill/vitamin/medication tracking with reminders. Standalone module that doesn't affect core architecture.
- [ ] **Content platform (basic)** -- Curated articles on menstrual health, fertility, pregnancy. Admin CMS for content creation. Phase-specific recommendations.
- [ ] **ARIMA prediction (Tier 2)** -- Time-series prediction for users with 6+ logged cycles. Noticeable accuracy improvement over simple average.
- [ ] **Sleep and exercise logging** -- Manual data entry with cycle overlay analytics. Feeds into Tier 3 prediction model.
- [ ] **Email notification channel** -- Period reminders and health insights via email for users who prefer it.

### Future Consideration (v2+)

Features to defer until product-market fit is established and the user base is growing.

- [ ] **Pregnancy week-by-week tracker** -- High complexity, requires extensive content (40 weeks of developmental milestones), ultrasound storage (S3), appointment system. Ship when there's demand from pregnant users.
- [ ] **LSTM prediction (Tier 3)** -- Neural network predictions. Needs 12+ months of accumulated user data for training. Cold-start problem prevents this from being useful at launch.
- [ ] **Menopause/perimenopause tracker** -- Growing market but smaller initial user base. Mode switch that changes dashboard focus. Requires menopause-specific content library.
- [ ] **Anonymous community forum** -- High engagement potential (Flo's Secret Chats has 7M MAU) but requires moderation infrastructure, content policies, and active management. Do not launch a community you cannot moderate.
- [ ] **Sex life tracking (encrypted)** -- Culturally sensitive in Bangladesh. Optional, privacy-gated. Important for TTC accuracy but not launch-critical.
- [ ] **Doctor's report export** -- PDF export of 6-month cycle summary for physician visits. Valuable but needs enough data history to be meaningful.
- [ ] **Native mobile apps** -- iOS and Android. Only after web product-market fit is proven.
- [ ] **Doctor consultation system** -- Phase 2 monetization. Requires doctor onboarding, scheduling, payment.
- [ ] **Health product marketplace** -- Phase 2 revenue. Requires e-commerce infrastructure.
- [ ] **Wearable integration** -- Phase 2 mobile app. Web Bluetooth is unreliable.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Rationale |
|---------|------------|---------------------|----------|-----------|
| Multi-profile accounts | HIGH | HIGH | **P1** | Core differentiator. Everything depends on this architecture. |
| Period tracking + calendar | HIGH | MEDIUM | **P1** | Table stakes. Useless without it. |
| Tier 1 cycle prediction | HIGH | LOW | **P1** | Primary user expectation. Simple average is quick to implement. |
| Symptom logging (top 25) | HIGH | MEDIUM | **P1** | Expected by all users. Drives data collection for future ML. |
| Bilingual UI | HIGH | MEDIUM | **P1** | Non-negotiable for Bangladesh market. |
| Onboarding flow | HIGH | MEDIUM | **P1** | First impression. Goal-based routing drives personalization. |
| Web push notifications | HIGH | LOW | **P1** | Users forget to log without reminders. Critical for retention. |
| Admin dashboard (basic) | MEDIUM | MEDIUM | **P1** | Client requirement for operational visibility. |
| Partner sharing | HIGH | MEDIUM | **P2** | High-demand feature, but not launch-blocking. |
| Health analytics dashboard | MEDIUM | MEDIUM | **P2** | Requires accumulated data to be valuable. |
| SMS reminders (Bangladesh) | HIGH | MEDIUM | **P2** | Critical for reach but web push covers initial users. |
| Medicine tracker | MEDIUM | MEDIUM | **P2** | Standalone module. Good retention feature. |
| Content platform | MEDIUM | MEDIUM | **P2** | Requires editorial content pipeline. |
| ARIMA prediction (Tier 2) | MEDIUM | HIGH | **P2** | Needs 6+ cycles of data. Ship when users have history. |
| Sleep/exercise logging | LOW | LOW | **P2** | Data collection for Tier 3. Low standalone value. |
| Pregnancy tracker | HIGH | HIGH | **P3** | High value but massive scope. Ship when demand warrants. |
| LSTM prediction (Tier 3) | MEDIUM | HIGH | **P3** | Needs 12+ months of data. Cold-start problem. |
| Menopause tracker | MEDIUM | MEDIUM | **P3** | Growing segment but smaller initial audience. |
| Community forum | MEDIUM | HIGH | **P3** | Needs moderation infrastructure. Don't launch unmoderated. |
| Sex life tracking | LOW | MEDIUM | **P3** | Culturally sensitive. TTC-specific. Encrypted. |

**Priority key:**
- **P1:** Must have for launch. Product is broken without these.
- **P2:** Should have within 3-6 months. Drives retention and differentiation.
- **P3:** Nice to have. Defer until product-market fit established.

---

## Competitor Feature Analysis

| Feature | Flo | Clue | Maya (Bangladesh) | Natural Cycles | Vesta (Our Approach) |
|---------|-----|------|-------------------|----------------|---------------------|
| **Web-based tracking** | No (marketing site only) | No (mobile only) | No (mobile only) | No (mobile only) | **YES — primary differentiator** |
| **Multi-profile accounts** | No | No | No | No | **YES — core innovation** |
| **Period tracking** | Yes (best-in-class) | Yes (science-focused) | Yes | Yes (BBT-required) | Yes (standard implementation) |
| **Cycle prediction** | Neural networks (450GB data) | ML (research-backed) | Algorithm-based | BBT + algorithm (FDA-cleared) | Three-tier: Simple / ARIMA / LSTM |
| **Symptom logging** | 80+ symptoms, 16 categories | 100+ tracking options | Basic symptoms | Limited (BBT-focused) | Top 25-30 symptoms, expandable |
| **Pregnancy mode** | Full (3D visualization, checklists) | No | Yes (basic) | No | Phase 2 (week-by-week tracker) |
| **Partner sharing** | Yes (1M+ MAU, read-only) | No | Yes (Maya 2 "partner sync") | Yes (basic) | Yes (per-profile sharing) |
| **Community** | Secret Chats (7M MAU, moderated) | No | Community feature | No | Phase 3 (anonymous, moderated) |
| **AI chatbot** | Ask Flo (LLM-powered) | No | AI health assistant | No | No (curated content instead) |
| **Bengali language** | No | No | Not specified | No | **YES — native Bengali support** |
| **Bangladesh SMS** | No | No | Not specified | No | **YES — local SMS gateway** |
| **Menopause tracking** | Yes (perimenopause mode) | Yes (Clue Perimenopause) | No | No | Phase 3 |
| **Privacy innovation** | Anonymous Mode (OHTTP, post-quantum) | CE-marked medical device, strong privacy | Basic | On-device processing | Encryption for sensitive data, clear privacy policy |
| **Price** | $4.17-$9.99/mo USD | $0.99-$9.99/mo USD | Affordable/freemium | ~$100/year | Free core, affordable premium (< $5 USD/mo) |

### Key Competitive Insights

1. **Nobody offers web-based tracking.** This is the confirmed market gap. Every major competitor is mobile-only for core features.
2. **Nobody offers multi-profile accounts.** This is genuinely novel in the reproductive health space.
3. **Maya is the only Bangladesh-focused competitor** with ~350K MAU. They recently rebuilt as "Maya 2" with partner sync and modern UI. They are mobile-only.
4. **Flo's moat is data scale** (450GB+ training data, 420M+ downloads). Vesta cannot compete on prediction accuracy at launch. Compete on accessibility (web), architecture (multi-profile), and localization (Bangladesh).
5. **Privacy is increasingly important.** Flo's $56M class action settlement (2025) for sharing data with Facebook/Google means users are wary. Vesta should lead with clear, honest privacy practices.

---

## Sources

### Primary Research (Local)
- Flo Health Comprehensive Guide (`docs/flo-health-comprehensive-guide.md`) — detailed product anatomy
- Open Source Flo Clone Research (`docs/Open Source Flo Clone Research.md`) — technical architecture analysis
- Flo User Stories (`docs/flo-user-stories.md`) — 80 user stories across 11 feature areas
- Flo User Journey Flows (`docs/flo-user-journey-flows.md`) — mermaid flow diagrams
- PROJECT.md — Vesta project context and requirements

### Bangladesh Market
- [The Daily Star — 5 femtech apps to check out](https://www.thedailystar.net/bytes/news/5-femtech-apps-you-should-check-out-today-2975201) — Maya and Bangladesh femtech landscape
- [TechCrunch — Maya raises $2.2M seed](https://techcrunch.com/2021/02/08/bangladesh-based-maya-a-startup-focused-on-accessible-healthcare-raises-2-2-million-seed-round/) — Maya's market position
- [Financial Express — Femtech apps in Bangladesh](https://thefinancialexpress.com.bd/health/femtech-apps-revolutionising-womens-healthcare-in-bangladesh)
- [ScienceDirect — Cultural taboos and menstrual health in rural Bangladesh](https://www.sciencedirect.com/science/article/pii/S0305750X24003425)
- [UNDP — Period stigma in rural Bangladesh](https://www.undp.org/bangladesh/blog/meet-women-fighting-end-period-stigma-rural-bangladesh)
- [The Daily Star — Period poverty in Bangladesh](https://www.thedailystar.net/opinion/views/news/period-poverty-silent-crisis-bangladesh-3397676)
- [PLOS Digital Health — Reproductive mHealth adoption in Bangladesh](https://journals.plos.org/digitalhealth/article?id=10.1371/journal.pdig.0000637)
- [DataReportal — Digital 2025 Bangladesh](https://datareportal.com/reports/digital-2025-bangladesh) — 44.5% internet penetration, 72.4% smartphone households

### Competitor Analysis
- [Cycle Synced — Best Period Tracker Apps 2025 (11 compared)](https://cyclesynced.org/best-period-tracker-app-2025-11-apps-compared-tested-reviewed/)
- [Go Go Gaia — Clue vs Flo vs Ovia (6 compared)](https://www.go-go-gaia.com/blog/how-to-choose-period-tracker-app.html)
- [Natural Cycles vs competition](https://www.naturalcycles.com/nc-vs-competition)
- [UW News — Period tracking apps failing users](https://www.washington.edu/news/2017/05/02/period-tracking-apps-failing-users-in-basic-ways-study-finds/)

### Market Data
- [GlobeNewsWire — Menstrual Health Apps Market 20.28% CAGR](https://www.globenewswire.com/news-release/2026/02/25/3244660/0/en/Menstrual-Health-Apps-Market-s-20-28-CAGR-Reflects-Strong-Investor-Confidence-in-Women-Centric-Innovation.html) — $2.49B (2026) to $13.11B (2035)
- [FemTech World — Menstrual health apps market to reach $13B](https://www.femtechworld.co.uk/news/menstrual-health-apps-market-tipped-to-reach-us13bn-mens26/)

### Bangladesh SMS Infrastructure
- [Alpha Net SMS Gateway](https://www.alpha.net.bd/SMS/api/) — 50K SMS/min, GET/POST API
- [SMS.BD](https://sms.bd/) — JSON REST API, 50K SMS/min
- [MiMSMS](https://www.mimsms.com/) — < 10 second delivery
- BTRC regulation: bulk SMS must be in Bengali (OTP/numbers/URLs excepted)

### Menopause Tracking
- [Health & Her — Perimenopause and menopause tracking app](https://healthandher.com/en-us/pages/menopause-perimenopause-app)
- [Clue Perimenopause](https://helloclue.com/articles/menopause/introducing-clue-perimenopause)

---
*Feature research for: Vesta — Reproductive Health & Cycle Intelligence Platform*
*Researched: 2026-03-26*
