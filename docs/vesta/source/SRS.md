# Software Requirements Specification

**Project:** Vesta v1 — Bilingual Reproductive Health & Cycle Intelligence Platform for Bangladesh
**Document Version:** 1.4
**Date:** 19 October 2026  
**Status:** Draft for Client Sign-Off
**Standard:** IEEE 830-1998

---

## Document Control


| Field             | Value                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Document title    | Software Requirements Specification — Vesta v1                                                                                                                                 |
| Document ID       | SRS-VESTA-001                                                                                                                                                                  |
| Version           | 1.4 
| Issue date        | October 2026
| Source            | `docs/vesta/source/SRS.md`                                                                                                                                                            |
| Published copy    | `docs/site/vesta/vesta-srs.html`                                                                                                                                             |
| Related artifacts | `docs/vesta/source/vesta-kb.md`, `docs/vesta/source/vesta-mvp-plan.html`, `docs/vesta/source/vesta-user-stories.html`, `docs/vesta/source/vesta-user-journey-flows.html`, `docs/vesta/source/bdapps-tap-api.html` |
| Audience          | Client sponsor, product owner, engineering team, QA team, security reviewers                                                                                                   |
| Approval          | Arika/Fakhrul                                                                                                                                                                  |


### Revision History


| Version | Date    | Author | Description                                                       |
| ------- | ------- | ------ | ----------------------------------------------------------------- |
| 1.0     | 2026-04 | Adib   | Initial release derived from the Vesta SRS HTML draft |
| 1.1     | 2026-05-03 | Adib | Deferred Pro auto-disable to v2; added SMS content circulation (FR-SMS); added BDApps webhook endpoints (FR-WEBHOOK) |
| 1.2     | 2026-05-09 | Adib | Client feedback: email fallback auth with 24h trial window; SMS period/fertile alerts for subscribers; profile completion flow post-OTP; in-app feedback module (FR-FEEDBACK); grace period warning policy (no expiry date shown) |
| 1.3     | 2026-06-15 | Adib | V1 client review feedback (Appendix D): logging-encouragement nudges (FR-NUDGE); editable profile mode (FR-PROFILE); goal-based TTC notification filtering (FR-NOTIF, FR-SMS); email+SMS profile-completion reminders (FR-AUTH); configurable analytics dashboards incl. feedback + new user-facing insights (FR-ANALYTICS, FR-FEEDBACK, FR-INSIGHTS); BDApps charging analysis logged as open/blocked |
| 1.4     | 2026-10-19 | Adib | Admin portal reconciliation (ADR 0002, ADR 0006, 2026-10-19 decisions): BDApps subscription replaces CaaS direct debit as the Pro gate; grace period, "recent CAAS results" and "revoke stops next CAAS charge" removed; Revoke, Suspend and Delete also unsubscribe the number on BDApps; admin override ends on a new BDApps subscription; 30-day restore then purge for deleted accounts; admin Logs page and per-user plan history; 7-day admin login and 403 page; SMS language, part counter, CSV upload and queue editing; article images on a server volume; nightly admin-maintenance job |


### Revision Markers

Items added or changed in revisions are marked inline throughout this document:

- ***(v1.1)*** — Added in version 1.1 (2026-05-03): FR-SMS, FR-WEBHOOK, BDApps SMS Send API, inbound webhooks, Pro auto-disable deferred to v2.
- ***(v1.2)*** — Added in version 1.2 (2026-05-09): Email fallback auth with 24h trial window, profile completion flow, in-app feedback module (FR-FEEDBACK), SMS period/fertile alerts for subscribers, content override logic, grace period warning policy.
- ***(v1.3)*** — Added in version 1.3 (2026-06-15): client V1-review feedback round (Appendix D); FR-NUDGE, FR-INSIGHTS; editable profile mode; goal-based notification filtering; proactive profile-completion reminders; configurable analytics dashboards; BDApps charging analysis (open).
- ***(v1.4)*** — Added or changed in version 1.4 (2026-10-19): admin-portal reconciliation to ADR 0002 and ADR 0006; grace period and CaaS admin views removed; unsubscribe on Revoke/Suspend/Delete; 30-day restore and purge; admin Logs page; SMS language and part counter; article image volume; 7-day admin login.
- ***(v1.1; updated v1.2)*** — Introduced in v1.1 and subsequently modified in v1.2.


---

## Table of Contents

1. [Introduction](#1-introduction)
  1.1 [Purpose](#11-purpose)
   1.2 [Scope](#12-scope)
   1.3 [Definitions, Acronyms, and Abbreviations](#13-definitions-acronyms-and-abbreviations)
   1.4 [References](#14-references)
   1.5 [Overview](#15-overview)
2. [Overall Description](#2-overall-description)
  2.1 [Product Perspective](#21-product-perspective)
   2.2 [Product Functions](#22-product-functions)
   2.3 [User Characteristics](#23-user-characteristics)
   2.4 [Constraints](#24-constraints)
   2.5 [Assumptions and Dependencies](#25-assumptions-and-dependencies)
   2.6 [Release Plan — 4-Week MoSCoW](#26-release-plan--4-week-moscow)
3. [Specific Requirements](#3-specific-requirements)
  3.1 [External Interface Requirements](#31-external-interface-requirements)
   3.2 [Functional Requirements](#32-functional-requirements)
   3.3 [Performance Requirements](#33-performance-requirements)
   3.4 [Design Constraints](#34-design-constraints)
   3.5 [Software System Attributes](#35-software-system-attributes)
   3.6 [Other Requirements](#36-other-requirements)
4. [Acceptance Criteria — Definition of Done](#4-acceptance-criteria--definition-of-done)
5. [Appendices](#5-appendices)
  A. [Glossary](#appendix-a--glossary)
   B. [Analysis Models](#appendix-b--analysis-models)
   C. [Requirements Traceability Matrix](#appendix-c--requirements-traceability-matrix)
   D. [Client Review Feedback (V1)](#appendix-d--client-review-feedback-v1)

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) defines the complete set of requirements for **Vesta v1**, a bilingual reproductive-health and cycle-intelligence platform targeting Bangladesh. It specifies what the system shall do (functional requirements), the quality attributes it shall satisfy (non-functional requirements), the external API contracts it depends on (BDApps OTP, BDApps CAAS, Resend), the deployment architecture, and the acceptance criteria that shall pass before v1 is released to production.

This document is the primary reference for:

- Client and product-owner sign-off prior to development.
- Engineering implementation and code review.
- Quality-assurance test design and verification.
- Security and compliance review.

### 1.2 Scope

**Product name:** Vesta v1.

**What the software shall do:**

Vesta v1 shall deliver phone-number-based account management (verified via BDApps OTP, with email login as fallback granting a 24-hour limited-access trial window), multi-profile period tracking with cycle prediction, symptom logging across 30+ symptoms, a monthly calendar visualisation, a fully bilingual user interface (English + Bengali), Pro-tier subscription billing via BDApps CAAS direct debit, transactional email notifications, SMS-based period and fertile-window alerts for Pro subscribers, a bilingual content platform with phase-based article surfacing, an in-app feedback module, and an admin panel containing a content management system and population analytics, SMS-based health content circulation via BDApps SMS Send API (broadcast to all subscribers), and inbound webhook endpoints for BDApps event ingestion.

**Deployment:** The system shall be deployed on Vercel (frontend + API route handlers) and Supabase (PostgreSQL with Row Level Security). Asynchronous workloads shall run on Upstash QStash; cache, session blacklist, and rate-limit state shall reside on Upstash Redis. Transactional email shall be delivered through Resend.

**Out of scope for v1:** Pregnancy mode, native mobile applications, AI health chatbot, doctor consultations, medicine/sleep/exercise tracking, community forum, and partner sharing. These items are queued for v2.

**Benefits and objectives:**

- Provide accessible reproductive-health tracking to Bangladeshi users in their preferred language.
- Enable family managers to maintain up to six profiles from a single account.
- Deliver progressively higher-fidelity cycle predictions as users accumulate logged history.
- Operate at $0/month launch cost with a clearly defined upgrade path.

### 1.3 Definitions, Acronyms, and Abbreviations


| Term               | Definition                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AES-256-GCM**    | Advanced Encryption Standard, 256-bit key, Galois/Counter Mode. The symmetric cipher used to encrypt sensitive health fields at rest via `prisma-field-encryption`. |
| **ARIMA**          | AutoRegressive Integrated Moving Average — Tier 2 statistical model for cycle prediction, unlocked automatically once a profile has 6 logged cycles.                |
| **BDApps**         | The Robi Axiata developer platform that exposes OTP, subscription and SMS APIs used by Vesta for verification, Pro billing and messaging. *(v1.4)*                  |
| **CAAS**           | Carrier Aggregated Application Services — BDApps direct-debit API. Parked: CaaS endpoints return 404 for our app; BDApps subscription charging bills Pro instead (ADR 0002). *(v1.4)* |
| **CRON_SECRET**    | Shared secret in the `Authorization` (or custom) header that authenticates Vercel Cron requests to internal endpoints.                                              |
| **DoD**            | Definition of Done — the formal acceptance gates that shall pass before production release.                                                                         |
| **Email Trial Window** | A 24-hour limited-access period granted to users who authenticate via the email fallback method. During this window the platform collects required user data; after expiry, premium features are locked until subscription. *(v1.2)* |
| **Grace Period**   | Removed in v1.4. BDApps, not CaaS, bills Pro, so there are no balance-check failures to count (ADR 0002 amendment 2026-10-19). *(v1.4)*                              |
| **JWT**            | JSON Web Token — issued in an HttpOnly cookie on successful OTP verification. Carries a `jti` claim used by the blacklist mechanism.                                |
| **LSTM**           | Long Short-Term Memory neural network — Tier 3 prediction model stub planned for v2; not implemented in v1.                                                         |
| **MAE**            | Mean Absolute Error — the per-tier accuracy metric reported by the prediction-accuracy job.                                                                         |
| **MoSCoW**         | Prioritisation method: Must / Should / Could / Won't have. Used to define the four-week release scope.                                                              |
| **MSISDN**         | Mobile Subscriber ISDN — the full international phone number, e.g. `8801XXXXXXXXX`. Primary user identifier in BDApps APIs.                                         |
| **NFR**            | Non-Functional Requirement.                                                                                                                                         |
| **OTP**            | One-Time Password — 4–6 digit code delivered to a user's phone by BDApps for account verification.                                                                  |
| **PII**            | Personally Identifiable Information.                                                                                                                                |
| **Profile Completion Flow** | A post-login popup (triggered ~1 minute after OTP verification) that collects the user's full name, verified phone number, and required profile details. Necessary because OTP verification alone does not reliably persist the phone number in the database. *(v1.2)* |
| **QStash**         | Upstash QStash — HTTP-based serverless job queue replacing BullMQ for asynchronous jobs (email delivery, prediction recalculation).                                 |
| **RLS**            | Row Level Security — PostgreSQL feature restricting which rows a database session can read. Enforced per `user_id` at Supabase.                                     |
| **RBAC**           | Role-Based Access Control. v1 has a single admin role (Super Admin).                                                                                                |
| **Tier 1 / 2 / 3** | The three prediction tiers: Tier 1 = simple average (day 1), Tier 2 = ARIMA (after 6 cycles), Tier 3 = LSTM (v2).                                                   |
| **Tiptap**         | The rich-text editor (v3.x) used by the admin CMS for bilingual article creation.                                                                                   |
| **UAT**            | User Acceptance Testing.                                                                                                                                            |
| **MO (Mobile Originated)** | An SMS sent by a subscriber to the application's short code. Received via the `/api/webhooks/sms/receive` inbound webhook. *(v1.1)* |
| **MT (Mobile Terminated)** | An SMS sent from the application to a subscriber's handset via the BDApps SMS Send API. *(v1.1)* |
| **SMS Broadcast** | Sending an SMS to all subscribers at once using `destinationAddresses: ["tel:all"]` in the BDApps SMS Send API. *(v1.1)* |
| **Webhook** | An HTTP endpoint exposed by the application that receives inbound event notifications (callbacks) from BDApps. *(v1.1)* |


### 1.4 References


| #   | Title                                                | Source                                                                                                               |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| R1  | Vesta v1 — Knowledge Base                            | `docs/vesta/source/vesta-kb.md`                                                                                             |
| R2  | Vesta v1 MVP Plan                                    | `docs/vesta/source/vesta-mvp-plan.html`                                                                                     |
| R3  | Vesta v1 User Stories                                | `docs/vesta/source/vesta-user-stories.html`                                                                                 |
| R4  | Vesta v1 User Journey Flows                          | `docs/vesta/source/vesta-user-journey-flows.html`                                                                           |
| R5  | BDApps Telco Aggregator Platform (TAP) API Reference | `docs/vesta/source/bdapps-tap-api.html`                                                                                     |
| R6  | Published client SRS (HTML form)                     | `docs/site/vesta/vesta-srs.html`                                                                                   |
| R7  | Resend Transactional Email API                       | [https://resend.com/docs](https://resend.com/docs)                                                                   |
| R8  | Upstash QStash Documentation                         | [https://upstash.com/docs/qstash](https://upstash.com/docs/qstash)                                                   |
| R9  | Supabase Row Level Security                          | [https://supabase.com/docs/guides/auth/row-level-security](https://supabase.com/docs/guides/auth/row-level-security) |
| R10 | IEEE Std 830-1998 — Recommended Practice for SRS     | IEEE                                                                                                                 |


### 1.5 Overview

The remainder of this document follows the IEEE 830 structure:

- **Section 2 — Overall Description** sets the product context, identifies the user classes, lists constraints and dependencies, and presents the four-week MoSCoW release plan.
- **Section 3 — Specific Requirements** contains the testable functional, non-functional, and interface requirements. Functional requirements are grouped by capability (FR-AUTH, FR-PROFILE, …) and prioritised P0 / P1 / P2.
- **Section 4 — Acceptance Criteria (Definition of Done)** lists the launch gates that shall pass before production release.
- **Section 5 — Appendices** provide the glossary, analysis models (sign-up flow, Pro subscription lifecycle, infrastructure diagram), and the requirements traceability matrix.

---

## 2. Overall Description

### 2.1 Product Perspective

#### 2.1.1 System Context

Vesta is a self-contained Software-as-a-Service product. It is not a component of a larger product family. End users interact with Vesta via a responsive web application; administrators interact via a separate `/admin` console.

#### 2.1.2 System Interfaces

The system shall integrate with five external services:


| External system | Purpose                                                             |
| --------------- | ------------------------------------------------------------------- |
| BDApps OTP API  | Phone-number ownership verification on sign-up                      |
| BDApps Subscription API | Subscribe/unsubscribe and status queries; CaaS direct debit is parked *(v1.4)* |
| Resend          | Transactional email delivery in EN and BN                           |
| Upstash Redis   | JWT blacklist, session state, rate-limit counters                   |
| Upstash QStash  | Asynchronous job dispatch (email worker, prediction recalc)         |


#### 2.1.3 User Interfaces

The user interface shall be:

- **Responsive** — fully usable at 375 px, 768 px, and 1280 px viewports.
- **Bilingual** — every string available in English and Bengali; Bengali shall use Noto Sans Bengali.
- **Touch-friendly** — symptom logging uses an icon-tap UI requiring no text input.

The admin interface shall be a separate route tree (`/admin/*`) protected by Super Admin authentication middleware.

#### 2.1.4 Hardware Interfaces

Vesta has no direct hardware-interface requirements. End users shall access the application from any device with a modern web browser and a Bangladeshi mobile number.

#### 2.1.5 Software Interfaces


| Interface          | Version / Detail                                                 |
| ------------------ | ---------------------------------------------------------------- |
| Frontend framework | Next.js 16, React 19, TypeScript                                 |
| Styling            | Tailwind CSS v4 (CSS-first config)                               |
| State              | TanStack Query (server state) + Zustand (UI/locale)              |
| Backend            | Next.js Route Handlers (TypeScript)                              |
| ORM                | Prisma 6.13 (pinned for `prisma-field-encryption` compatibility) |
| Database           | PostgreSQL 16 on Supabase (with RLS, `pgcrypto`)                 |
| Encryption         | `prisma-field-encryption` (AES-256-GCM)                          |
| i18n               | i18next + react-i18next                                          |
| Charts             | Recharts 3.x                                                     |
| CMS editor         | Tiptap 3.x                                                       |


#### 2.1.6 Communications Interfaces

All external service calls shall use HTTPS. BDApps endpoints shall be invoked with `applicationId` + `password` in the request body. Internal cron endpoints shall be authenticated via the `CRON_SECRET` header. JWTs shall be transported in `HttpOnly`, `Secure`, `SameSite=Lax` cookies.

#### 2.1.7 Memory Constraints

Free-tier service limits shall apply at launch (see [§2.4 Constraints](#24-constraints)). Notably, Supabase Free imposes a 500 MB database cap; encrypted health blobs shall be monitored against this cap.

#### 2.1.8 Operations

Scheduled operations run from a host crontab on the production VPS (Vercel Cron applies only to Vercel deployments): *(v1.4)*

- `0 8 * * *` (08:00 UTC) — daily reminders worker.
- `0 2 * * *` (02:00 UTC) — nightly BDApps subscription status check. *(v1.4)*
- Nightly admin-maintenance entry — stores the dated per-tier prediction-accuracy snapshot and purges accounts deleted more than 30 days ago. *(v1.4)*

#### 2.1.9 Site Adaptation Requirements

The application shall be deployable to a single Vercel project bound to a single Supabase project. No on-premise installation is supported in v1.

### 2.2 Product Functions

The system provides the following major capabilities. Each item below is expanded into a fully specified functional requirement in [§3.2](#32-functional-requirements).


| Capability                                      | FR ID        | Priority |
| ----------------------------------------------- | ------------ | -------- |
| Phone authentication via BDApps OTP             | FR-AUTH      | P0       |
| Multi-profile account management                | FR-PROFILE   | P0       |
| Period logging                                  | FR-TRACK     | P0       |
| Cycle dashboard                                 | FR-DASH      | P0       |
| Monthly calendar                                | FR-CAL       | P0       |
| Symptom logging                                 | FR-SYMP      | P0       |
| Three-tier prediction engine                    | FR-PRED      | P0       |
| Onboarding flow                                 | FR-ONBOARD   | P0       |
| Pro subscription via BDApps subscription *(v1.4)* | FR-BILL      | P0       |
| Feature gating (schema-only in v1)              | FR-GATE      | P0       |
| Bilingual UI (EN + BN)                          | FR-I18N      | P0       |
| Field-level encryption                          | FR-ENC       | P0       |
| Session store & JWT blacklist                   | FR-SESSION   | P0       |
| Email notifications & per-profile preferences   | FR-NOTIF     | P1       |
| Bilingual content platform                      | FR-CONTENT   | P1       |
| Admin dashboard, user & subscription management | FR-ADMIN     | P2       |
| Content CMS (Tiptap)                            | FR-CMS       | P2       |
| Population analytics & prediction accuracy      | FR-ANALYTICS | P2       |
| Data export (CSV / Excel)                       | FR-EXPORT    | P2       |
| SMS content circulation via BDApps              | FR-SMS       | P1       | *(v1.1)* |
| BDApps inbound webhook endpoints                | FR-WEBHOOK   | P0       | *(v1.1)* |
| In-app feedback module                          | FR-FEEDBACK  | P1       | *(v1.2)* |


### 2.3 User Characteristics


| Stakeholder        | Description                                                                                                                                                                            | Primary Interactions                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **End User**       | Individual tracking her own cycle. Primary persona. Uses a phone-number account on the free tier. Assumed literacy in either Bengali or English; comfortable with smartphone web apps. | Onboarding, period logging, dashboard, calendar, symptom logging                              |
| **Family Manager** | A user who manages profiles for family members (wife, sister, mother, daughter, girlfriend). Up to six profiles per account.                                                           | Profile switcher, per-profile data isolation                                                  |
| **Pro Subscriber** | A user whose number BDApps reports as subscribed (`REGISTERED`); logging in by phone subscribes the number (ADR 0002). *(v1.4)* The subscription field is persisted in v1 even though feature gating is deferred.                                         | Subscription flow; grace-period notifications                                                 |
| **Email Trial User** *(v1.2)* | A transient user class — a user who authenticated via email fallback (OTP unavailable). Has a 24-hour limited-access window to explore basic features and complete profile data. After 24 hours, premium features are locked until subscription. | Profile completion, basic feature exploration, data collection |
| **Super Admin**    | Technical owner with full system access — user management, subscription management, analytics, and bilingual content publishing. (v1 has no separate Content Admin role.)              | Admin panel, session management, KPIs, Tiptap CMS, article publish/edit, phase-tag assignment |


### 2.4 Constraints


| ID          | Constraint                              | Detail                                                                      | Impact                                                                                                          |
| ----------- | --------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| CON-TECH-01 | BDApps OTP as primary authentication *(v1.2)* | Primary auth is BDApps OTP; email login is available as fallback when OTP is unavailable. Email-authenticated users receive a 24-hour limited-access trial window. | Primary sign-up uses phone numbers in `tel:8801XXXXXXXXX` format; email fallback grants time-limited access     |
| CON-TECH-02 | Vercel Hobby 10-second function timeout | Serverless functions shall complete within 10 s                             | Prediction recalculation shall be asynchronous via QStash; no synchronous long jobs                             |
| CON-TECH-03 | Supabase Free 500 MB storage            | Free tier PostgreSQL is capped at 500 MB before auto-pause                  | Encrypted health blobs increase row size; storage shall be monitored and the upgrade trigger shall be respected |
| CON-REG-01  | BDT currency only                       | BDApps CAAS processes only Bangladeshi Taka                                 | Pro subscription pricing shall be denominated in BDT                                                            |
| CON-TECH-04 | Prisma pinned to 6.13                   | `prisma-field-encryption` requires Prisma 6.13.x                            | Prisma shall not be upgraded without verifying encryption-library compatibility                                 |
| CON-TECH-05 | 2 Vercel Cron jobs maximum              | Hobby plan permits exactly two scheduled cron jobs                          | Superseded in v1.4: production runs a host crontab on the VPS, so there is no Vercel Cron job limit                                                   |


### 2.5 Assumptions and Dependencies


| ID    | Assumption / Dependency                                                                                                                                                     |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AD-01 | BDApps OTP and subscription APIs are reachable from Vercel egress; transient errors are tolerated via exponential backoff. *(v1.4)*                         |
| AD-02 | Robi/BDApps upstream rate-limiting may engage before app-level rate limits and may surface to users as throttling errors even when below documented application thresholds. |
| AD-03 | Resend free-tier limits (3,000 emails/month, 100/day) are sufficient for v1 traffic.                                                                                        |
| AD-04 | Supabase keep-alive ping prevents Free-tier auto-pause; if it does not, the upgrade trigger to Supabase Pro shall be activated.                                             |
| AD-05 | Users have consistent enough internet connectivity to complete OTP verification within the 60-second resend cooldown.                                                       |
| AD-06 | The Pro subscription pricing model is monthly direct-debit; no annual or one-time billing is in scope for v1.                                                               |
| AD-07 | LSTM (Tier 3) prediction is explicitly deferred to v2; Tier 3 in v1 is a stub.                                                                                              |
| AD-08 | Email login is a secondary fallback method; the majority of users are expected to authenticate via BDApps OTP. Email login via Resend magic-link counts against the 3K/mo free-tier email budget. *(v1.2)* |
| AD-09 | The profile-completion popup (~1 minute after OTP login) is necessary because BDApps OTP verification alone does not reliably persist the user's phone number in the database. *(v1.2)* |


### 2.6 Release Plan — 4-Week MoSCoW

v1 shall ship in four weeks. The scope is fixed by the buckets below. Anything in the *Won't Have* bucket is explicitly out of v1 and queued for v2.


| Priority             | Window     | Features                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0 (Must Have)**   | Weeks 1–2  | Phone auth + BDApps OTP verification • Email fallback login with 24-hour trial window • Profile completion popup (post-OTP) • Multi-profile accounts (self, wife, sister, mother, daughter, girlfriend) • Bilingual UI (EN + BN, i18next) • Period tracking (start/end, flow intensity, retroactive editing) • Cycle dashboard (day hero, phase label, countdown) • Monthly calendar (period / fertile / ovulation) • Symptom logging (30+ symptoms, 4 categories) • Three-tier prediction engine (Avg → ARIMA → LSTM stub) • Onboarding flow (trust screens, goal, cycle history) • Field-level encryption (AES-256-GCM) • Profile switcher with data isolation • **Feature gating — email trial 24h expiry + subscription schema** • Redis session store + JWT blacklist • BDApps CAAS charging for Pro • BDApps webhook endpoints (SMS receive, SMS report, USSD, subscription/CAAS notifications) |
| **P1 (Should Have)** | Week 3     | Email notifications (period alert, fertile window, logging reminder) • SMS period/fertile alerts for Pro subscribers • Content platform (bilingual articles, phase-based) • Notification preferences per-profile • SMS content circulation (admin batch upload, daily broadcast via BDApps SMS Send API) • In-app feedback module                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **P2 (Could Have)**  | Week 4     | Admin dashboard + user management • Content CMS (Tiptap) • Population health analytics • Prediction accuracy reports • **Single Super Admin role** (Content Admin role removed) • Admin session + subscription management • Data export (CSV / Excel)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Won't Have**       | v2 backlog | Partner sharing • Pregnancy mode • Native mobile apps • AI health chatbot • Doctor consultations • Medicine / sleep / exercise tracker • Community forum • Auto-disable Pro on charging lapse + grace period (deferred from v1 P0)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |


---

## 3. Specific Requirements

### 3.1 External Interface Requirements

#### 3.1.1 User Interface Requirements


| ID     | Requirement                                                                                                                                               |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UIR-01 | The UI shall render correctly without horizontal scroll at 375 px viewport in both English and Bengali modes.                                             |
| UIR-02 | The language toggle shall be available on every screen and shall persist preference across page reloads.                                                  |
| UIR-03 | Symptom selection shall use an icon-based, tap-to-select control with no required text input.                                                             |
| UIR-04 | The calendar shall use distinguishable colour codes for period (pink), fertile window (teal), and ovulation day (accent).                                 |
| UIR-05 | The dashboard shall display a hero day number, current cycle phase, countdown to next predicted period, last-period summary, and a confidence percentage. |


#### 3.1.2 Hardware Interface Requirements

No direct hardware interfaces. The product shall execute on standard cloud-hosted infrastructure (see §2.1.5).

#### 3.1.3 Software Interface Requirements

##### 3.1.3.1 BDApps OTP API — User Verification

**Base URL:** `https://developer.bdapps.com`
**Authentication:** `applicationId` + `password` in request body.
**Method:** `POST` with `Content-Type: application/json` for all endpoints.

`**POST /otp/request`** — Sends an OTP to the subscriber's mobile number.


| Parameter         | Required | Description                                      |
| ----------------- | -------- | ------------------------------------------------ |
| `applicationId`   | yes      | BDApps application identifier (from environment) |
| `password`        | yes      | BDApps application password (from environment)   |
| `subscriberId`    | yes      | Phone in `tel:8801XXXXXXXXX` format              |
| `applicationHash` | no       | App hash for Android SMS auto-fill               |


**Success response fields:** `statusCode = "S1000"`, `referenceNo` (token to pass to `otp/verify`).

**Example request body:**

```json
{
  "applicationId": "APP_123456",
  "password": "secret",
  "subscriberId": "tel:8801712345678"
}
```

`**POST /otp/verify**` — Verifies the OTP entered by the user.


| Parameter       | Required | Description                     |
| --------------- | -------- | ------------------------------- |
| `applicationId` | yes      | BDApps application identifier   |
| `password`      | yes      | BDApps application password     |
| `referenceNo`   | yes      | Token returned by `otp/request` |
| `otp`           | yes      | Code entered by the user        |


**Success response fields:** `statusCode = "S1000"`, `subscriptionStatus` (`SUBSCRIBED` / `UNSUBSCRIBED`), `subscriberId` (confirmed MSISDN).

**Sign-up flow:**

```
User enters phone
  → POST otp/request
  → referenceNo returned
  → User enters OTP
  → POST otp/verify
  → Account created + JWT
```

**Error path:** On BDApps error, the system shall apply exponential-backoff retry; after three attempts a user-friendly error shall be displayed; OTP resend shall be permitted after a 60-second cooldown.

##### 3.1.3.2 BDApps CAAS API — Subscription Billing

> **(v1.4) Parked.** CaaS endpoints return 404 for our app; BDApps subscription charging bills Pro instead (ADR 0002). This section is kept for reference only.

**Base URL:** `https://developer.bdapps.com`
**Currency:** BDT only.
**Note:** `paymentInstrumentName` shall be pre-registered in the BDApps dashboard.

`**POST /caas/direct/debit`** — Charges the subscriber's mobile balance directly. Called when the user selects a Pro plan. A unique `externalTrxId` shall be sent per transaction for idempotency.


| Parameter               | Required | Description                              |
| ----------------------- | -------- | ---------------------------------------- |
| `applicationId`         | yes      | BDApps application identifier            |
| `password`              | yes      | BDApps application password              |
| `externalTrxId`         | yes      | Unique transaction ID (UUID recommended) |
| `subscriberId`          | yes      | User MSISDN (`tel:8801XXXXXXXXX`)        |
| `paymentInstrumentName` | yes      | Pre-registered billing instrument        |
| `amount`                | yes      | Charge amount in BDT (integer)           |


**Success response fields:** `externalTrxId`, `internalTrxId`, `referenceId`, `timeStamp`.

`**POST /caas/get/balance`** — Queries the subscriber's chargeable balance and account status. Parked in v1.4: CaaS endpoints return 404 for our app and the nightly BDApps `getStatus` check replaces this balance check.


| Parameter               | Required | Description                   |
| ----------------------- | -------- | ----------------------------- |
| `applicationId`         | yes      | BDApps application identifier |
| `password`              | yes      | BDApps application password   |
| `subscriberId`          | yes      | User MSISDN                   |
| `paymentInstrumentName` | yes      | Billing instrument name       |


**Success response fields:** `accountType`, `accountStatus` (`ACTIVE` / `SUSPENDED`), `chargeableBalance` (BDT).

**Pro Subscription Lifecycle:** see [Appendix B.2](#b2-pro-subscription-lifecycle).

##### 3.1.3.3 Resend Email API


| Template             | Trigger                                       | Recipient     | Languages |
| -------------------- | --------------------------------------------- | ------------- | --------- |
| **Period Alert**     | Daily cron: predicted period starts in 2 days | Profile owner | EN + BN   |
| **Fertile Window**   | Daily cron: fertile window starts today       | Profile owner | EN + BN   |
| **Logging Reminder** | Daily cron: no log in past 3 days             | Profile owner | EN + BN   |


Free-tier limits shall be respected: 3,000 emails/month, 100/day. Notification preferences are per-profile and shall respect opt-out flags.

##### 3.1.3.4 BDApps SMS Send API — Content Broadcast *(v1.1)*

**Endpoint:** `POST https://developer.bdapps.com/sms/send`
**Authentication:** `applicationId` + `password` in request body.
**Method:** `POST` with `Content-Type: application/json`.

| Parameter | Required | Description |
|---|---|---|
| `applicationId` | yes | BDApps application identifier (from environment) |
| `password` | yes | BDApps application password (from environment) |
| `message` | yes | SMS content text |
| `destinationAddresses` | yes | Array of MSISDNs, or `["tel:all"]` for broadcast to all subscribers |
| `sourceAddress` | no | Sender ID / short code |
| `deliveryStatusRequest` | no | `1` to receive delivery reports via webhook; `0` to skip |

**Success response fields:** `messageId` (unique message identifier), `status` (`SUCCESS` / `FAILED`).

**Broadcast capability:** Setting `destinationAddresses` to `["tel:all"]` sends the SMS to every active subscriber. This is the mechanism used for daily health-content circulation.

##### 3.1.3.5 BDApps Inbound Webhooks *(v1.1)*

The application shall expose four route-handler endpoints to receive inbound event callbacks from BDApps. These URLs are registered in the BDApps developer portal.

| Webhook endpoint | BDApps event | Key payload fields |
|---|---|---|
| `POST /api/webhooks/sms/receive` | Inbound SMS (MO) from subscriber | `sourceAddress`, `message`, `messageId`, `timeStamp` |
| `POST /api/webhooks/sms/report` | SMS delivery status report | `destinationAddress`, `requestId`, `deliveryStatus` (`DELIVERED` / `FAILED` / `PENDING`), `timeStamp` |
| `POST /api/webhooks/ussd/receive` | USSD session events | `subscriberId`, `ussdContent`, `sessionId`, `status` |
| `POST /api/webhooks/subscription/notify` | Subscription status changes (and payment confirmations if CaaS is ever enabled) | `subscriberId`, `status` (`ACTIVE` / `INACTIVE` / `SUSPENDED` / `EXPIRED`), `reason`, `timeStamp` |

All webhook endpoints shall respond with HTTP 200 within 5 seconds. Validation shall be enforced via IP whitelist or request signature as configured in the BDApps portal.

#### 3.1.4 Communications Interface Requirements


| ID     | Requirement                                                                                              |
| ------ | -------------------------------------------------------------------------------------------------------- |
| CIR-01 | All external API calls shall use HTTPS (TLS 1.2 or higher).                                              |
| CIR-02 | JWT cookies shall be `HttpOnly`, `Secure`, and `SameSite=Lax`.                                           |
| CIR-03 | Cron endpoints shall reject any request whose `CRON_SECRET` header does not match the configured secret. |
| CIR-04 | BDApps requests and responses shall use `Content-Type: application/json`.                                |
| CIR-05 | Webhook endpoints shall validate inbound BDApps requests via IP whitelist or payload signature verification. *(v1.1)* |


### 3.2 Functional Requirements

Each functional requirement below states the expected behaviour and the testable acceptance criteria. All requirements are written in the imperative voice using "shall" for mandatory behaviour. Priority follows the MoSCoW buckets in §2.6 (P0 = Must, P1 = Should, P2 = Could).

#### FR-AUTH — Phone Authentication via BDApps OTP (with Email Fallback) *(updated v1.2)*

**Priority:** P0

**Requirements — OTP (primary):**

- The system shall allow a user to register with a Bangladeshi mobile number in 11-digit MSISDN format (`tel:8801XXXXXXXXX`).
- The system shall call BDApps `otp/request` and dispatch the OTP to the user's phone.
- The user shall enter the OTP, and the system shall call `otp/verify` to confirm; the account shall be created on success.
- The system shall offer OTP resend only after a 60-second cooldown.
- The system shall apply exponential-backoff retry on BDApps API failures.
- On successful verification, the system shall issue a JWT in an `HttpOnly` cookie.
- On logout, the system shall add the JWT's `jti` to an Upstash Redis blacklist.

**Requirements — Email fallback:** *(v1.2)*

- If BDApps OTP is unavailable or login is unsuccessful after retries, the system shall offer email-based login as an alternative method.
- Email login shall use a magic-link flow delivered via Resend.
- Users authenticated via email shall receive a **24-hour limited-access window** (Email Trial Window).
- During the 24-hour window: the platform shall collect all required user data (including phone number and profile details); users can explore basic features.
- After 24 hours: premium features and sensitive data shall be locked; a BDApps subscription (phone login) shall be required for continued access.
- The system shall track `auth_method` (`otp` | `email`) and `email_trial_expires_at` on the user record.
- The 24-hour trial ensures full onboarding data collection during the window while enabling conversion to paid users.

**Requirements — Profile completion flow (post-login):** *(v1.2)*

- After successful OTP verification, a profile-completion popup shall appear approximately 1 minute after login, prompting the user to provide all required personal information.
- The popup shall collect: full name, verified phone number, and required profile details.
- This step is necessary because OTP verification alone does not reliably provide or store the user's phone number in the database.
- Profile completion status shall be tracked; incomplete profiles shall be re-prompted on subsequent logins until complete.
- The verified phone number shall be stored securely during this flow.
- Profile-completion reminders shall be delivered proactively via email (Resend) and SMS (BDApps) — not only via the in-app modal — on a capped schedule (e.g. through the daily-reminders cron) until the profile is complete or the user opts out. *(v1.3)*

**Acceptance criteria:**

- A new user shall be able to complete sign-up end-to-end in production using a real Bangladeshi number.
- Invalid OTP entry shall display an error; correct OTP shall create the account and redirect to onboarding.
- The resend button shall remain disabled for 60 s, then re-enable.
- A logged-out JWT shall be rejected on subsequent API calls.
- The rate limiter shall block more than three OTP requests per minute from the same IP.
- When OTP is unavailable, the email fallback login screen shall be displayed and a magic-link email shall be delivered via Resend. *(v1.2)*
- An email-authenticated user shall have full basic-feature access for 24 hours; after expiry, premium features shall return HTTP 403. *(v1.2)*
- The profile-completion popup shall appear ~1 minute after OTP login and shall persist until the user completes all required fields. *(v1.2)*
- A user who dismisses the popup shall be re-prompted on the next login. *(v1.2)*

#### FR-PROFILE — Multi-Profile Account Management

**Priority:** P0

**Requirements:**

- One user account shall support up to six profiles: self, wife, sister, mother, daughter, girlfriend.
- Each profile shall have an independent cycle history, symptoms, and predictions.
- The profile switcher shall be accessible from the main navigation.
- Profiles shall be creatable, renameable, and deletable.
- Data isolation shall be enforced both at API middleware and at PostgreSQL RLS levels.
- A user shall be able to change a profile's tracking mode / goal (`tracking`, `conceive`, `perimenopause`) from profile settings at any time after onboarding; the change shall take effect immediately and shall re-tailor predictions, nudges, and notifications accordingly. *(v1.3)*

**Acceptance criteria:**

- A user shall be able to create six profiles and switch between them; each shall display independent dashboard data.
- A direct DB query shall confirm that user A's `period_logs` are not readable by user B's session.
- Deleting a profile shall remove all associated `period_logs`, `symptom_logs`, and predictions.

#### FR-TRACK — Period Logging

**Priority:** P0

**Requirements:**

- The user shall log period start date, end date, and flow intensity (light / medium / heavy).
- The user shall be able to retroactively edit past period entries.
- Each log creation or update shall trigger an asynchronous prediction recalculation via QStash.

**Acceptance criteria:**

- A period log shall be saved, prediction recalculation shall complete, and the calendar shall be updated within 10 seconds end-to-end.
- Editing a past entry shall update predictions; the dashboard shall reflect new values within 10 seconds.

#### FR-DASH — Cycle Dashboard

**Priority:** P0

**Requirements:**

- The dashboard shall display the current cycle day as a hero element (e.g. "Day 14").
- The dashboard shall display the current phase label: Menstrual / Follicular / Ovulatory / Luteal.
- The dashboard shall display a countdown to the next predicted period.
- The dashboard shall display a last-period summary (start date, duration, flow).
- The dashboard shall display the prediction confidence percentage.

**Acceptance criteria:**

- The dashboard shall load with all five data points rendered correctly.
- A new user without history shall see an "estimate" disclaimer and a Tier 1 prediction seeded from onboarding data.

#### FR-CAL — Monthly Calendar

**Priority:** P0

**Requirements:**

- The calendar shall present a month-grid view with colour-coded dates: period (pink), fertile window (teal), ovulation day (accent).
- The calendar shall provide previous/next month navigation.
- The calendar shall update automatically after prediction recalculation.

**Acceptance criteria:**

- The calendar shall show correct colour coding for logged and predicted periods across three future months.
- Month navigation shall work without layout breakage at 375 px.

#### FR-SYMP — Symptom Logging

**Priority:** P0

**Requirements:**

- The system shall expose 30+ symptoms across four categories: Physical, Mood, Discharge, Lifestyle.
- The selection UI shall be icon-based and tap-to-select (no text entry required).
- The user shall be able to log symptoms for any date via a date picker.

**Acceptance criteria:**

- All 30+ symptoms across all four categories shall render correctly and shall be persistable.
- The decrypted symptom value shall be returned to the correct user via the API.

#### FR-PRED — Three-Tier Prediction Engine

**Priority:** P0

**Requirements:**

- **Tier 1 — Simple average:** available from day one, shall use onboarding-provided cycle history.
- **Tier 2 — ARIMA:** shall unlock automatically once a profile has 6 logged cycles; shall provide higher accuracy.
- **Tier 3 — LSTM stub:** planned for v2; v1 shall include only a stub.
- Recalculation shall be asynchronous (QStash job); the UI shall show an "updating" state while in flight.
- Outputs shall include: `next_period_start`, `ovulation_day`, `fertile_start`, `fertile_end`, `confidence`.

**Acceptance criteria:**

- A new user with one logged cycle shall see Tier 1 predictions with an "estimate" disclaimer.
- A user with six or more cycles shall automatically receive Tier 2 predictions (verifiable as `predictions.tier = 'ARIMA'`).
- A confidence percentage shall be displayed and shall update after each new period log.

#### FR-ONBOARD — Onboarding Flow

**Priority:** P0

**Requirements:**

- The onboarding flow shall present trust/privacy screens explaining data handling before any personal input.
- The user shall select a goal: period tracking / trying to conceive / perimenopause.
- The user shall enter cycle history: typical cycle length, typical period length, last period date.
- Onboarding data shall seed Tier 1 predictions immediately.

**Acceptance criteria:**

- A new user shall complete onboarding and land on the dashboard with Tier 1 predictions pre-populated.
- Onboarding shall be skippable; the user shall still reach the dashboard, where predictions shall display "add your first period".

#### FR-BILL — Pro Subscription via BDApps Subscription *(updated v1.4)*

**Priority:** P0

**Requirements:**

- Pro means BDApps reports the user's number as `REGISTERED` (ADR 0002). Verifying a phone OTP subscribes the number and makes the user Pro. *(v1.4)*
- BDApps `UNREGISTERED` — reported by the subscription-notify webhook, the nightly `getStatus` check, or the in-app Unsubscribe button — makes the user Free; data is kept. *(v1.4)*
- CaaS direct debit (`caas/direct/debit`, `caas/get/balance`) is parked and not part of v1; BDApps subscription charging bills Pro. *(v1.4)*
- The grace period, `consecutive_failures` counting and the grace-period warning notifications are removed, not deferred. *(v1.4)*
- **Unsubscribe on access removal:** the admin actions Revoke, Suspend and Delete each also unsubscribe the number on BDApps (`/subscription/send`, action `0`). Reactivate and Restore lift only the block and do not re-subscribe; the user logs in by phone to subscribe again (ADR 0006). *(v1.4)*
- **Admin override:** a plan (Free or Pro) set by an admin wins over what BDApps reports only until BDApps reports a new subscription for that number; a repeat status of the old subscription does not end it. *(v1.4)*
- A failed BDApps unsubscribe shall be surfaced to the admin, never swallowed; our side of the action still applies. *(v1.4)*

**Acceptance criteria:**

- A successful phone OTP verify shall make the user Pro and store the subscriber id. *(v1.4)*
- A BDApps `UNREGISTERED` event shall make the user Free without deleting data. *(v1.4)*
- Revoke, Suspend and Delete shall each call BDApps unsubscribe; Reactivate and Restore shall not call BDApps. *(v1.4)*
- A revoked user who subscribes again shall become Pro (the override ends on the new subscription). *(v1.4)*

#### FR-GATE — Feature Gating (Email Trial + Subscription Schema) *(updated v1.2)*

**Priority:** P0

**Requirements:**

- A `subscription_status` column shall exist on the user/profile table with values `free | pro | lapsed` and default `free`.
- The BDApps subscription flow (OTP verify, webhook, nightly check) shall keep `subscription_status` accurate so that future Pro/free gating can rely on the field. *(v1.4)*
- **Email trial gating (active in v1):** *(v1.2)* The system shall enforce the 24-hour email trial window. Users authenticated via email shall have `auth_method = 'email'` and `email_trial_expires_at` tracked. After the 24-hour window expires, premium features and sensitive data shall be locked (HTTP 403). A BDApps subscription (phone login) shall be required for continued access.
- **Pro/free feature gating (deferred — post-v1):** Subscription-based gating logic (free vs. pro tier enforcement, upgrade prompts, Pro-only endpoints) shall be deferred to post-v1. The schema is in place so gating can be enabled later without a schema change.

**Acceptance criteria:**

- The migration shall create the `subscription_status` column with default `free`.
- An email-authenticated user shall have full basic-feature access for 24 hours; after the trial window expires, premium routes shall return HTTP 403.
- OTP-authenticated users shall not be subject to any trial window restriction.
- The `subscription_status` field shall be queryable; future Pro/free middleware shall be able to read it without a schema change.
- No route shall return 403 based on `subscription_status` in v1 (Pro/free gating deferred); only email trial expiry shall trigger gating.

#### FR-I18N — Bilingual UI (English + Bengali)

**Priority:** P0

**Requirements:**

- Every UI string shall be available in both English and Bengali from day one.
- The Noto Sans Bengali font shall be loaded for Bengali mode.
- Language preference shall be persisted per user account.
- Bengali text is 20–40% longer than English; all components shall be tested for overflow.

**Acceptance criteria:**

- Every page shall render without broken layout in Bengali at 375 px viewport.
- The language toggle shall work on every screen, and the preference shall survive a page reload.

#### FR-ENC — Field-Level Encryption

**Priority:** P0

**Requirements:**

- Sensitive health fields (`symptom_logs.value`, health notes) shall be encrypted at rest using AES-256-GCM.
- Encryption shall be handled transparently by `prisma-field-encryption`.
- Decryption shall occur only in the application layer; the raw database shall contain only cipher text.

**Acceptance criteria:**

- A direct SQL query of `symptom_logs` shall return cipher text rather than plain text.
- The application API shall return the correct decrypted value to the authenticated user.
- A CI integration test shall verify the encrypt → store → retrieve → decrypt round-trip.

#### FR-SESSION — Session Store & JWT Blacklist

**Priority:** P0

**Requirements:**

- A JWT shall be issued on successful OTP verification and stored as an `HttpOnly` cookie.
- On logout, the system shall add the JWT's `jti` to the Upstash Redis blacklist until token expiry.
- Auth middleware shall reject any token whose `jti` is on the blacklist.
- Rate-limit counters for OTP request and login attempts shall be stored in Redis.
- Note: Robi/BDApps upstream rate limiting may engage before app-level limits and may surface to users as throttling even below app thresholds.

**Acceptance criteria:**

- A logged-out user's old token shall return 401 even before its `exp` claim.
- The blacklist entry TTL shall match the remaining JWT lifetime; there shall be no permanent growth of blacklist storage.
- More than three OTP requests per minute from the same MSISDN shall return HTTP 429.

#### FR-WEBHOOK — BDApps Inbound Webhooks *(v1.1)*

**Priority:** P0

**Requirements:**

- The system shall expose four Next.js route-handler endpoints to receive BDApps webhook callbacks: `/api/webhooks/sms/receive`, `/api/webhooks/sms/report`, `/api/webhooks/ussd/receive`, `/api/webhooks/subscription/notify`.
- Each endpoint shall validate the inbound request via IP whitelist or signature verification as configured in the BDApps portal.
- Each endpoint shall persist the event payload in a `webhook_events` log table for audit and debugging.
- The `/api/webhooks/subscription/notify` endpoint shall update `subscription_status` in the `subscriptions` table on status changes (ACTIVE → pro; INACTIVE / SUSPENDED / EXPIRED → lapsed).
- The `/api/webhooks/sms/report` endpoint shall update the delivery status for the corresponding SMS broadcast message when delivery reports are enabled. Our BDApps SMS plan has delivery reports disabled (E1312), so sends request none and the admin shows "sent / failed to send"; the webhook code is kept for a plan change. *(v1.4)*
- The `/api/webhooks/sms/receive` endpoint shall log inbound subscriber messages for admin review.
- The `/api/webhooks/ussd/receive` endpoint shall log USSD session events; interactive USSD menus are deferred to v2.
- All webhook handlers shall respond with HTTP 200 within 5 seconds to prevent BDApps retry storms.
- Duplicate events (same `messageId` or `timeStamp`) shall be deduplicated via idempotency checks.

**Acceptance criteria:**

- Each webhook endpoint shall return HTTP 200 on a valid BDApps payload and HTTP 401 on an invalid or unsigned request.
- A subscription status change via the subscription/notify webhook shall update `subscription_status` in the database within 1 second.
- When delivery reports are enabled, an SMS delivery report shall update the broadcast message status visible in the admin panel. *(v1.4)*
- Duplicate webhook payloads shall not create duplicate records.

#### FR-NOTIF — Email Notifications & Per-Profile Preferences

**Priority:** P1

**Requirements:**

- The system shall support three notification types: period start alert, fertile-window opening, daily logging reminder.
- A daily cron at `/api/cron/daily-reminders` shall evaluate each active profile and shall dispatch email jobs to QStash.
- A QStash worker shall call Resend with React Email templates in the user's preferred language (EN or BN).
- Per-profile toggles in `notification_preferences` shall let users enable/disable each type independently.
- Failed Resend deliveries shall be retried by QStash; permanent failures shall be logged for admin review.
- The notification set shall adapt to each profile's goal. When the goal is `conceive` (trying to conceive), the system shall surface fertile-window alerts and shall suppress period and logging-reminder notifications by default; the user may override this in notification preferences. *(v1.3)*

**Acceptance criteria:**

- A period-alert email shall arrive in the inbox within one hour of the cron run on the predicted day.
- Toggling a notification preference off shall prevent future emails of that type for that profile.
- A BN-preference user shall receive a Bengali-translated subject and body.
- Daily volume shall stay within Resend free-tier limits (3 K/mo, 100/day) at v1 scale.

#### FR-CONTENT — Bilingual Content Platform

**Priority:** P1

**Requirements:**

- Health articles shall be published with both English and Bengali bodies in a single record.
- Articles shall be tagged with one or more cycle phases (menstrual, follicular, ovulation, luteal) and a category.
- The reader UI shall surface articles relevant to the user's current phase first.
- The article body shall render in the user's active locale; if the translation is missing, it shall fall back to the other language with a clear indicator.

**Acceptance criteria:**

- The article list shall filter by phase tag and shall render correctly in both languages.
- Switching the language toggle shall update the body text without a page reload.
- An article missing a translation shall display a clear locale-fallback indicator.

#### FR-SMS — SMS Notifications & Content Circulation via BDApps *(v1.1; updated v1.2)*

**Priority:** P1

**Requirements — SMS period/fertile alerts (subscriber-only):** *(v1.2)*

- Pro subscribers shall receive automated SMS notifications before expected period dates and fertile window openings.
- These SMS alerts may be integrated with the daily content delivery system (sent during the same 08:00 UTC cron window).
- SMS-based alerts and premium daily content delivery shall be available **exclusively for subscribed (Pro) users**. Free-tier and email-trial users shall not receive SMS alerts.

**Requirements — Daily content circulation:**

- The Super Admin shall be able to create SMS content messages (short health tips, reminders, educational content) in both English and Bengali.
- The admin panel shall support batch-uploading multiple SMS messages via CSV upload (header row; columns for scheduled date, English text and Bengali text; quoted fields) or a form-based bulk-entry interface. *(v1.4)*
- The admin shall be able to schedule messages for daily dispatch — one message per day from the queue, sent during the existing daily-reminders cron window (08:00 UTC).
- The system shall call BDApps `sms/send` with `destinationAddresses: ["tel:all"]` to broadcast the day's scheduled message to all subscribers.
- **Content override logic:** *(v1.2)* When new daily content is published, the previous day's content shall automatically be replaced/deactivated. Only the latest content version shall remain active and visible.
- Every broadcast shall be sent with `deliveryStatusRequest: 0` because BDApps delivery reports are disabled on our plan (E1312). *(v1.4)*
- Each broadcast shall store a send language (`BN`, `EN` or `BOTH`), and the composed message shall follow it. *(v1.4)*
- The compose form shall show a live SMS-part counter: GSM-7 at 160/153 characters per part, UCS-2 (Bengali) at 70/67. *(v1.4)*
- Scheduled broadcasts in the queue shall be editable and reschedulable; the queue lists by scheduled date ascending. A send that fails after retries shall be marked FAILED with its last error stored. *(v1.4)*
- SMS dispatch shall be folded into the existing `/api/cron/daily-reminders` cron job (08:00 UTC) to stay within the 2-job Vercel Hobby limit.
- The admin panel shall display send history: message content, scheduled date, actual send time, and status (sent / failed to send). *(v1.4)*
- SMS alert selection shall honour the same goal-based filtering as FR-NOTIF: a subscriber whose profile goal is `conceive` shall receive fertile-window SMS only, unless overridden in preferences. *(v1.3)*

**Acceptance criteria:**

- A Pro subscriber shall receive SMS alerts before predicted period date and fertile window opening. *(v1.2)*
- A free-tier user shall NOT receive any SMS alerts — verifiable by the SMS log showing no sends to free-tier numbers. *(v1.2; v1.4)*
- An admin shall upload 7 messages via CSV; the system shall send one per day for 7 consecutive days to all subscribers.
- Publishing new daily content shall deactivate the previous day's content; only the latest shall be visible. *(v1.2)*
- A `tel:all` broadcast shall be confirmed working in the BDApps sandbox or production environment.
- The admin panel shall show sent / failed-to-send counts for each broadcast. *(v1.4)*
- Bengali SMS content shall render correctly on recipient handsets (encoding verified).

#### FR-ADMIN — Admin Dashboard, User & Subscription Management *(updated v1.4)*

**Priority:** P2

**Requirements:**

- A single Super Admin role shall have full system access — user management, subscription management, content publishing, analytics.
- The admin dashboard shall display top-line KPIs: total users, active profiles, Pro subscribers, daily logs, prediction-accuracy summary (latest nightly snapshot and trend). KPI views use a cache TTL of 60 seconds or less and the "last updated" label shows the real data age. *(v1.4)*
- User management shall provide list, search, view profile metadata, suspend, reactivate, delete, restore, and inspect subscription state, plus a per-user plan history drawn from the translog. *(v1.4)*
- Subscription management shall provide the view of current Pro subscribers and manual Revoke / re-grant actions (admin override). The "recent CAAS results" and "grace-period users" views are removed. *(v1.4)*
- **Unsubscribe:** Revoke, Suspend and Delete also unsubscribe the number on BDApps (see FR-BILL, ADR 0006). *(v1.4)*
- **Delete and restore:** Delete hides the account and an admin can restore it for 30 days; after that a nightly job purges the user, their profiles and logs, leaving one translog line. *(v1.4)*
- **Logs page:** one admin Logs page shall show merchant calls, webhook events and the translog from the dated per-channel log files (ADR 0004), filterable by channel, date, text, request id and user, with OTP codes masked at read time. It replaces the "recent CAAS results" view. *(v1.4)*
- **Admin session:** the admin uses a separate login screen and cookie with a 7-day token (the web app token is 30 days). A request with no token is redirected to login; a valid non-admin token receives a 403 "Not an admin" page offering log-out-and-switch. Every admin server action calls the admin auth check. *(v1.4)*
- Every admin action shall confirm or report its result (toast with an `aria-live="polite"` region), destructive or real-world actions shall use a confirm dialog, and every page shall work at 375, 768 and 1280 px. *(v1.4)*

**Acceptance criteria:**

- A non-Super-Admin user accessing any `/admin` route shall receive HTTP 403; a request with no session shall be redirected to login. *(v1.4)*
- The KPI dashboard shall reflect DB state within one minute of an event (signup, log, upgrade).
- Suspending a user shall immediately prevent that user's token from authenticating, in both apps (per-user "sessions valid after" marker). *(v1.4)*
- Manual Pro revoke shall update `subscription_status` and unsubscribe the number on BDApps so no further subscription charge is made. *(v1.4)*
- A deleted account shall be restorable for 30 days and purged after that, leaving one translog line. *(v1.4)*
- The Logs page shall show OTP values masked. *(v1.4)*

#### FR-CMS — Content CMS (Tiptap)

**Priority:** P2

**Requirements:**

- The admin panel shall include a Tiptap 3.x rich-text editor for creating and editing bilingual articles.
- The editor shall support side-by-side EN/BN editing with phase-tag and category selectors.
- A draft/publish lifecycle shall be enforced; only published articles shall surface in the reader UI.
- Image uploads shall be stored on a server volume and served by the web app under an uploads path; the upload action is admin-only, checks type and size, and generates file names. Saved HTML shall be sanitised, with image sources allowed only from that path. The uploads volume shall be included in backups. Object storage (R2/S3) is out of scope. *(v1.4)*
- The admin editor shall load the same Bengali font as the web app, Bengali fields shall carry `lang="bn"`, and failure of the cross-app cache refresh shall be shown to the admin. *(v1.4)*

**Acceptance criteria:**

- An article authored, saved as draft, then published, shall appear in the reader feed within one minute.
- The editor shall render correctly for Bengali input including font and basic typography.
- Sanitisation shall strip `<script>` and other unsafe tags from saved HTML.

#### FR-ANALYTICS — Population Analytics & Prediction Accuracy

**Priority:** P2

**Requirements:**

- The system shall provide anonymised population health charts (cycle-length distribution from measured gaps between consecutive logged period starts, top symptoms by cycle phase, weekly cohort retention curves) rendered with Recharts 3.x. *(v1.4)*
- The system shall produce a prediction-accuracy report computed nightly by the admin-maintenance job and stored as a dated per-tier MAE snapshot: MAE between predicted next-period start and actual logged start. *(v1.4)*
- Analytics queries shall respect encryption boundaries; no plaintext export of `symptom_logs.value` shall occur.
- Analytics shall be admin-only and shall not be exposed to end users.
- The admin analytics dashboard shall provide configurable chart views: selectable chart type, adjustable date range, and metric selection per panel; each panel query takes its own range and metric. *(v1.3; v1.4)*
- Admin analytics shall include a feedback-module panel (submission volume, trend, category mix, and rating distribution) sourced from FR-FEEDBACK data. *(v1.3)*

**Acceptance criteria:**

- Population charts shall load in under 3 s on the admin dashboard.
- Accuracy MAE figures shall match a manually computed sample for at least one tier.
- No analytics endpoint shall return row-level user identifiers or decrypted symptom values.

#### FR-EXPORT — Data Export (CSV / Excel)

**Priority:** P2

**Requirements:**

- An authenticated user shall be able to export the period and symptom logs of profiles they own as CSV or Excel (XLSX).
- Export shall cover per-profile data only; cross-profile export shall be opt-in and clearly labelled.
- Sensitive fields shall be decrypted in-app before write so the downloaded file contains plaintext.
- Export generation shall complete within 10 s; for large datasets, the system shall fall back to an asynchronous QStash job with an emailed download link (post-v1 if needed).

**Acceptance criteria:**

- The CSV download shall open cleanly in Excel and Google Sheets with correct column headers.
- A user shall not be able to trigger an export of another user's data even by manipulating the request.
- The exported file shall contain decrypted symptom values, not cipher text.

#### FR-FEEDBACK — In-App Feedback Module *(v1.2)*

**Priority:** P1

**Requirements:**

- The system shall provide a dedicated in-app feedback form accessible from the main navigation or a persistent feedback button.
- Users shall be able to submit feedback in one of four categories: bug report, feature request, general feedback, or satisfaction rating.
- Each submission shall include a free-text field and an optional 1–5 star satisfaction rating.
- Feedback shall be stored in a `feedback` table with fields: `id`, `user_id`, `profile_id`, `category`, `message`, `rating`, `created_at`.
- The admin panel shall display all feedback submissions with filters by category, date range, exact or minimum rating, and text search. *(v1.4)*
- The admin shall be able to export feedback data as CSV including all fields and honouring the current filters. CSV exports start with a UTF-8 BOM (so Bengali opens correctly in Excel), escape every field per RFC 4180, prefix cells starting with `=`, `+`, `-` or `@`, and are audit-logged. *(v1.4)*
- Feedback submissions shall not expose PII of other users; each user shall only see their own submission history.
- The admin feedback view shall include an analytics dashboard with configurable charts (volume over time, category breakdown, and rating distribution), in addition to the list and filter view. *(v1.3)*

**Acceptance criteria:**

- A user shall submit feedback from any screen and shall see a confirmation message.
- The admin panel shall display all feedback with correct category tags and ratings.
- A user shall not be able to view or access another user's feedback via API manipulation.
- Feedback export shall contain all fields and shall open cleanly in Excel.

#### FR-NUDGE — Symptom & Period Logging Encouragement *(v1.3)*

**Priority:** P1

**Requirements:**

- The dashboard and calendar shall present contextual "nudge" prompts that encourage the user to log symptoms and periods when recent entries are missing — for example an inviting empty-state call-to-action, a periodic reminder card, or a streak indicator.
- Nudges shall be visually engaging and animated, in keeping with the product's lively-UI direction, while honouring `@media (prefers-reduced-motion: reduce)`.
- Prompt copy shall be bilingual (EN + BN) and shall never use shaming or pressuring language.
- Nudges shall be dismissible, shall not reappear within the same session after dismissal, and shall be frequency-capped to avoid notification fatigue.
- Logging prompts shall meet the project accessibility rules: `aria-live="polite"` on dynamically inserted prompts, `focus-visible` affordances, and `aria-label` on icon-only controls.

**Acceptance criteria:**

- A profile with no symptom log in the last N days shall see an encouragement prompt on the dashboard.
- The prompt shall animate on appearance but shall not animate when `prefers-reduced-motion: reduce` is set.
- The prompt shall render correctly in both English and Bengali.

#### FR-INSIGHTS — User-Facing Analytics & Insights Dashboard *(v1.3)*

**Priority:** P2

**Requirements:**

- The system shall provide an end-user analytics dashboard presenting the user's own cycle and symptom trends (cycle length over time, symptom frequency by category, period regularity, and fertile-window history).
- Charts shall be configurable: the user shall be able to switch chart type where applicable, select a date range, and choose which metric to view.
- All charts shall be bilingual (EN + BN), responsive at 375 / 768 / 1280 px, and shall use `font-variant-numeric: tabular-nums` on numeric axes and counters.
- Personal analytics shall be scoped to profiles the user owns; no cross-user data shall be exposed.

**Acceptance criteria:**

- A user shall view their cycle-length trend and symptom-frequency charts for a selected date range.
- Changing a chart's configuration shall update the view without a full page reload.
- A user shall not be able to access another user's analytics via API manipulation.

### 3.3 Performance Requirements


| ID              | Requirement                                                                                          | Verification                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **NFR-PERF-01** | A period log → prediction recalculation → calendar update sequence shall complete within 10 seconds. | E2E test: log period; measure time until calendar shows updated predictions.              |
| **NFR-PERF-02** | All synchronous API routes shall complete within 10 seconds.                                         | Vercel function logs shall show p99 < 10 s; prediction recalculation is async via QStash. |


### 3.4 Design Constraints

The constraints in [§2.4](#24-constraints) (CON-TECH-01 – CON-TECH-05, CON-REG-01) shall be honoured by every component. In addition:


| ID    | Constraint                                                                                                                                     |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| DC-01 | The frontend and API shall be a single Next.js 16 application using the App Router.                                                            |
| DC-02 | All async work over 10 s shall be dispatched to Upstash QStash.                                                                                |
| DC-03 | Encryption of sensitive health fields shall be implemented exclusively via `prisma-field-encryption` so the encryption boundary is consistent. |
| DC-04 | The launch deployment shall fit within the free tiers of Vercel, Supabase, Upstash, and Resend (collectively $0/month).                        |


### 3.5 Software System Attributes

#### 3.5.1 Reliability


| ID             | Requirement                                                                                                         | Verification                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **NFR-REL-01** | Transient BDApps errors shall not change a user's plan; only an explicit `UNREGISTERED` status makes a user Free. *(v1.4; grace period removed)* | Failure-injection test: simulate transient errors; subscription remains unchanged. |


#### 3.5.2 Availability


| ID               | Requirement                                                        | Verification                                                                                  |
| ---------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| **NFR-AVAIL-01** | The Supabase free-tier database shall not pause due to inactivity. | Keep-alive cron pings the DB daily; the DB shall be accessible after 10+ days of low traffic. |


#### 3.5.3 Security


| ID             | Requirement                                                                                | Verification                                                                              |
| -------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| **NFR-SEC-01** | Sensitive health fields shall be encrypted at rest using AES-256-GCM.                      | A direct SQL query shall return cipher text for `symptom_logs.value`.                     |
| **NFR-SEC-04** | No third-party analytics scripts shall touch health-event data.                            | Network-panel audit shall confirm zero health-event payloads sent to third-party domains. |
| **NFR-SEC-05** | All admin routes (`/admin/`*) shall be protected by Super Admin authentication middleware. | Smoke test: a non-admin token to any `/admin/*` route shall return HTTP 403.              |
| **NFR-SEC-06** | JWT cookies shall be `HttpOnly`, `Secure`, and `SameSite=Lax`.                             | Browser dev-tools inspection shall confirm cookie flags.                                  |
| **NFR-SEC-07** | Webhook endpoints shall validate inbound BDApps requests and shall reject requests that fail IP or signature checks with HTTP 401. *(v1.1)* | Smoke test: a request from a non-whitelisted IP to any `/api/webhooks/*` route shall return 401. |


#### 3.5.4 Maintainability


| ID               | Requirement                                                                                                 | Verification                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **NFR-MAINT-02** | The pinned Prisma version (6.13.x) shall be honoured until `prisma-field-encryption` certifies a newer one. | Dependency lockfile audit.                                                                      |


#### 3.5.5 Portability


| ID              | Requirement                                                                                                                                                                        | Verification         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **NFR-PORT-01** | The application shall not depend on Vercel-specific build features beyond the official `next` adapter; migrating off Vercel shall require only environment-variable + DNS changes. | Architecture review. |


#### 3.5.6 Internationalisation (Localisation)


| ID              | Requirement                                                          | Verification                                                       |
| --------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **NFR-I18N-01** | All UI strings shall be translated into EN and BN at initial launch. | i18next translation audit: zero missing keys in BN namespace.      |
| **NFR-I18N-02** | The Bengali layout shall not overflow at 375 px viewport.            | Visual-regression test across all 21 screens in BN mode at 375 px. |


#### 3.5.7 Responsiveness


| ID              | Requirement                                                                           | Verification                                                                |
| --------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **NFR-RESP-01** | The application shall be fully responsive at 375 px, 768 px, and 1280 px breakpoints. | Manual test: no broken layouts at all three breakpoints in either language. |


#### 3.5.8 Billing


| ID              | Requirement                                                                                             | Verification                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **NFR-BILL-01** | *(Deferred — post-v1.)* Pro features shall be gated within one API request of a BDApps `REGISTERED` status. *(v1.4)* | Schema is in place (FR-GATE); middleware enforcement is not part of v1 scope. |


### 3.6 Other Requirements

#### 3.6.1 Database Requirements

The database shall be PostgreSQL 16 on Supabase with Row Level Security enabled for `period_logs`, `symptom_logs`, and `profiles`. The detailed schema is owned by the engineering team and is not specified in this document.

#### 3.6.2 Operations Requirements


| ID     | Requirement                                                                                                     |
| ------ | --------------------------------------------------------------------------------------------------------------- |
| OPS-01 | Production cron entries run from a host crontab on the VPS: `/api/cron/daily-reminders` (08:00 UTC), the nightly BDApps subscription check (02:00 UTC), and the nightly admin-maintenance job (prediction-accuracy snapshot and 30-day purge). *(v1.4)* |
| OPS-02 | Cron endpoints shall be authenticated via the `CRON_SECRET` header.                                             |
| OPS-03 | Storage utilisation against the Supabase 500 MB cap shall be monitored.                                         |


#### 3.6.3 Deployment Architecture (Free-Tier Stack — $0/month launch)


| Service             | Provider       | Free Limits                                           | Upgrade Trigger                                     |
| ------------------- | -------------- | ----------------------------------------------------- | --------------------------------------------------- |
| Frontend + API      | Vercel Hobby   | 100 GB bandwidth, 10 s timeout, 1 M invocations/month | Team seats needed, > 100 GB BW, or functions > 10 s |
| Database            | Supabase Free  | 500 MB, pauses after 7 days inactivity                | > 500 MB or pause-avoidance becomes critical        |
| Sessions / cache    | Upstash Redis  | 10,000 commands/day, 256 MB                           | > 10,000 commands/day                               |
| Cron jobs           | Vercel Cron    | 2 jobs, daily minimum frequency                       | Need > 2 crons or sub-daily scheduling              |
| Job queue           | Upstash QStash | 500 messages/day                                      | > 500 async jobs/day                                |
| Transactional email | Resend Free    | 3,000 emails/month, 100/day                           | > 3,000 emails/month                                |


**Backend deployment model.** Backend endpoints shall be implemented as Next.js route handlers and deployed on Vercel. Shared middleware (JWT validation, RLS header injection, rate limiting) shall be enforced via Next.js middleware and route-level guards. BullMQ is replaced by Vercel Cron (scheduled jobs) and Upstash QStash (on-demand async jobs). The 10-second Hobby timeout is sufficient for all synchronous API routes; prediction recalculation is offloaded to QStash.

**Cron schedule.**


| Path                        | Schedule                      | Purpose                                                                                                           | Auth                 |
| --------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------- |
| `/api/cron/daily-reminders` | `0 8 * * `* (08:00 UTC daily) | Check notification preferences; dispatch email jobs to QStash + dispatch next scheduled SMS broadcast (FR-SMS)    | `CRON_SECRET` header |
| nightly subscription check | `0 2 * * *` (02:00 UTC daily) | Query BDApps `getStatus` for subscribers and correct plan state (no grace period) *(v1.4)* | `CRON_SECRET` header |
| admin-maintenance cron route | nightly | Store dated per-tier MAE snapshot; purge accounts deleted more than 30 days ago *(v1.4)* | `CRON_SECRET` header |


**Upgrade Path.**


| Trigger                         | Action                 | Cost                      | Note                                                             |
| ------------------------------- | ---------------------- | ------------------------- | ---------------------------------------------------------------- |
| Supabase pausing                | Supabase Pro           | +$25/month                | 8 GB DB, daily backups, no auto-pause; same connection strings.  |
| Team access or functions > 10 s | Vercel Pro             | +$20/month                | 60 s timeout, 1 TB bandwidth, team seats, more crons; same URLs. |
| Redis or QStash over limits     | Upstash pay-as-you-go  | < $1/month at early scale | Same endpoints; billing switches to PAYG.                        |
| Persistent workers needed       | Railway worker process | +$5/month                 | Add worker only; frontend + DB unchanged.                        |


---

## 4. Acceptance Criteria — Definition of Done

The system shall not be considered production-ready until all of the following gates pass. These are the client sign-off criteria.

### Authentication & Accounts

- Phone sign-up + BDApps OTP verified end-to-end in production with a real Bangladeshi number.
- Email fallback login shall be verified end-to-end: magic-link delivery via Resend, account creation, and JWT issuance. *(v1.2)*
- The 24-hour email trial window shall lock premium features after expiry; verified by testing an email-authenticated user after 24 hours. *(v1.2)*
- Profile-completion popup shall appear ~1 minute after OTP login and shall collect all required personal information. *(v1.2)*
- Multi-profile create / switch / delete shall work with complete data isolation between profiles.

### Core Tracking

- Period logging → prediction recalculation → calendar update shall complete in under 10 seconds.
- Symptom logging shall handle all 30+ symptoms across all four categories, saved and displayed correctly.

### Localisation

- All UI strings shall be translated in both EN and BN; the Bengali layout shall be unbroken at 375 px on every screen.
- Email notifications shall be delivered in the correct language per user preference.

### Content

- Bilingual health articles shall render correctly in both languages with phase tags.

### Billing — BDApps subscription *(v1.4)*

- Phone login via BDApps OTP shall subscribe the number and set `subscription_status` to `pro` in DB (gating deferred — post-v1). *(v1.4)*
- The nightly subscription check shall run and correct plan state; there is no grace period. *(v1.4)*
- A real BDApps subscription shall be verified in the production environment. *(v1.4)*

### Admin Panel

- The admin dashboard (KPIs, user management, CMS) shall be operational.
- Super Admin authentication shall be enforced on all admin routes.

### Security

- Field encryption shall be verified: sensitive symptom data shall be cipher text in the database.
- Zero third-party analytics scripts shall touch health-event data.

### SMS Notifications & Content Circulation *(v1.1; updated v1.2)*

- [ ] SMS period/fertile-window alerts shall be delivered exclusively to Pro subscribers; free-tier users shall not receive SMS alerts. *(v1.2)*
- [ ] SMS broadcast via BDApps `sms/send` with `tel:all` shall deliver to all subscribers; delivery reports shall be received via webhook. *(v1.1)*
- [ ] Content override: publishing new daily content shall deactivate the previous day's content. *(v1.2)*

### BDApps Webhooks *(v1.1)*

- [ ] All four webhook endpoints (`/api/webhooks/sms/receive`, `/sms/report`, `/ussd/receive`, `/subscription/notify`) shall be registered in BDApps, receiving events, and persisting them. *(v1.1)*
- [ ] Subscription status changes via webhook shall update `subscription_status` in the database. *(v1.1)*

### Feedback Module *(v1.2)*

- [ ] In-app feedback form shall be accessible and shall store submissions with category, message, and optional rating. *(v1.2)*
- [ ] Admin panel shall display and filter feedback submissions. *(v1.2)*

### Production & Responsiveness

- The application shall be responsive at 375 px / 768 px / 1280 px with no broken layouts in either language.
- Production deploy shall be live and stable on Vercel + Supabase, with all environment variables set.

### Client Review Feedback (v1.3)

- [ ] Logging-encouragement nudges appear for stale profiles, are bilingual, and respect reduced-motion. *(v1.3)*
- [ ] Profile mode/goal is editable post-onboarding and re-tailors predictions/alerts. *(v1.3)*
- [ ] TTC profiles receive fertile-window alerts only (email + SMS), by default. *(v1.3)*
- [ ] Profile-completion reminders are sent via email and SMS until complete. *(v1.3)*
- [ ] Admin analytics, feedback analytics, and the user-facing insights dashboard all support configurable chart views. *(v1.3)*
- [ ] BDApps charging analysis is documented as an open item pending resolution. *(v1.3)*

---

## 5. Appendices

### Appendix A — Glossary

See [§1.3 Definitions, Acronyms, and Abbreviations](#13-definitions-acronyms-and-abbreviations) for the complete glossary.

### Appendix B — Analysis Models

#### B.1 OTP Sign-up Flow

```
User enters phone
  → POST /otp/request
  → referenceNo returned
  → User enters OTP
  → POST /otp/verify
  → Account created + JWT issued

Error path:
  BDApps error
  → Exponential backoff retry
  → User-friendly error after 3 attempts
  (60 s resend cooldown applies)
```

#### B.2 Pro Subscription Lifecycle *(rewritten v1.4)*


| Step | Title                         | Description                                                                                                                                                  |
| ---- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | User logs in by phone         | BDApps OTP verify subscribes the number; the `subscriptions` record is created and the user is Pro while BDApps reports `REGISTERED`.                        |
| 2    | Nightly status check          | The host crontab calls the nightly check, which runs `getStatus` for subscribers and corrects plan state. The webhook updates state in real time.            |
| 3    | Unsubscribed                  | On `UNREGISTERED` (webhook, nightly check or in-app Unsubscribe) the user becomes Free and keeps their data; logging in by phone again re-subscribes.        |
| 4    | Admin Revoke / Suspend / Delete | The admin action also unsubscribes the number on BDApps. Reactivate and Restore do not re-subscribe. An admin override ends when BDApps reports a new subscription. |



#### B.3 Infrastructure Diagram

```
VERCEL (Hobby — $0/mo)
  ├── Next.js 16 (React 19) app
  ├── Route Handlers (API) via Next.js
  ├── Cron entries (host crontab on the production VPS) *(v1.4)*
  │     /api/cron/daily-reminders  (0 8 * * *)
  │     nightly subscription check (0 2 * * *)
  └──   nightly admin-maintenance job

SUPABASE (Free — $0/mo)
  ├── PostgreSQL 16
  ├── RLS policies (user_id isolation on period_logs, symptom_logs, profiles)
  └── pgcrypto extension

UPSTASH (Free — $0/mo)
  ├── Redis  — JWT blacklist, session store, rate-limit state
  └── QStash — prediction recalc jobs, email delivery jobs

RESEND (Free — $0/mo)
  └── Transactional email (period alerts, fertile window, logging reminders)

BDAPPS (Usage-based)
  ├── OTP API  — /otp/request, /otp/verify
  └── Subscription API — /subscription/send, /subscription/getStatus (CaaS parked) *(v1.4)*
```

### Appendix C — Requirements Traceability Matrix

The matrix below maps each Functional Requirement to its priority bucket, the upstream source documents, the relevant Definition-of-Done gates, and the associated Non-Functional Requirements.


| FR ID        | Title                                           | Priority | Source (R#)               | DoD Gates                                  | Related NFRs                          |
| ------------ | ----------------------------------------------- | -------- | ------------------------- | ------------------------------------------ | ------------------------------------- |
| FR-AUTH      | Phone Auth (OTP) + Email Fallback + Profile Completion *(v1.2)* | P0 | R1 §1, R5, R6 §3.FR-AUTH  | Authentication & Accounts #1–4             | NFR-SEC-06                     |
| FR-PROFILE   | Multi-Profile Account Management                | P0       | R1 §5, R6 §3.FR-PROFILE   | Authentication & Accounts #2               | NFR-SEC-01                            |
| FR-TRACK     | Period Logging                                  | P0       | R1 §5, R6 §3.FR-TRACK     | Core Tracking #1                           | NFR-PERF-01                           |
| FR-DASH      | Cycle Dashboard                                 | P0       | R1 §5, R6 §3.FR-DASH      | (covered by tracking + i18n gates)         | NFR-PERF-02                           |
| FR-CAL       | Monthly Calendar                                | P0       | R1 §5, R6 §3.FR-CAL       | Core Tracking #1                           | NFR-RESP-01                           |
| FR-SYMP      | Symptom Logging                                 | P0       | R1 §5, R6 §3.FR-SYMP      | Core Tracking #2                           | NFR-SEC-01                            |
| FR-PRED      | Three-Tier Prediction Engine                    | P0       | R1 §5, R6 §3.FR-PRED      | Core Tracking #1                           | NFR-PERF-01, NFR-PERF-02              |
| FR-ONBOARD   | Onboarding Flow                                 | P0       | R1 §5, R6 §3.FR-ONBOARD   | (covered by Tracking + I18N)               | NFR-I18N-01                           |
| FR-BILL      | Pro Subscription via BDApps Subscription *(v1.4)* | P0       | R1 §2, R5, R6 §3.FR-BILL  | Billing — BDApps subscription #1–3         | NFR-REL-01                            |
| FR-GATE      | Feature Gating (Email Trial + Schema) *(v1.2)*  | P0       | R6 §3.FR-GATE             | Authentication & Accounts #3; Billing #1   | NFR-BILL-01 (deferred), NFR-BILL-02   |
| FR-I18N      | Bilingual UI (EN + BN)                          | P0       | R1 §5, R6 §3.FR-I18N      | Localisation #1                            | NFR-I18N-01, NFR-I18N-02, NFR-RESP-01 |
| FR-ENC       | Field-Level Encryption                          | P0       | R1 §5, R6 §3.FR-ENC       | Security #1                                | NFR-SEC-01                            |
| FR-SESSION   | Session Store & JWT Blacklist                   | P0       | R1 §5, R6 §3.FR-SESSION   | Authentication & Accounts #1               | NFR-SEC-06                            |
| FR-NOTIF     | Email Notifications & Per-Profile Preferences   | P1       | R1 §5, R6 §3.FR-NOTIF, R7 | Localisation #2                            | NFR-I18N-01                           |
| FR-CONTENT   | Bilingual Content Platform                      | P1       | R1 §5, R6 §3.FR-CONTENT   | Content #1                                 | NFR-I18N-01, NFR-RESP-01              |
| FR-ADMIN     | Admin Dashboard, User & Subscription Management | P2       | R1 §5, R6 §3.FR-ADMIN     | Admin Panel #1, #2                         | NFR-SEC-05                            |
| FR-CMS       | Content CMS (Tiptap)                            | P2       | R1 §5, R6 §3.FR-CMS       | Admin Panel #1; Content #1                 | NFR-SEC-05                            |
| FR-ANALYTICS | Population Analytics & Prediction Accuracy      | P2       | R1 §5, R6 §3.FR-ANALYTICS | Admin Panel #1                             | NFR-SEC-04, NFR-SEC-05                |
| FR-EXPORT    | Data Export (CSV / Excel)                       | P2       | R1 §5, R6 §3.FR-EXPORT    | (no dedicated DoD; covered by Security #1) | NFR-SEC-01, NFR-SEC-04                |
| FR-SMS       | SMS Notifications & Content Circulation *(v1.1; v1.2)* | P1 | R1 §5, R5                | SMS Notifications & Content Circulation #1–3 | NFR-SEC-07                          |
| FR-WEBHOOK   | BDApps Inbound Webhooks *(v1.1)*                | P0       | R5                         | BDApps Webhooks #1, #2                     | NFR-SEC-07, CIR-05                    |
| FR-FEEDBACK  | In-App Feedback Module *(v1.2)*                 | P1       | Client feedback (v1.2)     | Feedback Module #1, #2                     | NFR-SEC-04                            |
| FR-NUDGE     | Symptom & Period Logging Encouragement *(v1.3)* | P1 | Client review (v1.3), App. D | Client Review Feedback | NFR-I18N-01, NFR-RESP-01 |
| FR-INSIGHTS  | User-Facing Analytics & Insights Dashboard *(v1.3)* | P2 | Client review (v1.3), App. D | Client Review Feedback | NFR-SEC-01, NFR-RESP-01 |


### Appendix D — Client Review Feedback (V1)

This appendix records the client's V1 review round (referenced as "Vesta V1 — Review"). It is distinct from **FR-FEEDBACK**, which specifies the *in-app, end-user* feedback module. Each note below is captured **verbatim** as received from the client, analysed against the current V1 build, and mapped to the requirement that addresses it. Notes #1 and #4 were the same request and are consolidated. *(v1.3)*

| # | Verbatim feedback | Analysis / current state | Decision & resulting requirement | Status |
| - | ----------------- | ------------------------ | -------------------------------- | ------ |
| 1, 4 | "Need flashy input prompt to inspire user to log their symptoms" / "more pop-up info to inspire users to input the symptoms" | Symptom logging works, but there are no empty-state prompts, banners, or nudges encouraging the user to log. The two notes are the same request. | New **FR-NUDGE** — Symptom & Period Logging Encouragement. | Planned (v1.3) |
| 2 | "Setting Profile Needs to have the mode change" | A profile `goal`/mode (`tracking`, `conceive`, `perimenopause`) exists but is only set during onboarding; there is no way to change it afterwards in profile settings. | Amend **FR-PROFILE** — make mode/goal editable post-onboarding. | Planned (v1.3) |
| 3 | "Trying to conceive should only show the fertile alert notifications" | Fertile-window alerts exist (email for all; SMS for Pro), but notifications are not filtered by the profile goal. | Amend **FR-NOTIF** and **FR-SMS** — goal-based filtering; TTC profiles receive fertile-window alerts only by default. | Planned (v1.3) |
| 5 | "complete profile alerts - (for mail/numbers)" | Profile completion is prompted only by an in-app modal at login; there are no email or SMS reminders. Infrastructure (Resend, BDApps SMS, daily cron) already exists. | Amend **FR-AUTH** — proactive email + SMS profile-completion reminders. | Planned (v1.3) |
| 6 | "feed back we need proper analytics dashboard" | Admin analytics is robust but not configurable; there is no analytics view for the feedback module and no user-facing analytics. Client clarified: all dashboards should offer configurable chart views. | Amend **FR-ANALYTICS** (configurable charts + feedback panel) and **FR-FEEDBACK** (feedback analytics); new **FR-INSIGHTS** (user-facing insights dashboard). | Planned (v1.3) |
| 7 | "BDApps Charging Analysis (Upon Resolving with Arika Apu)" | CAAS charging works (`caas/direct/debit`, transaction tracking) but there is no documented analysis of charge failure / retry / recovery and reconciliation. | See §D.7 below — recorded as an open item; no committed requirement yet. | OPEN — blocked |

#### D.7 — BDApps Charging Analysis *(OPEN — blocked; superseded by v1.4 — CaaS parked, see ADR 0002)*

**Status:** OPEN — pending resolution with Arika.

A full analysis of the BDApps CAAS charging flow is required before this can become a formal requirement: success/failure handling on `caas/direct/debit`, retry and recovery behaviour, grace-period interaction, and reconciliation of `CaasTransaction` records against BDApps. Relates to **FR-BILL** and **FR-GATE**. This item will be promoted to a formal requirement (with acceptance criteria) once the charging behaviour is resolved with Arika. *(v1.3)*

---

*End of document.*
