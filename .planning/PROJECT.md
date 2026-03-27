# Vesta — Reproductive Health & Cycle Intelligence Platform

## What This Is

Vesta is a web-based reproductive health platform targeting Bangladeshi women and families. It offers multi-profile cycle tracking, ovulation prediction, pregnancy monitoring, and comprehensive health analytics from a single account — enabling one family member to manage health tracking for wife, sister, mother, or self. Phase 1 is a bilingual (English/Bengali) web app; Phase 2 adds mobile apps, doctor consultations, and a health product marketplace.

## Core Value

Enable families in Bangladesh to track and understand reproductive health for multiple women from a single account, with accurate cycle predictions and actionable health insights — filling the gap that no major competitor offers a web-based core tracking experience.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

**User-Facing Features:**
- [ ] Multi-profile account system (one account, unlimited health profiles with relation types)
- [ ] Period tracking module (start/end dates, flow intensity, symptom logging)
- [ ] Ovulation tracking and fertile window prediction
- [ ] Pregnancy tracking (week-by-week development, weight, kicks, appointments, ultrasound storage)
- [ ] Medicine tracker (name, dosage, schedule, alarms, history)
- [ ] Reminder system (periods, ovulation, medicines, appointments — app, email, SMS)
- [ ] Sleep monitor data collection (duration, quality, cycle correlation)
- [ ] Exercise tracking (steps, workouts, calories, cycle-exercise analysis)
- [ ] Sex life tracking (encrypted, optional — intercourse dates, protection, fertility matching)
- [ ] Health analytics dashboard (charts, cycle variation, symptom insights)
- [ ] Partner sharing system (cycle calendar, reminders, pregnancy updates)
- [ ] Content platform (articles, videos on menstrual health, fertility, pregnancy)
- [ ] Menopause & pre-menopause tracker (hot flashes, mood, irregular cycles)
- [ ] Onboarding flow (goal selection, data collection, trust-building)
- [ ] Bilingual support (English + Bengali)

**Prediction Engine (Three Tiers for Client Estimation):**
- [ ] Tier 1: Simple algorithm — average-based cycle prediction
- [ ] Tier 2: Statistical model — ARIMA time-series prediction
- [ ] Tier 3: Full ML pipeline — LSTM/neural net with multi-factor inputs

**Admin Panel:**
- [ ] Admin dashboard (user metrics, activity charts, key stats)
- [ ] User management (list, suspend, reactivate, delete, reset password)
- [ ] Profile monitoring (aggregated cycle/pregnancy/menopause insights)
- [ ] Health data analytics (aggregated population-level insights)
- [ ] Prediction accuracy reports (predicted vs actual, accuracy percentages)
- [ ] Content management system (articles, videos, categories, languages)
- [ ] Notification management (reminder controls, broadcast, emergency alerts)
- [ ] Moderation system (reported content, abusive content removal)
- [ ] Security & access control (Super Admin, Content Admin roles)
- [ ] Data export (CSV/Excel analytics export)
- [ ] Community management (anonymous posts, approve/reject, engagement metrics)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Doctor consultation system — Phase 2 monetization feature
- Health product marketplace — Phase 2 monetization feature
- Sponsored content/advertising — Phase 2 revenue stream
- Food & recipe suggestions (area-based) — Phase 2 content feature
- Mobile apps (iOS/Android) — Phase 2 delivery platform
- Wearable/smartwatch integration — Future passive data collection
- AI Learning Monitoring dashboard — Future, requires production ML pipeline
- SMS gateway management (admin) — Depends on SMS provider selection
- Doctor management (admin) — Phase 2, tied to consultation system
- Marketplace management (admin) — Phase 2, tied to marketplace

## Context

**Market Gap:** No major competitor (Flo, Clue, Natural Cycles) offers a web-based core tracking experience. Flo's web presence is marketing-only. This is a genuine opportunity.

**Unique Differentiator:** Multi-profile architecture is uncommon in reproductive health apps. The family-oriented model (one account managing multiple women's health) is tailored to South Asian cultural dynamics where a husband, brother, or parent may assist in health management.

**Existing Codebase:** A React + Vite + Tailwind prototype exists with basic pages (Home, Calendar, LogSymptoms, SecretChats, Settings, Login, Onboarding) and Google Stitch UI mockups. Decision: start fresh with proper architecture.

**Research Available:** Extensive Flo Health research in `docs/` folder covering product anatomy, UX patterns, design system, business model, technical architecture, and open-source landscape analysis.

**Google Stitch Mockups:** 5 screen mockups in `stitch/` folder (home dashboard, symptom logging, secret chats, monthly calendar, pregnancy mode) that can inform UI direction.

## Constraints

- **Delivery Type**: Scope + estimation document with developer-hour estimates for client
- **Timeline**: 1 month to production deployment (deadline ~2026-04-27)
- **Language**: Bilingual (English + Bengali) from day one — affects every UI component
- **Tech Stack**: React + Vite + Tailwind (frontend), Custom Express/Node backend, Vercel + separate API server
- **Privacy**: Health data (especially sex life tracking) requires encryption; anonymous mode considerations
- **Target Market**: Bangladesh-first — SMS infrastructure critical for reminders in low-smartphone regions
- **Estimation Format**: Developer-hours per feature area, with three-tier pricing for prediction engine

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rename to Vesta | Client branding preference | — Pending |
| Start fresh (ignore existing prototype) | Existing code was exploratory Stitch output, not production-ready | — Pending |
| Custom backend over BaaS (Supabase/Firebase) | Full control over data, SMS integration, multi-profile auth model | — Pending |
| Vercel + separate API | Frontend on Vercel CDN, API on VPS/container for full backend control | — Pending |
| Admin panel in Phase 1 | Client requires operational tooling from launch | — Pending |
| Three-tier prediction estimation | Client wants cost options: Simple / ARIMA / Full ML | — Pending |
| Bangladesh-first market | Primary audience, Bengali language priority | — Pending |
| Admin-controlled feature gating | Every feature toggleable free/pro by admin in real-time | — Pending |
| Remote session termination | Admin can force-logout users; Redis-backed session store with JWT blacklist | — Pending |
| BDApps carrier billing for Pro | Pro subscription via BDApps charging cycle; auto-disable on lapse after grace period | — Pending |

---
*Last updated: 2026-03-26 after initialization*
