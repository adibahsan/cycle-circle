# Handbook outline

Every planned section, with its stable anchor id and screenshot file name. Chapters and sections are placeholders until their ticket replaces them. Rules:

- Anchor id: `<chapter code>-<slug>`, lower-case, never renamed once published. Anchors are unique across the whole handbook, so any chapter links to another with a plain `#anchor`.
- Screenshot: `screenshots/<anchor>.png`. A section with more than one screen adds `<anchor>--<suffix>.png` (suffix lower-case words joined by `-`).
- Device: `phone` = User screens at phone size; `desktop` = Admin screens.
- The chapter order lives in [index.md](index.md); a chapter's owner ticket edits only its own rows.

## Part 1: User Guide

### Getting started

- File: `chapters/getting-started.md`
- Ticket: #239
- Device: phone

| Anchor | Section | Screenshot |
|---|---|---|
| `gs-welcome` | Welcome page | `gs-welcome.png` |
| `gs-get-started` | Get Started slides | `gs-get-started.png` |
| `gs-terms` | Terms of Service | `gs-terms.png` |
| `gs-privacy` | Privacy Policy | `gs-privacy.png` |
| `gs-phone-login` | Phone login with a BDApps OTP | `gs-phone-login.png` |
| `gs-otp-resend` | Resend wait and OTP errors | `gs-otp-resend.png` |
| `gs-email-login` | Email login (magic link) | `gs-email-login.png` |
| `gs-email-trial` | The 24-hour email trial | `gs-email-trial.png` |
| `gs-onboarding` | Onboarding | `gs-onboarding.png` |
| `gs-tour` | Onboarding tour | `gs-tour.png` |
| `gs-tour-replay` | Replaying the tour | `gs-tour-replay.png` |

### Plans & access

- File: `chapters/plans-and-access.md`
- Ticket: #240
- Device: phone

| Anchor | Section | Screenshot |
|---|---|---|
| `pa-at-a-glance` | The plans at a glance | `pa-at-a-glance.png` |
| `pa-pro` | Pro | `pa-pro.png` |
| `pa-email-trial` | Email trial | `pa-email-trial.png` |
| `pa-lapsed` | Lapsed | `pa-lapsed.png` |
| `pa-trial-lock` | Trial lock | `pa-trial-lock.png` |
| `pa-pro-gating` | Pro-only features | `pa-pro-gating.png` |
| `pa-admin-overrides` | Admin overrides and billing | `pa-admin-overrides.png` |
| `pa-keep-account` | Adding a phone to keep an account | `pa-keep-account.png` |

### Dashboard

- File: `chapters/dashboard.md`
- Ticket: #241
- Device: phone

| Anchor | Section | Screenshot |
|---|---|---|
| `db-hero` | Cycle hero | `db-hero.png` |
| `db-cycle-dates` | Cycle dates | `db-cycle-dates.png` |
| `db-phase-pattern` | Phase pattern | `db-phase-pattern.png` |
| `db-checkin-strip` | Check-in strip | `db-checkin-strip.png` |
| `db-streak` | Streak | `db-streak.png` |
| `db-nudge` | Logging nudge | `db-nudge.png` |
| `db-first-run` | First-run dashboard | `db-first-run.png` |
| `db-menopause` | Menopause dashboard | `db-menopause.png` |

### Logging & Calendar

- File: `chapters/logging-and-calendar.md`
- Ticket: #241
- Device: phone

| Anchor | Section | Screenshot |
|---|---|---|
| `lc-log-period` | Log a period | `lc-log-period.png` |
| `lc-backfill` | Backfill a past period | `lc-backfill.png` |
| `lc-edit-delete` | Edit or delete a period | `lc-edit-delete.png` |
| `lc-calendar` | Calendar and its markers | `lc-calendar.png` |
| `lc-day-detail` | A day's logs | `lc-day-detail.png` |
| `lc-date-rules` | Bangladesh days and date rules | `lc-date-rules.png` |

### Predictions

- File: `chapters/predictions.md`
- Ticket: #241
- Device: phone

| Anchor | Section | Screenshot |
|---|---|---|
| `pr-how` | How predictions work | `pr-how.png` |
| `pr-tiers` | Prediction tiers and confidence | `pr-tiers.png` |
| `pr-improve` | Why predictions improve with more cycles | `pr-improve.png` |
| `pr-fertile-window` | Fertile window | `pr-fertile-window.png` |

### Symptoms & Check-in

- File: `chapters/symptoms-and-checkin.md`
- Ticket: #242
- Device: phone

| Anchor | Section | Screenshot |
|---|---|---|
| `sc-symptoms` | Logging symptoms | `sc-symptoms.png` |
| `sc-backdate` | Back-dated symptoms | `sc-backdate.png` |
| `sc-checkin` | Daily check-in | `sc-checkin.png` |
| `sc-all-good` | All good today | `sc-all-good.png` |
| `sc-quick-symptom` | Quick symptom pop-up | `sc-quick-symptom.png` |

### Insights

- File: `chapters/insights.md`
- Ticket: #242
- Device: phone

| Anchor | Section | Screenshot |
|---|---|---|
| `in-overview` | Insights overview | `in-overview.png` |
| `in-cycle-charts` | Cycle length charts | `in-cycle-charts.png` |
| `in-symptom-stats` | Symptom statistics | `in-symptom-stats.png` |
| `in-empty` | Empty and partial states | `in-empty.png` |

### Profiles

- File: `chapters/profiles.md`
- Ticket: #243
- Device: phone

| Anchor | Section | Screenshot |
|---|---|---|
| `pf-list` | My Profiles | `pf-list.png` |
| `pf-add` | Add a profile | `pf-add.png` |
| `pf-edit` | Edit or rename a profile | `pf-edit.png` |
| `pf-delete` | Delete a profile | `pf-delete.png` |
| `pf-switch` | Switch the active profile | `pf-switch.png` |
| `pf-limit` | Six-profile limit | `pf-limit.png` |
| `pf-relations` | Relationship types | `pf-relations.png` |
| `pf-completion` | Profile completion | `pf-completion.png` |

### Content

- File: `chapters/content.md`
- Ticket: #243
- Device: phone

| Anchor | Section | Screenshot |
|---|---|---|
| `ct-learn` | Learn: article list | `ct-learn.png` |
| `ct-filter` | Filter by phase | `ct-filter.png` |
| `ct-reader` | Reading an article | `ct-reader.png` |

### Subscription

- File: `chapters/subscription.md`
- Ticket: #240
- Device: phone

| Anchor | Section | Screenshot |
|---|---|---|
| `sb-status` | Subscription page and status | `sb-status.png` |
| `sb-price` | Pro price | `sb-price.png` |
| `sb-upgrade` | Upgrade by adding a phone | `sb-upgrade.png` |
| `sb-unsubscribe` | Unsubscribe | `sb-unsubscribe.png` |

### Settings

- File: `chapters/settings.md`
- Ticket: #244
- Device: phone

| Anchor | Section | Screenshot |
|---|---|---|
| `st-overview` | Settings overview | `st-overview.png` |
| `st-account` | Account details | `st-account.png` |
| `st-email` | Add or verify an email | `st-email.png` |
| `st-phone` | Add or verify a phone | `st-phone.png` |
| `st-plan-badge` | Plan badge | `st-plan-badge.png` |
| `st-notifications` | Notification toggles | `st-notifications.png` |
| `st-language-theme` | Language and theme | `st-language-theme.png` |
| `st-export` | Export your data | `st-export.png` |
| `st-replay-tour` | Replay the tour | `st-replay-tour.png` |
| `st-legal` | Legal links and app version | `st-legal.png` |
| `st-logout` | Log out | `st-logout.png` |

### Feedback

- File: `chapters/feedback.md`
- Ticket: #243
- Device: phone

| Anchor | Section | Screenshot |
|---|---|---|
| `fb-send` | Send feedback | `fb-send.png` |
| `fb-history` | Feedback history | `fb-history.png` |

### Auto-prompts

- File: `chapters/auto-prompts.md`
- Ticket: #242
- Device: phone

| Anchor | Section | Screenshot |
|---|---|---|
| `ap-rule` | The one-prompt-per-page-load rule | `ap-rule.png` |
| `ap-trial-lock` | Trial lock prompt | `ap-trial-lock.png` |
| `ap-late-period` | Late-period alert | `ap-late-period.png` |
| `ap-tour` | Onboarding tour prompt | `ap-tour.png` |
| `ap-checkin` | Check-in prompt | `ap-checkin.png` |
| `ap-completion` | Profile-completion prompt | `ap-completion.png` |

### Navigation & Language

- File: `chapters/navigation-and-language.md`
- Ticket: #244
- Device: phone

| Anchor | Section | Screenshot |
|---|---|---|
| `nl-bottom-nav` | Bottom navigation | `nl-bottom-nav.png` |
| `nl-more-sheet` | More sheet | `nl-more-sheet.png` |
| `nl-sidebar` | Desktop sidebar | `nl-sidebar.png` |
| `nl-switch-language` | Switching language | `nl-switch-language.png` |
| `nl-language-persists` | Language persistence | `nl-language-persists.png` |

## Part 2: Admin Guide

### Access

- File: `chapters/admin-access.md`
- Ticket: #245
- Device: desktop

| Anchor | Section | Screenshot |
|---|---|---|
| `aa-sign-in` | Signing in | `aa-sign-in.png` |
| `aa-forbidden` | Forbidden screen | `aa-forbidden.png` |
| `aa-navigation` | Admin navigation | `aa-navigation.png` |
| `aa-sign-out` | Signing out | `aa-sign-out.png` |

### Overview

- File: `chapters/admin-overview.md`
- Ticket: #245
- Device: desktop

| Anchor | Section | Screenshot |
|---|---|---|
| `ov-kpis` | KPI cards | `ov-kpis.png` |
| `ov-signup-trend` | Signup trend | `ov-signup-trend.png` |

### Users

- File: `chapters/admin-users.md`
- Ticket: #245
- Device: desktop

| Anchor | Section | Screenshot |
|---|---|---|
| `us-list` | User list | `us-list.png` |
| `us-search-filters` | Search and filters | `us-search-filters.png` |
| `us-export` | CSV export | `us-export.png` |
| `us-detail` | User detail | `us-detail.png` |
| `us-suspend` | Suspend and reactivate | `us-suspend.png` |
| `us-delete-restore` | Delete and restore | `us-delete-restore.png` |
| `us-pro-override` | Grant and revoke Pro | `us-pro-override.png` |
| `us-set-status` | Set subscription status | `us-set-status.png` |
| `us-notif-prefs` | Notification preferences | `us-notif-prefs.png` |
| `us-reminders` | Send reminders | `us-reminders.png` |
| `us-history` | Plan history and Translog | `us-history.png` |

### Subscriptions

- File: `chapters/admin-subscriptions.md`
- Ticket: #245
- Device: desktop

| Anchor | Section | Screenshot |
|---|---|---|
| `su-list` | Subscriptions list | `su-list.png` |
| `su-filter` | Status filter | `su-filter.png` |

### Content

- File: `chapters/admin-content.md`
- Ticket: #246
- Device: desktop

| Anchor | Section | Screenshot |
|---|---|---|
| `ac-list` | Article list | `ac-list.png` |
| `ac-bulk` | Bulk actions | `ac-bulk.png` |
| `ac-categories` | Categories | `ac-categories.png` |
| `ac-editor` | Article editor | `ac-editor.png` |
| `ac-images` | Image upload | `ac-images.png` |
| `ac-schedule` | Scheduled publishing | `ac-schedule.png` |
| `ac-views` | Views column | `ac-views.png` |

### Analytics

- File: `chapters/admin-analytics.md`
- Ticket: #246
- Device: desktop

| Anchor | Section | Screenshot |
|---|---|---|
| `an-ranges` | Date ranges | `an-ranges.png` |
| `an-churn` | Churn | `an-churn.png` |
| `an-prediction-accuracy` | Prediction accuracy | `an-prediction-accuracy.png` |
| `an-revenue` | Estimated revenue | `an-revenue.png` |
| `an-pro-count` | Daily Pro count | `an-pro-count.png` |
| `an-symptoms-phase` | Symptoms by phase | `an-symptoms-phase.png` |

### Engagement

- File: `chapters/admin-engagement.md`
- Ticket: #246
- Device: desktop

| Anchor | Section | Screenshot |
|---|---|---|
| `en-active` | What counts as an Active user | `en-active.png` |
| `en-panels` | Engagement panels | `en-panels.png` |

### SMS campaigns

- File: `chapters/admin-sms-campaigns.md`
- Ticket: #247
- Device: desktop

| Anchor | Section | Screenshot |
|---|---|---|
| `sm-list` | Campaign list | `sm-list.png` |
| `sm-create` | Create a campaign | `sm-create.png` |
| `sm-import` | CSV import | `sm-import.png` |
| `sm-schedule` | Schedule and reschedule | `sm-schedule.png` |
| `sm-send` | Send a campaign | `sm-send.png` |
| `sm-resend` | Resend failed messages | `sm-resend.png` |
| `sm-cancel` | Cancel a campaign | `sm-cancel.png` |
| `sm-messages` | Per-message view | `sm-messages.png` |
| `sm-delivery` | Delivery status | `sm-delivery.png` |

### Emails

- File: `chapters/admin-emails.md`
- Ticket: #247
- Device: desktop

| Anchor | Section | Screenshot |
|---|---|---|
| `em-log` | Email log | `em-log.png` |
| `em-detail` | Email detail | `em-detail.png` |
| `em-preview` | Template preview | `em-preview.png` |

### Feedback

- File: `chapters/admin-feedback.md`
- Ticket: #246
- Device: desktop

| Anchor | Section | Screenshot |
|---|---|---|
| `af-inbox` | Feedback inbox | `af-inbox.png` |
| `af-detail` | Feedback detail | `af-detail.png` |
| `af-export` | CSV export | `af-export.png` |

### Audit logs

- File: `chapters/admin-audit-logs.md`
- Ticket: #248
- Device: desktop

| Anchor | Section | Screenshot |
|---|---|---|
| `au-search` | Audit log search | `au-search.png` |
| `au-entries` | What each entry means | `au-entries.png` |

### Logs

- File: `chapters/admin-logs.md`
- Ticket: #248
- Device: desktop

| Anchor | Section | Screenshot |
|---|---|---|
| `lg-channels` | Log channels | `lg-channels.png` |
| `lg-viewer` | Logs viewer | `lg-viewer.png` |
| `lg-masking` | OTP masking | `lg-masking.png` |

### System

- File: `chapters/admin-system.md`
- Ticket: #248
- Device: desktop

| Anchor | Section | Screenshot |
|---|---|---|
| `sy-jobs` | Job on/off switches | `sy-jobs.png` |
| `sy-manual-reminders` | Run daily reminders manually | `sy-manual-reminders.png` |
| `sy-manual-sub-check` | Run the subscription check manually | `sy-manual-sub-check.png` |
| `sy-sms-time` | SMS send time | `sy-sms-time.png` |
| `sy-report-recipients` | Report recipients | `sy-report-recipients.png` |
| `sy-delivery-reports` | SMS delivery reports | `sy-delivery-reports.png` |
| `sy-pro-price` | Pro price | `sy-pro-price.png` |
| `sy-runs` | Run history | `sy-runs.png` |
| `sy-run-detail` | Run detail | `sy-run-detail.png` |

## Part 3: Automatic Behaviour

### Scheduled jobs

- File: `chapters/scheduled-jobs.md`
- Ticket: #249
- Device: desktop

| Anchor | Section | Screenshot |
|---|---|---|
| `sj-overview` | Jobs at a glance | `sj-overview.png` |
| `sj-daily-reminders` | Daily reminder emails | `sj-daily-reminders.png` |
| `sj-sms-dispatch` | Campaign SMS dispatch | `sj-sms-dispatch.png` |
| `sj-sub-check` | Daily subscription check | `sj-sub-check.png` |
| `sj-nightly` | Nightly maintenance | `sj-nightly.png` |
| `sj-reports` | Weekly and monthly reports | `sj-reports.png` |

### Emails catalogue

- File: `chapters/emails-catalogue.md`
- Ticket: #249
- Device: desktop

| Anchor | Section | Screenshot |
|---|---|---|
| `ec-overview` | Emails at a glance | `ec-overview.png` |
| `ec-magic-link` | Magic-link email | `ec-magic-link.png` |
| `ec-verification-code` | Verification-code email | `ec-verification-code.png` |
| `ec-period-alert` | Period alert | `ec-period-alert.png` |
| `ec-fertile-window` | Fertile window email | `ec-fertile-window.png` |
| `ec-logging-reminder` | Logging reminder | `ec-logging-reminder.png` |
| `ec-profile-completion` | Profile-completion reminder | `ec-profile-completion.png` |
| `ec-reports` | Emailed reports | `ec-reports.png` |

### SMS

- File: `chapters/sms.md`
- Ticket: #249
- Device: desktop

| Anchor | Section | Screenshot |
|---|---|---|
| `as-otp` | OTP messages | `as-otp.png` |
| `as-campaign-sms` | Campaign messages | `as-campaign-sms.png` |
| `as-send-time` | Send time and missed days | `as-send-time.png` |
| `as-delivery-reports` | Delivery reports | `as-delivery-reports.png` |

### BDApps billing events

- File: `chapters/bdapps-billing-events.md`
- Ticket: #249
- Device: desktop

| Anchor | Section | Screenshot |
|---|---|---|
| `bb-subscribe` | Subscribe | `bb-subscribe.png` |
| `bb-unsubscribe` | Unsubscribe | `bb-unsubscribe.png` |
| `bb-lapse` | Lapse | `bb-lapse.png` |
| `bb-webhooks` | How events reach the app | `bb-webhooks.png` |

### Troubleshooting

- File: `chapters/troubleshooting.md`
- Ticket: #250
- Device: desktop

| Anchor | Section | Screenshot |
|---|---|---|
| `ts-index` | Symptom index | `ts-index.png` |
| `ts-login` | Login and access | `ts-login.png` |
| `ts-billing` | Billing and subscription | `ts-billing.png` |
| `ts-notifications` | Emails and SMS | `ts-notifications.png` |
| `ts-data` | Missing or wrong data | `ts-data.png` |
| `ts-admin` | Admin panel problems | `ts-admin.png` |

## Part 4: Reference

### Glossary

- File: `chapters/glossary.md`
- Ticket: #250
- Device: desktop

| Anchor | Section | Screenshot |
|---|---|---|
| `gl-terms` | Glossary | `gl-terms.png` |

### Links

- File: `chapters/reference-links.md`
- Ticket: #250
- Device: desktop

| Anchor | Section | Screenshot |
|---|---|---|
| `rl-ops` | Ops runbooks | `rl-ops.png` |
| `rl-adr` | Decision records | `rl-adr.png` |
| `rl-local-dev` | Local development | `rl-local-dev.png` |
| `rl-api-docs` | Admin API docs | `rl-api-docs.png` |

### Coming next

- File: `chapters/coming-next.md`
- Ticket: #250
- Device: desktop

| Anchor | Section | Screenshot |
|---|---|---|
| `cn-notes` | Merged but not yet on production | `cn-notes.png` |

