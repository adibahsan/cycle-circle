# Vesta — Manual Testing Guide

> QA guide for testers validating Vesta v1 on **deployed Vercel environments** against [SRS v1.2](docs/vesta/source/SRS.md).
> Implementation status reference: [`DEV_SRS.md`](DEV_SRS.md) (rev 3, 2026-05-31).

---

## 1. Overview

### Deployed environments

| App | Base URL |
|-----|----------|
| **Web (customer)** | https://test-vesta.velirasolutions.com |
| **Admin panel** | https://test-vesta-admin.velirasolutions.com |

Use full URLs in the browser, e.g. `https://test-vesta.velirasolutions.com/login`.

**Scope:** Features implemented today. Items marked **Not testable (v1 gap)** are in [§10](#10-known-gaps--not-testable-in-v1).

**Pass criteria:** Each scenario lists expected results. File a bug when behavior differs from SRS and from DEV_SRS “What's implemented”.

---

## 2. Before you test

### 2.1 Devices and viewports

- **Mobile:** 375px width (phone)
- **Desktop:** 1280px width
- Test **English** and **Bengali** on both viewports where noted in [§7](#7-bilingual-enbn-regression-checklist)

### 2.2 What testers do not need

This guide does **not** require local installs, Docker, repository checkout, or database access. Cron jobs, webhook injection, and DB state changes are **engineering-only** unless your lead provides explicit steps.

---

## 3. Test accounts

Obtain credentials from your **QA lead or engineering** if the defaults below do not work on the current deployment.

### 3.1 Admin panel

| Field | Value |
|-------|-------|
| Login URL | https://test-vesta-admin.velirasolutions.com/login |
| Email | `adibahsanchowdhury@gmail.com` |
| Password | `admin123` (or value set in Vercel for `ADMIN_PASSWORD`) |

**Expected:** Wrong password shows an error. Logging in with a normal **web user** account (not admin) on the admin URL should redirect to `/login`.

### 3.2 Web app — phone (OTP)

| Field | Guidance |
|-------|----------|
| Login URL | https://test-vesta.velirasolutions.com/login |
| Phone | Valid Bangladeshi number (`01XXXXXXXXX`, 11 digits) |
| OTP | Code received by SMS from BDApps, or **staging bypass** if your lead confirms it is enabled (`420420` / `840840`) |

**Fresh user:** Use a number that has never been registered on this environment.

**Returning user:** Use a number that already completed onboarding to test dashboard, profiles, and history.

### 3.3 Web app — email (magic link)

| Step | Action |
|------|--------|
| 1 | Open https://test-vesta.velirasolutions.com/email-login |
| 2 | Enter an email you can read |
| 3 | Open the magic link from your inbox (sender: Vesta / `noreply@test-vesta.velirasolutions.com`) |
| 4 | Complete browsing; note 24-hour trial behavior |

**Profile completion:** After email login, if profile is incomplete, a modal should ask for full name and phone on the main app.

### 3.4 Verifying emails and notifications

| What | Where |
|------|-------|
| Emails sent to users | Your test inbox, or admin **Emails** list: https://test-vesta-admin.velirasolutions.com/emails |
| Template samples (EN/BN) | https://test-vesta-admin.velirasolutions.com/emails/preview |

---

## 4. P0 Feature Test Scenarios

Paths below are relative to the **web** base URL unless marked **Admin**.

### FR-AUTH — Phone OTP + Email Fallback + Profile Completion

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| AUTH-01 | OTP happy path | `/login` → valid `01XXXXXXXXX` → OTP from SMS (or staging code if provided) | Logged in; redirect to onboarding or dashboard |
| AUTH-02 | Invalid OTP | Wrong code on `/verify-otp` | Error; account not created |
| AUTH-03 | OTP brute force | Many wrong attempts on same session | Blocked after repeated failures |
| AUTH-04 | Resend cooldown | Tap resend immediately | Disabled for ~60 seconds |
| AUTH-05 | Rate limit | Many OTP requests in a short time | Rate limit or error message |
| AUTH-06 | Logout | Settings → logout | Protected pages redirect to `/login` |
| AUTH-07 | Session end | Logout, then use back button on protected page | Must log in again |
| AUTH-08 | Email magic link | `/email-login` → inbox link | Account created; trial window applies |
| AUTH-09 | Email trial expiry | **Engineering:** expired trial user | Premium routes blocked (402 or upgrade prompt) |
| AUTH-10 | Profile completion | Email user, incomplete profile | Modal; submit name + phone succeeds |
| AUTH-11 | Modal dismiss | Close modal | Hidden for browser session; may not reappear until new session |

**Not testable (SRS gap):** OTP users prompted ~1 min post-login; re-prompt every login until complete.

---

### FR-PROFILE — Multi-Profile (max 6)

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| PROF-01 | Create profile | `/profiles` → each relation type | Up to 6 succeed |
| PROF-02 | Seventh profile | Try 7th | Rejected or locked |
| PROF-03 | Switch profile | Change active profile | Dashboard/calendar/symptoms data changes |
| PROF-04 | Rename | Edit profile name | Persists after refresh |
| PROF-05 | Delete | Delete profile | Profile gone; its tracking data no longer shown |

---

### FR-TRACK — Period Logging

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| TRK-01 | Create log | Dashboard or `/calendar` → log period | Saved; calendar updates |
| TRK-02 | Invalid dates | End before start | Validation error |
| TRK-03 | Edit past | Edit existing log | Updated; predictions refresh |
| TRK-04 | Delete | Remove log | Removed from calendar |

---

### FR-DASH — Cycle Dashboard

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| DASH-01 | Full dashboard | `/dashboard` with history | Day hero, phase, countdown, last period, confidence % |
| DASH-02 | New user | Minimal onboarding | Estimate disclaimer; basic prediction |
| DASH-03 | Profile switch | Switch profile from header/nav | Dashboard reflects selected profile |

---

### FR-CAL — Monthly Calendar

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| CAL-01 | Colour coding | Current month | Period (pink), fertile (teal), ovulation (accent) |
| CAL-02 | Month nav | Previous/next | Grid updates; no horizontal scroll at 375px |
| CAL-03 | Logged vs predicted | Logged vs future days | Visually distinct |

---

### FR-SYMP — Symptom Logging

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| SYMP-01 | Categories | `/symptoms` | 4 categories, 32 symptoms |
| SYMP-02 | Toggle | Tap symptom on/off | Saved for selected date |
| SYMP-03 | Date change | Change date | Loads that date’s selections |
| SYMP-04 | Bengali | Language BN | Bengali symptom labels |

**Not testable (v1 gap):** Encrypted storage at rest (FR-ENC) — not visible in UI.

---

### FR-PRED — Prediction Engine

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| PRED-01 | New user | Few cycles logged | Estimate / Tier 1 style labeling |
| PRED-02 | Established user | 6+ cycles over time | Higher tier label in UI when applicable |
| PRED-03 | Confidence | Add more period logs | Confidence increases over time |
| PRED-04 | Outputs | Dashboard + calendar | Next period, fertile window, countdown sensible |

**Not testable (v1 gap):** “Updating…” state while recalc runs; true ARIMA; LSTM.

---

### FR-ONBOARD — Onboarding

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| ONB-01 | Full flow | `/onboarding` all steps | Lands on `/dashboard` with profile |
| ONB-02 | Skip | Skip where offered | Still reaches dashboard |
| ONB-03 | Refresh mid-flow | Refresh mid-wizard | Step state may reset (known gap) |

---

### FR-BILL — Pro Subscription (CAAS)

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| BILL-01 | Subscribe | `/subscription` → upgrade with real/test MSISDN | Success UI; Pro features indicated |
| BILL-02 | Failed charge | Declined balance or failed CAAS | Error UI, not success |
| BILL-03 | Pro status | After success | Settings/subscription show Pro |

**Not testable (v2):** Grace period warnings, auto-revoke after failed balance checks.

---

### FR-GATE — Email Trial + Subscription

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| GATE-01 | OTP user | Phone login | No 24h email trial restriction |
| GATE-02 | Email trial | New email user within 24h | Basic features available |
| GATE-03 | Pro | After successful subscribe | Pro status visible |

**Not testable (v1):** Pro vs free route gating on all endpoints.

---

### FR-I18N — English + Bengali

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| I18N-01 | Toggle | EN ↔ BN on auth, onboarding, main pages | UI strings switch |
| I18N-02 | 375px BN | Mobile, Bengali | No horizontal overflow |
| I18N-03 | Dates BN | Dashboard/calendar in BN | Bengali-friendly dates where shown |
| I18N-04 | Persist | BN → reload | Language preference retained |

---

### FR-ENC — Field Encryption

| ID | Scenario | Expected |
|----|----------|----------|
| ENC-01 | At-rest encryption | **Not testable in UI** — known v1 gap (FR-ENC) |

---

### FR-SESSION — Session + Rate Limits

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| SES-01 | Logout | Logout then access `/dashboard` | Redirect to login |
| SES-02 | OTP flood | Many rapid OTP requests | Throttling or error |

---

### FR-WEBHOOK — BDApps Inbound

| ID | Scenario | Expected |
|----|----------|----------|
| WH-01 | Subscription updates | **Engineering / BDApps:** ACTIVE → user Pro in app |
| WH-02 | Duplicate events | **Engineering:** idempotent handling |

**Tester note:** Webhook scenarios are validated via real BDApps callbacks or engineering tools, not manual UI steps.

---

## 5. P1 Feature Test Scenarios

### FR-NOTIF — Email Notifications

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| NOTIF-01 | Period alert | User with period due soon; prefs on | Email received or visible in admin Emails log |
| NOTIF-02 | Fertile alert | Fertile window starts today; prefs on | Fertile-window email |
| NOTIF-03 | Logging reminder | No log for 3+ days; prefs on | Reminder email |
| NOTIF-04 | Opt-out | Settings → disable period alert | No further period emails for that profile |
| NOTIF-05 | PRO SMS | Pro user, prefs on | SMS alert if CAAS/SMS configured on environment |

Verify templates: **Admin** → https://test-vesta-admin.velirasolutions.com/emails/preview (EN/BN).

---

### FR-CONTENT — Learn / Articles

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| CONT-01 | Published article | Admin publishes → web `/content` | Article visible |
| CONT-02 | Phase filter | Phase tab or `?phase=menstrual` | Filtered list |
| CONT-03 | Reader | Open article | Inline reader; no script popups |
| CONT-04 | BN body | Language BN | Bengali title/body when provided |

---

### FR-SMS — SMS Broadcasts (Admin)

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| SMS-01 | Create | **Admin** `/sms` → create message | Record appears in list |
| SMS-02 | Send | Send now | Status moves to sent (or failed with clear error) |
| SMS-03 | Delete | Delete unsent | Removed from list |

**Not testable:** CSV bulk upload; content override for previous day.

---

### FR-FEEDBACK — In-App Feedback

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| FB-01 | Submit | `/feedback` → category, stars, message | Success; appears in history |
| FB-02 | Categories | Bug, Feature, General, Satisfaction | All accepted |
| FB-03 | Char limit | Message over 500 chars | Blocked at 500 |
| FB-04 | Admin list | **Admin** `/feedback` | Entry visible with filters |
| FB-05 | Admin detail | **Admin** `/feedback/[id]` | Full message and user link |

**Not testable:** Admin reply / resolve.

---

## 6. P2 Feature Test Scenarios

### FR-ADMIN — Admin Panel

See [§8 Admin Panel Test Scenarios](#8-admin-panel-test-scenarios).

### FR-CMS — Content CMS (Admin)

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| CMS-01 | Create draft | **Admin** `/content/new` EN+BN | Saved as draft |
| CMS-02 | Publish | Publish | Visible on https://test-vesta.velirasolutions.com/content |
| CMS-03 | Categories | Create/rename/delete category | Available in editor |
| CMS-04 | Phase tags | Assign phase | Badge on list; web filter works |

**Not testable:** Image upload from editor to storage.

---

### FR-ANALYTICS — Population Analytics (Admin)

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| AN-01 | Charts | **Admin** `/analytics` | Four charts render without error |
| AN-02 | Privacy | Visual review only | No obvious PII in chart labels |

**Not testable:** Scheduled nightly MAE report.

---

### FR-EXPORT — Data Export

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| EXP-01 | User CSV | **Web** Settings → Export CSV | `.csv` file downloads |
| EXP-02 | User “Excel” | Settings → Export Excel | Downloads file (**known gap:** same CSV format, not `.xlsx`) |
| EXP-03 | Admin feedback CSV | **Admin** feedback → export | CSV downloads |
| EXP-04 | Admin users CSV | **Admin** users → export | CSV downloads |

**Verify bug:** UI may say “active profile only” but export can include all profiles.

---

## 7. Bilingual (EN/BN) Regression Checklist

Run on **375px** and **1280px** on https://test-vesta.velirasolutions.com.

- [ ] `/login`, `/verify-otp`, `/email-login` — language toggle visible
- [ ] `/onboarding` — toggle; no overflow in BN
- [ ] `/dashboard`, `/calendar`, `/symptoms`, `/content`, `/settings`
- [ ] `/profiles`, `/feedback`, `/subscription`
- [ ] `/privacy`, `/terms`
- [ ] Error/toast messages (spot-check 5 strings in BN)
- [ ] Bengali script renders correctly (no missing glyphs)
- [ ] Symptom and phase labels in BN
- [ ] **Admin** email template preview — BN variant readable

---

## 8. Admin Panel Test Scenarios

**Base URL:** https://test-vesta-admin.velirasolutions.com

### 8.1 Auth

| ID | Scenario | Expected |
|----|----------|----------|
| ADM-A01 | Valid login | Dashboard loads |
| ADM-A02 | Wrong password | Error, no access |
| ADM-A03 | Web user on admin URL | Redirect to `/login` |
| ADM-A04 | Logout | Session cleared |

### 8.2 Dashboard `/`

| ID | Scenario | Expected |
|----|----------|----------|
| ADM-D01 | KPI cards | Totals and metrics visible |
| ADM-D02 | Trend chart | Signup trend chart renders |

### 8.3 Users `/users`, `/users/[id]`

| ID | Scenario | Expected |
|----|----------|----------|
| ADM-U01 | Search/filter | List updates |
| ADM-U02 | Suspend | User cannot use web app (403 or blocked) |
| ADM-U03 | Reactivate | Access restored |
| ADM-U04 | Soft delete | User blocked |
| ADM-U05 | Grant/revoke Pro | Pro status updates on web subscription |
| ADM-U06 | Export CSV | Users CSV downloads |

### 8.4 Subscriptions `/subscriptions`

| ID | Scenario | Expected |
|----|----------|----------|
| ADM-S01 | List filters | Status filter works |
| ADM-S02 | Grant/revoke | Same as user detail |

### 8.5 Content `/content`, `/content/new`, `/content/[id]`

| ID | Scenario | Expected |
|----|----------|----------|
| ADM-C01 | List filters | Draft/published |
| ADM-C02 | Bilingual editor | EN and BN save |
| ADM-C03 | Unpublish/delete | Article gone from web when not published |

### 8.6 Analytics `/analytics`

| ID | Scenario | Expected |
|----|----------|----------|
| ADM-AN01 | All charts | Render without error |

### 8.7 SMS `/sms`

| ID | Scenario | Expected |
|----|----------|----------|
| ADM-SMS01 | Schedule | Future schedule stored |
| ADM-SMS02 | Send | Sent or failed with visible status |

### 8.8 Feedback `/feedback`, `/feedback/[id]`

| ID | Scenario | Expected |
|----|----------|----------|
| ADM-FB01 | Filters | Category, rating, date |
| ADM-FB02 | Detail | Full message + user link |

### 8.9 Emails `/emails`, `/emails/[id]`, `/emails/preview`

| ID | Scenario | Expected |
|----|----------|----------|
| ADM-E01 | Log list | Filters by type/status |
| ADM-E02 | Detail | HTML preview safe |
| ADM-E03 | Template preview | EN/BN samples |

### 8.10 Audit logs `/audit-logs`

| ID | Scenario | Expected |
|----|----------|----------|
| ADM-AL01 | After admin action | Row for suspend/grant Pro/etc. |

---

## 9. Security & Access Control Checklist

| ID | Check | How to verify | Expected |
|----|-------|---------------|----------|
| SEC-01 | Admin isolation | Log into web, open admin URL | Admin requires separate login |
| SEC-02 | Protected routes | Open `/dashboard` logged out | Redirect to `/login` |
| SEC-03 | Suspended user | **Engineering:** suspend test user | Web app blocked |
| SEC-04 | HTTPS | Browser address bar | Valid HTTPS on both deployed URLs |
| SEC-05 | Symptom encryption | N/A in UI | **Known gap** until FR-ENC |

---

## 10. Known Gaps & Not Testable in v1

| FR | Gap | Tester action |
|----|-----|---------------|
| FR-ENC | No field encryption | Do not sign off security gate |
| FR-AUTH | OTP profile-completion nudge; login re-prompt | Test email path only |
| FR-PRED | No in-flight “updating” UI | Skip |
| FR-BILL | Grace period / auto-lapse | v2 |
| FR-GATE | Pro/free route gating | v2 |
| FR-EXPORT | No real Excel; profile scope UI wrong | Test CSV only |
| FR-SMS | No CSV bulk / content override | Skip |
| FR-FEEDBACK | No admin reply | Skip |
| FR-CMS | No image upload | Skip |
| FR-ANALYTICS | No nightly MAE job | Skip |
| FR-WEBHOOK | Manual webhook tests | Engineering only |

**v2 backlog (SRS):** Pregnancy mode, native apps, AI chatbot, partner sharing, medicine/sleep tracking, community.

---

## 11. Test Reporting Template

```markdown
### Bug: [short title]
- **FR:** FR-XXXX
- **Scenario ID:** AUTH-01
- **Environment:** https://test-vesta.velirasolutions.com (or admin URL)
- **Steps:** …
- **Expected:** …
- **Actual:** …
- **Screenshots/logs:** …
- **Severity:** P0 / P1 / P2
```

---

## 12. References

| Document | Purpose |
|----------|---------|
| [docs/vesta/source/SRS.md](docs/vesta/source/SRS.md) | Formal requirements & acceptance criteria |
| [DEV_SRS.md](DEV_SRS.md) | Implementation mapping & open items |
| [review/WEB-UI-REVIEW.md](review/WEB-UI-REVIEW.md) | Web accessibility findings |
| [review/ADMIN-UI-REVIEW.md](review/ADMIN-UI-REVIEW.md) | Admin accessibility findings |
