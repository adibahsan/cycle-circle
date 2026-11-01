# Troubleshooting

## Symptom index {#ts-index}

### What it is

A way in for support staff. Start from what the User or the Admin reports, find the symptom in one of the five groups below, and follow the link to the section that explains it. Every section of this handbook ends with a "What can go wrong" table with the exact message, the cause and the fix; this chapter does not repeat those tables. It groups them by symptom and gives the first step.

### Where to find it

This chapter has no screen of its own. The five groups are the sections that follow:

| Group | Use it when |
|---|---|
| [Login and access](#ts-login) | A User cannot log in or is locked out, or an OTP or sign-in link does not work |
| [Billing and subscription](#ts-billing) | The plan is wrong, a User is charged after unsubscribing, or a payment did not give Pro |
| [Emails and SMS](#ts-notifications) | A reminder, report, sign-in email or campaign SMS did not arrive |
| [Missing or wrong data](#ts-data) | A date, prediction, chart, streak, article or setting looks wrong |
| [Admin panel problems](#ts-admin) | An Admin cannot sign in, a page shows an error, or a button does nothing |

### How to use it

1. Ask for the exact words on the screen. Most messages are quoted in the tables, and the quote tells you the section.
2. Find the symptom in the "Most common questions" table below. If it is not there, open the group above that fits and read down the first column.
3. Open the linked "What can go wrong" table. It has the cause and the fix for each message.
4. If the table sends you to a tool, use the one in "Tools for finding the cause".
5. If nothing explains it, write down the User's phone or email, the time in Bangladesh time, and the message, and give it to the server owner.

### Most common questions

| The reader says | Go to |
|---|---|
| "The OTP never arrived" | [OTP never arrives](#ts-login--otp-never-arrives) |
| "It says my code is wrong or expired" | [Login and access](#ts-login), rows on codes |
| "I am locked out" | [Locked out](#ts-login--locked-out) |
| "My trial ended and I cannot do anything" | [Locked out](#ts-login--locked-out) and [Trial lock](#pa-trial-lock--what-can-go-wrong) |
| "I was charged after I unsubscribed" | [Charged after unsubscribing](#ts-billing--charged-after-unsubscribing) |
| "I paid but I am still Free" | [Billing and subscription](#ts-billing), first row |
| "I did not get my reminder email" | [Emails and SMS](#ts-notifications), reminder rows |
| "The campaign SMS did not go out" | [Emails and SMS](#ts-notifications), campaign rows |
| "My predicted date is wrong" | [Missing or wrong data](#ts-data), predictions rows |
| "The number on the Overview is different from another page" | [Admin panel problems](#ts-admin), numbers rows |
| "The Admin panel says Unauthorized or Not an admin" | [Admin panel problems](#ts-admin) |

### Tools for finding the cause

| Tool | Where | What it tells you |
|---|---|---|
| User detail and Plan history | Admin, [User detail](#us-detail) and [Plan history](#us-history) | The plan, the status, who changed it and why |
| Logs | Admin, [Log channels](#lg-channels) and [Logs viewer](#lg-viewer) | What Cycle Circle sent to BDApps, what BDApps answered, plan changes. Search the Text box for a phone number or masked id, or filter by request ID or User ID |
| Email log | Admin, [Email log](#em-log) | Whether an email was sent, failed, bounced or is still pending |
| Audit log | Admin, [Audit log search](#au-search) | Which Admin did what, and when |
| Run history | Admin, [Run history](#sy-runs) | Whether the daily subscription check ran, failed or was skipped |
| Subscriptions list | Admin, [Subscriptions list](#su-list) | Warns when the daily check has not run |
| Server log files | Server owner only | The customer, cron and error channels, which the Admin Logs page does not show |

### Reading the server log files

The Admin Logs page shows three of the six channels (merchant, webhook and translog). For the other three (customer, cron, error), or when the Admin app itself is down, the server owner reads the dated files. The commands are in `docs/ops/08-logging.md` ([Ops runbooks](#rl-ops)); in short, each channel is a folder under `/var/log/vesta/app/` with one file per Bangladesh day. The files are not masked: they contain phone numbers and one-time passwords, so do not paste them into chats or tickets.

### Rules and limits

- Times in logs and tables are Bangladesh time unless the table says otherwise. A day is a Bangladesh day ([Glossary](#gl-terms)).
- When a screen's own text disagrees with what the code does, this handbook says what the code does. Two examples that matter for support: the phone code is valid for 5 minutes although the screen says 10, and a sign-in link is valid for 1 hour although the screen and the email say 15 minutes.
- App OTPs are written to the server logs on purpose, so support can read a User's code; the Admin Logs page masks them ([OTP masking](#lg-masking)). Treat any log extract as sensitive.

### What can go wrong

| The reader sees | Cause | Fix |
|---|---|---|
| A link in this chapter goes to a section that says "Placeholder" | The section is not written yet | Tell the team; the section anchors do not change |
| The symptom is in no group | It is not in any "What can go wrong" table yet | Use the nearest group, then add the symptom to the right chapter |

### Related

- [Login and access](#ts-login), [Billing and subscription](#ts-billing), [Emails and SMS](#ts-notifications), [Missing or wrong data](#ts-data), [Admin panel problems](#ts-admin)
- [Ops runbooks](#rl-ops), [Glossary](#gl-terms)

## Login and access {#ts-login}

### What it is

Symptoms of a User who cannot log in, cannot get a code or a link, or is stopped by a lock or a block. Phone login uses a BDApps OTP, or an App OTP for a number that is already a Subscriber ([Phone login](#gs-phone-login)). Email login uses a one-time sign-in link ([Email login](#gs-email-login)). Admin sign-in problems are in [Admin panel problems](#ts-admin).

### Where to find it

This section has no screen of its own. The fixes are in the linked sections.

### OTP never arrives

1. Ask the User to wait for the full "Resend in 60s" countdown and resend once. More requests do not help: the limits are 3 requests per minute for a phone number and 10 per hour for a connection ([Resend wait and OTP errors](#gs-otp-resend)).
2. Look up the number in the Admin Logs, merchant channel ([Logs viewer](#lg-viewer)). A line for the request shows what BDApps answered.
3. If BDApps answered with an error or did not answer, see "BDApps health" below.
4. If the number is already a Subscriber, the code is an App OTP sent by SMS to the stored masked id ([OTP messages](#as-otp)). It can be read in the logs.
5. If the operator is not supported, the User must log in by email ([Email login](#gs-email-login)).

### Locked out

| The reader sees | Likely cause and first step |
|---|---|
| A full-screen "Your 24-hour trial has ended" | The email trial is over (24 hours from the first magic-link login). The User adds a phone and verifies it to become Pro ([Trial lock](#pa-trial-lock)) |
| The login page again after a correct code | The account is Suspended or Deleted. An Admin reactivates it, or restores it within 30 days ([Admin overrides](#pa-admin-overrides)) |
| "Too many wrong codes. Request a new code." | 5 wrong tries on one code. Resend the code |
| "Too many attempts. Try again in a few minutes." | Rate limit. Wait; the App OTP daily cap is 5 per number and resets 24 hours after the first code |
| "This number is already registered to another account." | The number belongs to another User. Use another number or log in to that account |

### BDApps health

There is no BDApps status page in the Admin panel. To check whether BDApps is the problem:

1. Open Admin **Logs**, channel merchant, and search the User's number or a recent request ([Logs viewer](#lg-viewer)). Each line holds BDApps' status code. Many errors in a row, or lines with no answer, mean BDApps or the connection to it.
2. Open **System > Run history** ([Run history](#sy-runs)): a daily subscription check that failed or shows "BDApps did not answer (timeout)" points to the same cause ([Run detail](#sy-run-detail)).
3. Read the code in the table below. The table comes from `docs/ops/09-bdapps-subscriptions.md`, section 6 ([Ops runbooks](#rl-ops)).

| BDApps code | Meaning | What to do |
|---|---|---|
| E1303 | The calling server is not on BDApps' allowed list | Server owner; BDApps support |
| E1312 | A delivery report was asked for and the SMS plan does not allow it; nothing is sent | Turn off [SMS delivery reports](#sy-delivery-reports), or ask BDApps to enable them |
| E1313 | Wrong app id or password | Server owner checks the settings |
| E1324 | Subscription over HTTP is disabled for the app | BDApps support |
| E1325 | Subscriber address in the wrong format | Server owner; developers |
| E1351 | The number is already subscribed, so no BDApps OTP is sent | Expected: login falls back to an App OTP |
| E1854 | The OTP was not found or has expired | The User asks for a new code |
| E1951 | Invalid address, or not subscribed | For a masked id, BDApps is saying the number is unregistered |

### Email sign-in

| The reader sees | Likely cause and first step |
|---|---|
| No email arrives | Check spam and the address, then search the address in the [Email log](#em-log). "Failed", "Bounced" or "Complained" explains it |
| "This sign-in link has expired." | A link lasts 1 hour (the screen says 15 minutes) |
| "This sign-in link has already been used." | A link works once. Request a new one and open it directly |
| "Too many magic link requests. Try again later." | 3 requests per hour per address. Use the latest email |

### Other login symptoms

| The reader sees | Likely cause and first step |
|---|---|
| The app opens in the wrong language | The language is a cookie on that phone and browser ([Language persists](#nl-language-persists)) |
| No app tour after the first login | The tour opens only on the Dashboard, once ([Tour](#gs-tour)) |
| Settings opens the login screen | The session ended; log in again ([Settings overview](#st-overview)) |

### Symptom table

| The reader sees | Likely cause and first step | Full list |
|---|---|---|
| "Failed to send OTP. Please try again." | Often BDApps is down or slow. See "BDApps health" | [details](#gs-phone-login--what-can-go-wrong), [details](#as-otp--what-can-go-wrong) |
| "We can't send a code to this number's mobile operator yet." | Unsupported operator. Log in by email | [details](#gs-phone-login--what-can-go-wrong), [details](#sb-upgrade--what-can-go-wrong) |
| "This number is already subscribed, but we could not send it a code." | Two variants: log in with email, or unsubscribe the number on BDApps and log in again | [details](#gs-phone-login--what-can-go-wrong), [details](#pa-pro--what-can-go-wrong) |
| "Invalid or expired code. Please try again." | The code is valid 5 minutes. Resend | [details](#gs-phone-login--what-can-go-wrong), [details](#gs-otp-resend--what-can-go-wrong), [details](#as-otp--what-can-go-wrong) |
| Email trial: phone code messages | Same limits as phone login | [details](#gs-email-trial--what-can-go-wrong), [details](#st-phone--what-can-go-wrong), [details](#pa-keep-account--what-can-go-wrong) |
| Trial lock, again after logging in | No phone verified yet | [details](#pa-trial-lock--what-can-go-wrong), [details](#ap-trial-lock--what-can-go-wrong), [details](#pa-email-trial--what-can-go-wrong) |
| Cannot finish the welcome or onboarding steps ("Please select a goal to continue", "Name is required", a date that is not accepted) | Onboarding has no skip; fields have limits | [details](#gs-welcome--what-can-go-wrong), [details](#gs-onboarding--what-can-go-wrong) |
| Still logged in after tapping Log out, or the back button returns to Settings | Logout rules | [details](#st-logout--what-can-go-wrong), [details](#st-overview--what-can-go-wrong) |
| Back at the login page; blocked after a correct code | Suspended or Deleted | [details](#pa-admin-overrides--what-can-go-wrong), [details](#us-suspend--what-can-go-wrong), [details](#us-delete-restore--what-can-go-wrong) |
| The app tour did not open | Rules of the tour | [details](#gs-tour--what-can-go-wrong), [details](#gs-tour-replay--what-can-go-wrong), [details](#ap-tour--what-can-go-wrong), [details](#st-replay-tour--what-can-go-wrong) |
| Pop-up the User did not expect | Auto-prompt rules | [details](#ap-rule--what-can-go-wrong) |

### Related

- [Phone login](#gs-phone-login), [Email login](#gs-email-login), [SMS: OTP messages](#as-otp)
- Admin side: [User detail](#us-detail), [Suspend and reactivate](#us-suspend)
- [Billing and subscription](#ts-billing)

## Billing and subscription {#ts-billing}

### What it is

Symptoms about the plan (Free, Pro, Trial, Expired) and about money. BDApps does the charging; Cycle Circle only learns the result, through the BDApps webhook and the daily subscription check ([BDApps billing events](#bb-subscribe)). The Pro price shown to Users is the one an Admin set, not one read from BDApps (ADR 0011).

### Where to find it

This section has no screen of its own.

### Charged after unsubscribing

1. Open the User ([User detail](#us-detail)) and read the Plan history tab ([Plan history](#us-history)). It shows when and why the plan changed, and a "failed" BDApps unsubscribe.
2. Search the number in the Admin Logs, merchant channel, for the unsubscribe call and BDApps' answer ([Logs viewer](#lg-viewer)).
3. If the unsubscribe failed or never happened, the number must be unsubscribed on BDApps by hand. Revoke, Suspend and Delete try to unsubscribe, and show a red toast when it fails ([Pro override](#us-pro-override)).
4. A Subscriber who unsubscribes on BDApps is moved to Free by the webhook, or at the next daily check ([Lapse](#bb-lapse)).
5. Remember the opposite case: a granted Pro User is never charged, and an Admin override wins until BDApps reports a new subscription ([Admin overrides](#pa-admin-overrides)).

### Symptom table

| The reader sees | Likely cause and first step | Full list |
|---|---|---|
| "I paid but I am Free" / "Go Pro" after subscribing | Webhook or check has not caught up. Check the webhook and merchant logs, then run the check ([Run the subscription check manually](#sy-manual-sub-check)) or ask the User to log in again | [details](#bb-lapse--what-can-go-wrong), [details](#sb-status--what-can-go-wrong), [details](#pa-at-a-glance--what-can-go-wrong), [details](#st-plan-badge--what-can-go-wrong) |
| Pro User missing from the Subscriptions list | Run the check, then look at User detail | [details](#bb-subscribe--what-can-go-wrong), [details](#su-list--what-can-go-wrong) |
| Pro shown after unsubscribing on BDApps | Wait for the daily check or use Run now | [details](#bb-lapse--what-can-go-wrong), [details](#sj-sub-check--what-can-go-wrong) |
| "Couldn't unsubscribe. Try again in a minute." | Retry; if it keeps failing, unsubscribe on BDApps by hand | [details](#bb-unsubscribe--what-can-go-wrong), [details](#sb-unsubscribe--what-can-go-wrong) |
| Red toast "...the BDApps unsubscribe failed... The user may still be charged." | The plan changed here but BDApps did not unsubscribe. Ask BDApps to unsubscribe the number | [details](#us-pro-override--what-can-go-wrong), [details](#us-set-status--what-can-go-wrong), [details](#us-suspend--what-can-go-wrong), [details](#us-delete-restore--what-can-go-wrong), [details](#su-list--what-can-go-wrong) |
| "Your Pro access was granted by our team, so it can't be cancelled here." | An Admin granted Pro. An Admin sets Free | [details](#sb-unsubscribe--what-can-go-wrong), [details](#pa-admin-overrides--what-can-go-wrong) |
| "Your subscription has expired. Renew to keep Pro." / Expired badge | The Lapsed plan; renewing is by phone login or Upgrade to Pro | [details](#pa-lapsed--what-can-go-wrong), [details](#sb-status--what-can-go-wrong) |
| "Cycle Circle Free" although they pay | Webhook not received or the number is not linked to this account | [details](#pa-at-a-glance--what-can-go-wrong), [details](#bb-webhooks--what-can-go-wrong) |
| Revoked User is Pro again after some days | Expected when BDApps reports a new subscription; use Suspend to keep someone out | [details](#us-pro-override--what-can-go-wrong), [details](#pa-admin-overrides--what-can-go-wrong) |
| The price differs from what is charged | An Admin sets the price; it must match BDApps | [details](#sb-price--what-can-go-wrong), [details](#sy-pro-price--what-can-go-wrong) |
| Daily check history shows "Failed", "Errors" or "Skipped" | Open the run; a skipped run means the job is switched off | [details](#sj-sub-check--what-can-go-wrong), [details](#sy-runs--what-can-go-wrong), [details](#sy-jobs--what-can-go-wrong) |
| No "subscription.notify" lines at all | The webhook is not arriving or not accepted (server owner checks the allowed addresses) | [details](#bb-webhooks--what-can-go-wrong) |
| Estimated revenue or churn "unavailable" | No daily Pro counts stored for the period | [details](#an-revenue--what-can-go-wrong), [details](#an-churn--what-can-go-wrong), [details](#an-pro-count--what-can-go-wrong) |
| Upgrading: "This number is already registered to another account." | The number belongs to another User | [details](#sb-upgrade--what-can-go-wrong), [details](#pa-trial-lock--what-can-go-wrong), [details](#pa-keep-account--what-can-go-wrong) |

### Related

- [Plans and access](#pa-at-a-glance), [Subscription](#sb-status), [BDApps billing events](#bb-subscribe)
- [Daily subscription check](#sj-sub-check), [Run history](#sy-runs)
- [Login and access](#ts-login)

## Emails and SMS {#ts-notifications}

### What it is

Symptoms of a message that did not arrive, arrived twice, or arrived at the wrong time. Emails (sign-in links, verification codes, reminders, reports) go through the email service and are listed in the Admin Email log. SMS comes in two kinds: login codes, and the daily campaign message. Reminders and campaign SMS are sent by scheduled jobs that run from the server's crontab ([Jobs at a glance](#sj-overview)).

### Where to find it

This section has no screen of its own.

### Reminder email did not arrive

1. Search the User's email in the [Email log](#em-log). A row with status "Sent" means the email service accepted it; "Pending" delivery can be refreshed on the [Email detail](#em-detail).
2. No row at all: check the User has an email, that the reminder is switched on in **Settings > Notifications**, that the profile has predictions, and that the job ran ([Daily reminder emails](#sj-daily-reminders), [Job on/off switches](#sy-jobs)).
3. "Bounced" or "Complained": the address cannot receive mail. Ask the User for another one.
4. No reminders for anyone: the daily schedule is off, or the server's crontab is not calling the job ([Jobs at a glance](#sj-overview)).

### Campaign SMS did not go out

1. Open the campaign ([Campaign messages](#sm-messages)) and read the status of the day: Planned, Sending, Sent, Failed, Missed, Cancelled.
2. "Missed" or still "Planned" after the day arrived: the dispatch job did not run, or ran after the day ended ([SMS dispatch](#sj-sms-dispatch), [SMS send time](#sy-sms-time)).
3. "Failed to send": read the error, fix the cause, then resend on a free day ([Resend failed messages](#sm-resend)).
4. A message arrives later than the set send time: normal, the job runs every 15 minutes ([SMS send time](#as-send-time)).

### Symptom table

| The reader sees | Likely cause and first step | Full list |
|---|---|---|
| No email arrives (sign-in link or code) | Spam, wrong address, or a failed or bounced send in the Email log | [details](#ec-magic-link--what-can-go-wrong), [details](#ec-verification-code--what-can-go-wrong), [details](#em-log--what-can-go-wrong), [details](#gs-email-login--what-can-go-wrong) |
| Email status Failed, Bounced, Complained or Pending | Open the row; refresh a Pending one | [details](#ec-overview--what-can-go-wrong), [details](#em-log--what-can-go-wrong), [details](#em-detail--what-can-go-wrong) |
| "I log symptoms every day and still get the logging reminder" | The reminder follows the last period log. Switch Logging Reminders off | [details](#ec-logging-reminder--what-can-go-wrong), [details](#sj-daily-reminders--what-can-go-wrong) |
| "My subject says 0 days" | Expected for the period alert on the day | [details](#ec-period-alert--what-can-go-wrong) |
| "I never get a period alert" / no fertile window email | Check predictions, the switches, and whether SMS needs Pro | [details](#ec-period-alert--what-can-go-wrong), [details](#ec-fertile-window--what-can-go-wrong), [details](#sj-daily-reminders--what-can-go-wrong), [details](#st-notifications--what-can-go-wrong) |
| Profile completion email button opens a login page | The button opens a login page; the User logs in and lands on the profile screen | [details](#ec-profile-completion--what-can-go-wrong) |
| Reminders or reports stopped for everyone | The job switch, or the crontab | [details](#sj-overview--what-can-go-wrong), [details](#sy-jobs--what-can-go-wrong), [details](#sj-reports--what-can-go-wrong) |
| No weekly or monthly report | No recipients, the switch is off, or an address is invalid | [details](#sj-reports--what-can-go-wrong), [details](#sy-report-recipients--what-can-go-wrong) |
| Red message "APP_URL or CRON_SECRET is not configured for the admin app" | Admin app settings. See Admin panel problems | [details](#sy-manual-reminders--what-can-go-wrong), [details](#sy-manual-sub-check--what-can-go-wrong), [details](#us-reminders--what-can-go-wrong) |
| Campaign day "Missed", "Failed" or still "Planned" | See "Campaign SMS did not go out" | [details](#sm-send--what-can-go-wrong), [details](#sm-messages--what-can-go-wrong), [details](#sm-list--what-can-go-wrong), [details](#sm-resend--what-can-go-wrong), [details](#sj-sms-dispatch--what-can-go-wrong) |
| SMS arrives later than the send time, or the time will not save | The job runs every 15 minutes; the time is in 24-hour format | [details](#as-send-time--what-can-go-wrong), [details](#sy-sms-time--what-can-go-wrong) |
| Emails of type REPORT are missing from the log | Reports are sent only with recipients saved | [details](#ec-reports--what-can-go-wrong), [details](#sj-reports--what-can-go-wrong) |
| "Delivery reports off", or Delivered 0, Failed 0 | Delivery reports are not enabled, or no reports have arrived | [details](#sm-delivery--what-can-go-wrong), [details](#as-delivery-reports--what-can-go-wrong), [details](#sy-delivery-reports--what-can-go-wrong) |
| Send failed with "E1312" | The SMS plan does not allow delivery reports; turn the switch off | [details](#sm-delivery--what-can-go-wrong), [details](#sy-delivery-reports--what-can-go-wrong) |
| Campaign form errors ("Message is N SMS parts long; the limit is 6", "is in the past", "already has a message") | Form rules | [details](#sm-create--what-can-go-wrong), [details](#sm-import--what-can-go-wrong), [details](#sm-schedule--what-can-go-wrong), [details](#as-campaign-sms--what-can-go-wrong) |
| A User received two SMS the same day | Expected in one case; the daily guard is the email log | [details](#sj-daily-reminders--what-can-go-wrong) |
| Pro User gets no SMS | Check the phone on the User and the plan | [details](#pa-pro--what-can-go-wrong), [details](#pa-pro-gating--what-can-go-wrong) |
| Login SMS in the wrong language, reminder email in English | The email follows the saved language | [details](#nl-switch-language--what-can-go-wrong), [details](#nl-language-persists--what-can-go-wrong) |

### Related

- [Emails catalogue](#ec-overview), [SMS](#as-otp), [Scheduled jobs](#sj-overview)
- Admin: [Email log](#em-log), [SMS campaigns](#sm-list), [System](#sy-jobs)

## Missing or wrong data {#ts-data}

### What it is

Symptoms where a User sees a date, prediction, chart, streak, article, profile or setting that looks missing or wrong. Most of these are rules of the product (Bangladesh days, the number of cycles logged, the active profile), not faults. Check the profile first: the same User can have up to six profiles, and every screen shows the active one ([Profiles](#pf-switch)).

### Where to find it

This section has no screen of its own.

### Symptom table

| The reader sees | Likely cause and first step | Full list |
|---|---|---|
| Dashboard cards missing (cycle dates, Phase pattern) or not what the User remembers | Cards need logged periods and past cycles | [details](#db-cycle-dates--what-can-go-wrong), [details](#db-phase-pattern--what-can-go-wrong), [details](#lc-day-detail--what-can-go-wrong) |
| "Next period not predicted yet", no fertile window | Needs a logged period; a Menopause profile has no predictions | [details](#pr-how--what-can-go-wrong), [details](#db-hero--what-can-go-wrong), [details](#pr-fertile-window--what-can-go-wrong), [details](#db-menopause--what-can-go-wrong) |
| The predicted date is far off, or jumped | Few logged cycles, a wrong start date, or an edit or delete just made | [details](#pr-improve--what-can-go-wrong), [details](#pr-how--what-can-go-wrong), [details](#pr-tiers--what-can-go-wrong) |
| "Period N days late" for weeks | The User has not logged the new period | [details](#pr-how--what-can-go-wrong), [details](#ap-late-period--what-can-go-wrong), [details](#db-hero--what-can-go-wrong) |
| Dashboard and Calendar dates differ | Later months use a different projection | [details](#lc-calendar--what-can-go-wrong), [details](#pr-fertile-window--what-can-go-wrong), [details](#pr-how--what-can-go-wrong) |
| "A period cannot start or end after today" / "This overlaps a period you already logged" | Date rules of period logging | [details](#lc-log-period--what-can-go-wrong), [details](#lc-date-rules--what-can-go-wrong), [details](#lc-backfill--what-can-go-wrong), [details](#lc-edit-delete--what-can-go-wrong), [details](#db-first-run--what-can-go-wrong) |
| A deleted period comes back, or the Dashboard shows old dates after a backfill | Log the correct period instead of deleting the only one; compare with the Calendar | [details](#lc-edit-delete--what-can-go-wrong), [details](#lc-backfill--what-can-go-wrong) |
| "Couldn’t save your symptoms. Please try again." | Retry; check the connection | [details](#sc-symptoms--what-can-go-wrong), [details](#sc-checkin--what-can-go-wrong), [details](#sc-backdate--what-can-go-wrong), [details](#sc-all-good--what-can-go-wrong), [details](#sc-quick-symptom--what-can-go-wrong), [details](#ap-checkin--what-can-go-wrong) |
| Symptoms on the wrong person, or the wrong profile | The active profile is not the one expected | [details](#sc-symptoms--what-can-go-wrong), [details](#pf-switch--what-can-go-wrong), [details](#pf-list--what-can-go-wrong), [details](#lc-calendar--what-can-go-wrong) |
| Streak looks wrong ("lost a day" at night, stuck at 30) | Streaks count Bangladesh days; stuck at 30 is expected | [details](#db-streak--what-can-go-wrong), [details](#db-checkin-strip--what-can-go-wrong), [details](#lc-date-rules--what-can-go-wrong) |
| The check-in or logging nudge shows when it should not, or not at all | Rules of the strip and the nudge | [details](#db-checkin-strip--what-can-go-wrong), [details](#db-nudge--what-can-go-wrong), [details](#sc-checkin--what-can-go-wrong) |
| "No insights yet" or a missing chart | Needs enough logs; a blue note names the missing cards | [details](#in-overview--what-can-go-wrong), [details](#in-empty--what-can-go-wrong), [details](#in-cycle-charts--what-can-go-wrong), [details](#in-symptom-stats--what-can-go-wrong) |
| Profile completion pop-up or ring: "Full name is required", 83% and nothing left to fill | Completion counts optional details | [details](#ap-completion--what-can-go-wrong), [details](#pf-completion--what-can-go-wrong) |
| Cannot edit a profile, or needs a relation like Friend or Aunt | Edit rules; the relation list is fixed | [details](#pf-edit--what-can-go-wrong), [details](#pf-relations--what-can-go-wrong) |
| Cannot add a profile ("Maximum 6 profiles") | The limit is 6 profiles | [details](#pf-limit--what-can-go-wrong), [details](#pf-add--what-can-go-wrong) |
| Cannot delete a profile, or deleted the wrong one | The only profile cannot be deleted, and there is no restore | [details](#pf-delete--what-can-go-wrong) |
| Settings not saved, "Failed to save preferences", or different on another device | Try again. Language and theme are saved per device; alerts per profile | [details](#st-notifications--what-can-go-wrong), [details](#st-language-theme--what-can-go-wrong) |
| The export is empty, has one profile, or fails | Export rules | [details](#st-export--what-can-go-wrong) |
| Cannot add or change a phone or email | Verified by a code; a number cannot belong to two accounts | [details](#st-phone--what-can-go-wrong), [details](#st-email--what-can-go-wrong), [details](#st-account--what-can-go-wrong) |
| Article missing, in English, or "Page not found" | Published and translated articles only; scheduled ones appear at their time | [details](#ct-learn--what-can-go-wrong), [details](#ct-filter--what-can-go-wrong), [details](#ct-reader--what-can-go-wrong), [details](#ac-schedule--what-can-go-wrong) |
| Some text stays in English, or the app is in Bengali | The language is saved per device | [details](#nl-switch-language--what-can-go-wrong), [details](#nl-language-persists--what-can-go-wrong) |
| Navigation: no bottom bar, a dot that will not go, a sheet that will not close | Layout rules by screen size | [details](#nl-bottom-nav--what-can-go-wrong), [details](#nl-more-sheet--what-can-go-wrong), [details](#nl-sidebar--what-can-go-wrong) |
| Feedback not in "Your Previous Feedback", or Submit Feedback greyed out | A category is required | [details](#fb-send--what-can-go-wrong), [details](#fb-history--what-can-go-wrong) |
| A deleted User asks to be restored after 30 days | Deleted accounts are purged after 30 days | [details](#sj-nightly--what-can-go-wrong), [details](#us-delete-restore--what-can-go-wrong) |
| Legal page says something production does not do | The legal pages contain claims production does not match; see Getting started | [details](#gs-terms--what-can-go-wrong), [details](#gs-privacy--what-can-go-wrong), [details](#st-legal--what-can-go-wrong) |

### Related

- [Predictions](#pr-how), [Logging and Calendar](#lc-calendar), [Insights](#in-overview), [Profiles](#pf-list)
- [Auto-prompts](#ap-rule), [Navigation and Language](#nl-bottom-nav)

## Admin panel problems {#ts-admin}

### What it is

Symptoms an Admin meets in the Admin panel: signing in, pages that show an error, empty lists and charts, numbers that do not match, and buttons that call the web app. Admin and web are two separate apps with separate sign-ins (ADR 0007): a web session cannot open the Admin panel, and the other way round.

### Where to find it

This section has no screen of its own.

### Settings that make buttons fail

Several buttons on the System and User pages do not do the work themselves. The Admin app calls the web app's job routes using two settings on the server:

| Setting | Must be | Symptom when wrong |
|---|---|---|
| The Admin app's `APP_URL` | The public address of the web app, not the Admin app's own address | "APP_URL or CRON_SECRET is not configured for the admin app", or "Request failed" |
| `CRON_SECRET` | The same value in the web app's and the Admin app's settings, and in the server's crontab | "Web app returned 401" |

Only the server owner can change them: the environment files are in `docs/ops/04-env-reference.md` ([Ops runbooks](#rl-ops)), and the app must be redeployed afterwards. "Web app returned 500" means the web app was reached but the job failed; read the web app's error log on the server.

### Symptom table

| The reader sees | Likely cause and first step | Full list |
|---|---|---|
| "Invalid email or password" | Wrong password, or the account is not an Admin | [details](#aa-sign-in--what-can-go-wrong) |
| "Too many login attempts. Try again later." | Wait 15 minutes after the last failure | [details](#aa-sign-in--what-can-go-wrong) |
| "Account suspended" | Cannot be undone from the panel; the server owner changes it | [details](#aa-sign-in--what-can-go-wrong) |
| Sent back to the login page | The session ended or was signed out elsewhere | [details](#aa-sign-in--what-can-go-wrong), [details](#aa-sign-out--what-can-go-wrong) |
| "Not an admin" | A User account signed in. Log out and switch account | [details](#aa-forbidden--what-can-go-wrong) |
| "Web app returned 401", "APP_URL or CRON_SECRET is not configured", "Request failed" | See "Settings that make buttons fail" | [details](#sy-manual-reminders--what-can-go-wrong), [details](#sy-manual-sub-check--what-can-go-wrong), [details](#us-reminders--what-can-go-wrong), [details](#sj-overview--what-can-go-wrong) |
| A System switch jumps back with no message | Reload, sign in again if asked, and try once more | [details](#sy-jobs--what-can-go-wrong), [details](#sy-report-recipients--what-can-go-wrong) |
| A change is not visible in a list or chart | Pages are cached (Overview and Subscriptions 60 seconds, Users 5 minutes). Refresh | [details](#us-list--what-can-go-wrong), [details](#ov-kpis--what-can-go-wrong), [details](#su-list--what-can-go-wrong), [details](#an-ranges--what-can-go-wrong), [details](#ac-list--what-can-go-wrong) |
| "Unavailable" on Churn Rate, Pro Subscribers, revenue or Active users | No daily Pro or activity snapshot for the period | [details](#ov-kpis--what-can-go-wrong), [details](#an-churn--what-can-go-wrong), [details](#an-revenue--what-can-go-wrong), [details](#an-pro-count--what-can-go-wrong), [details](#en-active--what-can-go-wrong) |
| Signup chart shows a spike or "No signups in this period" | Chart rules | [details](#ov-signup-trend--what-can-go-wrong), [details](#ov-kpis--what-can-go-wrong) |
| A number differs from another page | Different definitions (Bangladesh days, active vs logging, snapshot vs live) | [details](#ov-kpis--what-can-go-wrong), [details](#en-active--what-can-go-wrong), [details](#en-panels--what-can-go-wrong), [details](#an-symptoms-phase--what-can-go-wrong), [details](#us-list--what-can-go-wrong) |
| Date range errors ("Pick a range of 366 days or fewer.") | Range rules | [details](#an-ranges--what-can-go-wrong), [details](#ov-kpis--what-can-go-wrong) |
| Users: a person is missing, the export is short, times are 6 hours behind | Status filter (Deleted Users show under All), phone typed with spaces, or export times in UTC (add 6 hours) | [details](#us-list--what-can-go-wrong), [details](#us-search-filters--what-can-go-wrong), [details](#us-export--what-can-go-wrong) |
| User page: 404, "No subscription record found.", empty Plan history, a switch that snaps back | Rules of the detail tabs | [details](#us-detail--what-can-go-wrong), [details](#us-history--what-can-go-wrong), [details](#us-notif-prefs--what-can-go-wrong) |
| "No subscriptions match your filters." | Filters | [details](#su-filter--what-can-go-wrong), [details](#su-list--what-can-go-wrong) |
| Suspend, Revoke or Delete worked but the User may still be charged | The BDApps unsubscribe failed | [details](#us-suspend--what-can-go-wrong), [details](#us-pro-override--what-can-go-wrong), [details](#us-delete-restore--what-can-go-wrong) |
| Article editor: "Saved, but the web app cache did not refresh", an image will not upload, a scheduled article is not live | Cache refresh; image rules; schedule rules | [details](#ac-editor--what-can-go-wrong), [details](#ac-images--what-can-go-wrong), [details](#ac-schedule--what-can-go-wrong), [details](#ac-bulk--what-can-go-wrong), [details](#ac-categories--what-can-go-wrong), [details](#ac-views--what-can-go-wrong) |
| Campaign pages: validation messages, stuck "Sending", "Cannot send a message with status SENT" | Campaign rules | [details](#sm-create--what-can-go-wrong), [details](#sm-send--what-can-go-wrong), [details](#sm-cancel--what-can-go-wrong), [details](#sm-messages--what-can-go-wrong) |
| Email pages: preview fails, "No Resend ID on this log", "RESEND_API_KEY not set" | Email service settings on the server | [details](#em-detail--what-can-go-wrong), [details](#em-preview--what-can-go-wrong), [details](#em-log--what-can-go-wrong) |
| Feedback or User export fails, or Bengali looks broken in Excel | Exported times are 6 hours behind Bangladesh time (add 6 hours); open the file with Data, From Text/CSV and choose UTF-8 | [details](#af-export--what-can-go-wrong), [details](#us-export--what-can-go-wrong), [details](#af-inbox--what-can-go-wrong), [details](#af-detail--what-can-go-wrong) |
| Logs page shows no lines, hides a channel, or masks a code | Only three channels are shown; OTPs are masked | [details](#lg-channels--what-can-go-wrong), [details](#lg-viewer--what-can-go-wrong), [details](#lg-masking--what-can-go-wrong) |
| Audit log: a change is missing or a search finds nothing | Search the action, or copy the User's ID from User detail; press Refresh for a change made a minute ago | [details](#au-search--what-can-go-wrong), [details](#au-entries--what-can-go-wrong) |
| Pro price: "Saved, but the web app cache did not refresh" | The price may look old to Users for a short time | [details](#sy-pro-price--what-can-go-wrong) |
| System: runs missing, Skipped or Failed | The job was off, or failed | [details](#sy-runs--what-can-go-wrong), [details](#sy-run-detail--what-can-go-wrong), [details](#sy-sms-time--what-can-go-wrong) |
| Engagement or analytics chart empty | No data in the period | [details](#en-panels--what-can-go-wrong), [details](#an-prediction-accuracy--what-can-go-wrong), [details](#an-symptoms-phase--what-can-go-wrong) |
| Navigation: icons only, no sidebar, wrong theme | Layout and theme buttons | [details](#aa-navigation--what-can-go-wrong) |

### Related

- [Admin access](#aa-sign-in), [System](#sy-jobs), [Users](#us-list)
- [Ops runbooks](#rl-ops), [Admin API docs](#rl-api-docs)
