# E2E coverage map

Living map of every product feature to the Playwright spec(s) that cover it and how deeply. Update it in every E2E ticket's PR (spec #114): change the Spec(s) and Depth columns for the rows the PR touches, and the tallies below. Last audit: 2026-10-25.

## Depth

- `none`: no spec touches it.
- `look-only`: a spec renders it or checks layout or a11y, but no real user flow runs. The existing `apps/web/e2e/tests/*.spec.ts` specs log in through dev-login, block save requests and fake billing and trial state in the browser, so they are look-only or partial at best.
- `partial`: a real flow runs but does not save and verify the persisted result, or misses the main error paths.
- `full`: a real flow (UI, then API, then DB) checks the saved result after reload, plus the main error paths (validation, rate limit, Free vs Pro gating, empty state).

Specs under `e2e/tests/` are the new suite. Specs under `apps/web/e2e/tests/` are the existing look-only guards; they stay, and half-covering ones are upgraded in place.

## Summary

| Area | Features | none | look-only | partial | full |
|---|---|---|---|---|---|
| Web: login and access | 9 | 8 | 0 | 1 | 0 |
| Web: onboarding and profiles | 9 | 3 | 6 | 0 | 0 |
| Web: logging | 9 | 4 | 2 | 3 | 0 |
| Web: dashboard, calendar, predictions, insights | 12 | 2 | 10 | 0 | 0 |
| Web: content, feedback, settings | 8 | 2 | 5 | 1 | 0 |
| Web: billing | 7 | 3 | 4 | 0 | 0 |
| Web: landing and public pages | 4 | 0 | 4 | 0 | 0 |
| Web: shell, phone and Bengali (cross-cutting) | 5 | 0 | 5 | 0 | 0 |
| **Web total** | 63 | 22 | 36 | 5 | 0 |
| Admin: access and read-only views | 5 | 5 | 0 | 0 | 0 |
| Admin: user actions | 4 | 4 | 0 | 0 | 0 |
| Admin: content | 2 | 2 | 0 | 0 | 0 |
| Admin: analytics and engagement | 2 | 2 | 0 | 0 | 0 |
| Admin: SMS | 2 | 2 | 0 | 0 | 0 |
| Admin: feedback, emails, audit, logs, system | 6 | 6 | 0 | 0 | 0 |
| **Admin total** | 21 | 21 | 0 | 0 | 0 |
| Server-only (not counted) | 10 | 10 | 0 | 0 | 0 |

Notes on the tally:
- The audit counted 4 web features as `full`. Read against the definition above, none qualifies: the real flows in the existing suite (symptom and check-in clicks) abort every save request, and the language switch only checks the cookie. They are counted `partial` here. The only new-suite row is W01, `partial` until the error paths land in #120.
- Terms follow `GLOSSARY.md`: Bangladesh day, Subscriber, BDApps OTP, App OTP, Check-in, Logging nudge, Auto-prompt, Trial lock, Translog, Webhook event, Merchant call, Phase pattern, Profile completion.
- Dev-only pages (`/internal/*`, `/api/simulator-check/*`, `/api/internal/revalidate`, `/api/auth/dev-login`) are not product features and are not listed.
- No admin spec exists yet, so all 21 admin rows are `none`.

## Web (63)

### Web: login and access

| # | Feature | Route(s) | Spec(s) | Depth | Planned ticket |
|---|---|---|---|---|---|
| W01 | Phone signup: new number, BDApps OTP, verify, onboarding as Pro (subscribe recorded at fake BDApps) | `/login`, `/verify-otp`, `/onboarding`, `/api/auth/otp/request`, `/api/auth/otp/verify` | `e2e/tests/web/phone-signup.spec.ts` | partial | #116 (errors: #120) |
| W02 | Returning Subscriber login with an App OTP | `/login`, `/verify-otp`, `/api/auth/otp/*` | - | none | #120 |
| W03 | OTP error paths: wrong, expired, 60 s resend cooldown, per-phone rate limit | `/verify-otp`, `/api/auth/otp/*` | - | none | #120 |
| W04 | Brute-force block after repeated wrong codes | `/api/auth/otp/verify` | - | none | #120 |
| W05 | Email magic-link login, lands on 24 h email trial | `/email-login`, `/api/auth/magic-link/request`, `/api/auth/magic-link/callback` | - | none | #119 |
| W06 | Magic-link security: expired or reused link rejected | `/api/auth/magic-link/callback` | - | none | #119 |
| W07 | Logout ends the session | `/api/auth/logout`, settings logout dialog | `apps/web/e2e/tests/bengali-no-english.spec.ts` (dialog text only) | none | #120 |
| W08 | Route protection: logged-out visitor redirected from every protected page | all `(main)` routes, `/onboarding` | - | none | #120 |
| W09 | Suspended or deleted user session is blocked | `/api/auth/status`, withAuth | - | none | #120 (admin side: #127) |

### Web: onboarding and profiles

| # | Feature | Route(s) | Spec(s) | Depth | Planned ticket |
|---|---|---|---|---|---|
| W10 | Onboarding wizard (goal, cycle answers) and dashboard reflects it | `/onboarding` | `apps/web/e2e/tests/page-leftovers.spec.ts` (layout only) | look-only | #121 |
| W11 | Onboarding tour: finish, replay, not shown again | shell tour, `/dashboard` | `apps/web/e2e/tests/bengali-no-english.spec.ts` (tour armed via sessionStorage, no-English scan) | look-only | #121 |
| W12 | Profiles: add, rename, switch, delete (persist after reload) | `/profiles`, `/api/profiles`, `/api/profiles/[id]` | `apps/web/e2e/tests/account-look.spec.ts`, `apps/web/e2e/tests/account-popups.spec.ts`, `apps/web/e2e/tests/page-leftovers.spec.ts` | look-only | #121 |
| W13 | Six-profile limit (seventh rejected) | `/profiles`, `/api/profiles` | - | none | #121 |
| W14 | Profile isolation: switching changes dashboard, calendar, insights data | profile chip, `/dashboard`, `/calendar`, `/insights` | - | none | #121 |
| W15 | Profile completion: details form, ring, auto-prompt update | `/api/profile/completion`, completion modal | `apps/web/e2e/tests/account-popups.spec.ts`, `apps/web/e2e/tests/auto-prompts.spec.ts` (mocked completion) | look-only | #121 |
| W16 | Phone user adds and verifies an email | `/api/user/email/request`, `/api/user/email/verify` | - | none | #121 |
| W17 | Email-trial user adds and verifies a phone via BDApps OTP | `/api/user/phone/request`, `/api/user/phone/verify`, add-number dialog | `apps/web/e2e/tests/popup-shell.spec.ts` (dialog shell only) | look-only | #121 |
| W18 | Auto-prompt arbiter: one prompt at a time, priority order | `/dashboard`, all shell pages | `apps/web/e2e/tests/auto-prompts.spec.ts`, `apps/web/e2e/tests/one-home-prompts.spec.ts`, `apps/web/e2e/tests/popup-contract.spec.ts` (mocked states) | look-only | #122 |

### Web: logging

| # | Feature | Route(s) | Spec(s) | Depth | Planned ticket |
|---|---|---|---|---|---|
| W19 | Log a period; dashboard, calendar and prediction update after reload | `/calendar`, `/dashboard`, `/api/tracking/period-logs` | - | none | #122 |
| W20 | Edit and delete a past period | `/calendar`, `/api/tracking/period-logs/[id]` | `apps/web/e2e/tests/calendar-days.spec.ts` (form opens on tapped date; no save) | look-only | #122 |
| W21 | Period date validation: end before start, future date | period log form, `/api/tracking/period-logs` | - | none | #122 |
| W22 | Symptom logging across four categories (save, reload, still selected) | `/symptoms`, `/api/tracking/symptoms` | `apps/web/e2e/tests/symptoms-save.spec.ts`, `apps/web/e2e/tests/symptoms-look.spec.ts` (real clicks; every save POST aborted, only the failed-save path runs) | partial | #122 |
| W23 | Back-dated symptom logging with the date picker | `/symptoms` | - | none | #122 |
| W24 | Daily Check-in, including "all good" (recorded, not offered again that Bangladesh day) | dashboard check-in dialog | `apps/web/e2e/tests/symptoms-save.spec.ts`, `apps/web/e2e/tests/dashboard-popups.spec.ts` (save aborted) | partial | #122 |
| W25 | Quick-symptom pop-up saves a log | dashboard quick-symptom dialog | `apps/web/e2e/tests/symptoms-save.spec.ts`, `apps/web/e2e/tests/dashboard-popups.spec.ts` (save aborted) | partial | #122 |
| W26 | Logging nudge: appears after 3 days without a log, clears after logging | `/api/tracking/logging-status`, nudge banner | `apps/web/e2e/tests/auto-prompts.spec.ts` (mocked logging-status) | look-only | #122 |
| W27 | Default log date is the Bangladesh day, not the device day (expected-to-fail, bug) | log forms, date pickers | - | none | #122 |

### Web: dashboard, calendar, predictions, insights

| # | Feature | Route(s) | Spec(s) | Depth | Planned ticket |
|---|---|---|---|---|---|
| W28 | Dashboard standard mode: hero, cycle ring, cards, layout | `/dashboard`, `/api/tracking/dashboard` | `apps/web/e2e/tests/smoke.spec.ts`, `apps/web/e2e/tests/dashboard-layout.spec.ts`, `apps/web/e2e/tests/card-rows.spec.ts`, `apps/web/e2e/tests/shell-initial.spec.ts` | look-only | #123 |
| W29 | Dashboard pregnancy mode | `/dashboard` | `apps/web/e2e/tests/dashboard-modes.spec.ts` | look-only | #123 |
| W30 | Dashboard menopause mode | `/dashboard` | `apps/web/e2e/tests/dashboard-modes.spec.ts` | look-only | #123 |
| W31 | Dashboard first-run state (no period ever logged) | `/dashboard` | `apps/web/e2e/tests/dashboard-modes.spec.ts` | look-only | #123 |
| W32 | Late-period alert with day count | `/dashboard`, late alert dialog | `apps/web/e2e/tests/auto-prompts.spec.ts`, `apps/web/e2e/tests/dashboard-popups.spec.ts` | look-only | #123 |
| W33 | Prediction tier and confidence recalculate as cycles are logged | `/api/predictions`, dashboard | - | none | #123 |
| W34 | Streak badge and engagement tracking over consecutive Bangladesh days | `/api/tracking/engagement`, dashboard | - | none | #123 |
| W35 | Calendar: logged, predicted and fertile-window colours; tap a day for its logs | `/calendar`, `/api/tracking/calendar` | `apps/web/e2e/tests/calendar-days.spec.ts` | look-only | #123 |
| W36 | Insights charts with enough data | `/insights` | `apps/web/e2e/tests/insights-look.spec.ts`, `apps/web/e2e/tests/insights-a11y.spec.ts` | look-only | #123 |
| W37 | Insights empty and partial states | `/insights` | `apps/web/e2e/tests/insights-look.spec.ts` | look-only | #123 |
| W38 | Phase pattern card (most-logged symptoms in the current phase) | `/dashboard` | `apps/web/e2e/tests/phase-pattern.spec.ts` | look-only | #123 |
| W39 | Dashboard pop-ups and celebration toast | `/dashboard` | `apps/web/e2e/tests/dashboard-popups.spec.ts` | look-only | #123 |

### Web: content, feedback, settings

| # | Feature | Route(s) | Spec(s) | Depth | Planned ticket |
|---|---|---|---|---|---|
| W40 | Learn: filter articles by phase, open the reader, English and Bengali | `/content` | `apps/web/e2e/tests/page-shell.spec.ts`, `apps/web/e2e/tests/card-rows.spec.ts` (layout only) | look-only | #124 |
| W41 | Draft article never shown to users | `/content` | - | none | #124 (authoring side: #128) |
| W42 | Feedback: submit and see it in history | `/feedback` | `apps/web/e2e/tests/page-leftovers.spec.ts` (layout only) | look-only | #124 |
| W43 | Notification preferences and reminder opt-out (cron skips the user) | `/settings` | `apps/web/e2e/tests/account-look.spec.ts` (layout only) | look-only | #124 (cron side: #132) |
| W44 | Data export: CSV and XLSX contain logged entries | `/settings` | - | none | #124 |
| W45 | Account editing: name and contact details persist | `/settings`, edit-profile dialog | `apps/web/e2e/tests/account-popups.spec.ts` (dialog shell only) | look-only | #124 |
| W46 | Theme toggle (light, dark, remembered) | shell header, `/settings` | `apps/web/e2e/tests/shell-look.spec.ts`, `apps/web/e2e/tests/insights-look.spec.ts` (screenshots in both themes) | look-only | #124 |
| W47 | Language switch (English, Bengali) writes the cookie; server renders it | shell, `/welcome`, `/settings` | `apps/web/e2e/tests/language-ssr.spec.ts` | partial | #124 (logged-in shell: extend) |

### Web: billing

| # | Feature | Route(s) | Spec(s) | Depth | Planned ticket |
|---|---|---|---|---|---|
| W48 | Upgrade Free to Pro through BDApps; Pro features unlock | `/subscription`, `/api/billing/subscribe` | `apps/web/e2e/tests/account-popups.spec.ts` (paywall dialog, faked state) | look-only | #125 |
| W49 | Unsubscribe: BDApps records it, user returns to Free | `/subscription`, `/api/billing/unsubscribe` | `apps/web/e2e/tests/account-popups.spec.ts` (dialog only) | look-only | #125 |
| W50 | Subscription-notify webhook changes plan and writes a Translog entry | `/api/webhooks/subscription/notify` | - | none | #125 (route-level: #132) |
| W51 | Trial lock for an expired email trial (only upgrade or logout gets past) | trial lock, `withAuth` 402 | `apps/web/e2e/tests/auto-prompts.spec.ts` (mocked expiry) | look-only | #125 |
| W52 | Pro-only features gated for Free users | Pro-gated routes and UI | - | none | #125 |
| W53 | BDApps failure during subscribe: clear error, plan unchanged | `/api/billing/subscribe` | - | none | #125 (fake failures: #118) |
| W54 | Subscription page: status, plan, trial pill | `/subscription` | `apps/web/e2e/tests/account-look.spec.ts`, `apps/web/e2e/tests/page-shell.spec.ts` | look-only | #125 |

### Web: landing and public pages

| # | Feature | Route(s) | Spec(s) | Depth | Planned ticket |
|---|---|---|---|---|---|
| W55 | Welcome page (landing) | `/welcome`, `/` | `apps/web/e2e/tests/landing.spec.ts` | look-only | #124 |
| W56 | Privacy page | `/privacy` | `apps/web/e2e/tests/bengali-no-english.spec.ts` (no-English scan only) | look-only | #124 |
| W57 | Terms page | `/terms` | `apps/web/e2e/tests/bengali-no-english.spec.ts` (no-English scan only) | look-only | #124 |
| W58 | Get-started page leads into login | `/get-started`, `/login` | `apps/web/e2e/tests/bengali-no-english.spec.ts` (no-English scan only) | look-only | #124 |

### Web: shell, phone and Bengali (cross-cutting)

| # | Feature | Route(s) | Spec(s) | Depth | Planned ticket |
|---|---|---|---|---|---|
| W59 | Signed-in shell: sidebar, header, skip link, one h1, page widths | all `(main)` routes | `apps/web/e2e/tests/page-shell.spec.ts`, `apps/web/e2e/tests/shell-look.spec.ts`, `apps/web/e2e/tests/shell-initial.spec.ts`, `apps/web/e2e/tests/card-rows.spec.ts`, `apps/web/e2e/tests/no-emoji.spec.ts` | look-only | #133 |
| W60 | Phone shell: bottom nav, More sheet, no sideways scroll | all `(main)` routes at phone width | `apps/web/e2e/tests/phone-shell.spec.ts` | look-only | #133 |
| W61 | Pop-up shell contract: dialog semantics, ESC, focus trap, inert background | all dialogs | `apps/web/e2e/tests/popup-shell.spec.ts`, `apps/web/e2e/tests/popup-contract.spec.ts`, `apps/web/e2e/tests/account-popups.spec.ts`, `apps/web/e2e/tests/dashboard-popups.spec.ts` | look-only | #133 |
| W62 | Bengali: no English left on any page or pop-up | all pages and pop-ups | `apps/web/e2e/tests/bengali-no-english.spec.ts`, `apps/web/e2e/tests/language-ssr.spec.ts` | look-only | #133 |
| W63 | Error and not-found states | not-found page, failed-save errors | `apps/web/e2e/tests/page-shell.spec.ts`, `apps/web/e2e/tests/symptoms-save.spec.ts` | look-only | #133 |

## Admin (21)

### Admin: access and read-only views

| # | Feature | Route(s) | Spec(s) | Depth | Planned ticket |
|---|---|---|---|---|---|
| A01 | Login with email and password; non-admin sees forbidden page; logout | `/login`, `/forbidden`, `/api/auth/login`, `/api/auth/logout` | - | none | #126 |
| A02 | Dashboard KPIs and signup trend | `/` | - | none | #126 |
| A03 | Users: search and filter | `/users` | - | none | #126 |
| A04 | User detail: profile, plan history, Translog tabs | `/users/[id]` | - | none | #126 |
| A05 | Subscriptions list with status filter | `/subscriptions` | - | none | #126 |

### Admin: user actions

| # | Feature | Route(s) | Spec(s) | Depth | Planned ticket |
|---|---|---|---|---|---|
| A06 | Suspend and reactivate (ends or keeps BDApps billing) | `/users/[id]` | - | none | #127 |
| A07 | Delete and restore within 30 days; no restore after the window | `/users/[id]` | - | none | #127 |
| A08 | Grant and revoke Pro (admin override) | `/users/[id]` | - | none | #127 |
| A09 | Users CSV export | `/users` | - | none | #127 |

### Admin: content

| # | Feature | Route(s) | Spec(s) | Depth | Planned ticket |
|---|---|---|---|---|---|
| A10 | Content authoring: bilingual article, phase tags, image upload, draft, publish, seen on web | `/content`, `/content/new`, `/content/[id]`, `/uploads/[name]` | - | none | #128 |
| A11 | Content sanitizing: unsafe HTML removed before it reaches web | `/content/new`, `/content/[id]` | - | none | #128 |

### Admin: analytics and engagement

| # | Feature | Route(s) | Spec(s) | Depth | Planned ticket |
|---|---|---|---|---|---|
| A12 | Analytics: population panels, per-tier MAE, symptoms by phase, date ranges in Bangladesh days | `/analytics` | - | none | #130 |
| A13 | Engagement panels | `/engagement` | - | none | #130 |

### Admin: SMS

| # | Feature | Route(s) | Spec(s) | Depth | Planned ticket |
|---|---|---|---|---|---|
| A14 | SMS broadcast: bilingual create, schedule, send, right language per user | `/sms` | - | none | #129 |
| A15 | SMS queue: failed send retried, delivery report updates counts | `/sms` | - | none | #129 |

### Admin: feedback, emails, audit, logs, system

| # | Feature | Route(s) | Spec(s) | Depth | Planned ticket |
|---|---|---|---|---|---|
| A16 | Feedback triage: filter, detail, CSV export | `/feedback`, `/feedback/[id]` | - | none | #131 |
| A17 | Emails: log and bilingual template preview | `/emails`, `/emails/[id]`, `/emails/preview` | - | none | #131 |
| A18 | Audit log search | `/audit-logs` | - | none | #131 |
| A19 | Log reader with OTPs masked | `/logs` | - | none | #131 |
| A20 | System: cron settings saved and applied | `/system` | - | none | #131 |
| A21 | API docs page loads | `/api-docs` | - | none | #131 |

## Server-only paths (not counted in the 63 / 21)

Cron routes, BDApps webhooks, the Resend webhook and health endpoints have no screen. Tests call them over HTTP (cron with `CRON_SECRET`) and check the result through Mailpit, the fake BDApps, the UI, or the database for Translog, Webhook event and audit rows.

| # | Path | Route(s) | Spec(s) | Depth | Planned ticket |
|---|---|---|---|---|---|
| S01 | Daily-reminders cron: email (Mailpit) and SMS (fake BDApps) to due users, skips opted-out | `/api/cron/daily-reminders` | - | none | #132 |
| S02 | Nightly-maintenance cron: accuracy snapshot, purge past restore window | `/api/cron/nightly-maintenance` | - | none | #132 |
| S03 | CaaS-check cron reads balances from fake BDApps | `/api/cron/caas-check` | - | none | #132 |
| S04 | Cron-secret auth: routes reject calls without the secret | all `/api/cron/*` | - | none | #132 |
| S05 | BDApps webhook: subscription notify (subscribed, unsubscribed) | `/api/webhooks/subscription/notify` | - | none | #132 (plan effect: #125) |
| S06 | BDApps webhook: SMS received, recorded as Webhook event, duplicates ignored | `/api/webhooks/sms/receive` | - | none | #132 |
| S07 | BDApps webhook: USSD, recorded, duplicates ignored | `/api/webhooks/ussd/receive` | - | none | #132 |
| S08 | BDApps webhook: SMS delivery report | `/api/webhooks/sms/report` | - | none | #132 (admin counts: #129) |
| S09 | Resend webhook updates email log delivery status | `/api/webhooks/resend` | - | none | #132 |
| S10 | Health endpoints up; BDApps reported down when fake BDApps fails | `/api/health/{db,redis,mailpit,bdapps,worker}` | - | none | #132 |
