# Glossary

## Glossary {#gl-terms}

### What it is

The shared vocabulary of the product, copied from `GLOSSARY.md` in the repository. Every chapter of this handbook uses these words. Use the first column when you write to a User or talk to the team; the last column lists words that look right but mean something else here, or that you should not use.

Two spellings are written out in words because the PDF edition of this handbook cannot print Bengali script: the Bengali spelling of Cycle Circle (the running Bengali text writes it in Bengali script) and the Bengali spelling of Vesta.

### Where to find it

This chapter has no screen of its own. The source file is `GLOSSARY.md` at the root of the repository; if the two ever differ, `GLOSSARY.md` wins, and this chapter is updated to match.

### Terms

#### General

| Term | Meaning | Do not say |
|---|---|---|
| **Cycle Circle** | The product's name, written as two title-case words in all user-facing English text. The logo always uses the Latin wordmark; running Bengali text uses the Bengali spelling of Cycle Circle. | Vesta, the Bengali spelling of Vesta, CycleCircle, cycle circle |
| **Vesta** | The product's former name, kept only as the internal code name in identifiers; never shown to users. | using it in any user-facing text |
| **Bangladesh day** | A calendar day in Bangladesh time (UTC+6, no daylight saving): the day that "today", "35 days ago" and every date the product shows or stores is counted in. An event (a signup, a sent SMS, a check-in) belongs to the Bangladesh day its moment falls on, so every per-day count groups by Bangladesh day. | local day, server day, UTC day |

#### People

| Term | Meaning | Do not say |
|---|---|---|
| **User** | Anyone with a Cycle Circle account who tracks cycles in the app, whether a Subscriber or an email-trial account. | customer, client, member |
| **Admin** | A staff member of the company operating Cycle Circle who signs in to the admin panel to manage Users, content and messaging. | customer, operator, staff user |

#### Prompts and engagement

| Term | Meaning | Do not say |
|---|---|---|
| **Check-in** | The once-a-day quick log of how the user feels today: a few common symptoms, or "all good". The lightest form of logging. | daily log, mood check, quick log |
| **Logging nudge** | A reminder card that appears only when the active profile has logged nothing for three or more days. | check-in card, "How are you feeling" banner |
| **Profile completion** | How much of the optional account details (such as a recovery email) the user has filled in, shown as a percentage ring on the profile chip. | onboarding progress, setup score |
| **Auto-prompt** | A pop-up the app opens on its own, not in response to a tap: the trial lock, the late-period alert, the onboarding tour, the check-in, and the profile-completion prompt. At most one shows per page load. | popup, interstitial, nag |
| **Trial lock** | The blocking screen shown to an email-trial account whose 24-hour trial has ended; only upgrading or logging out gets past it. | paywall, trial expired modal |

#### Cycle insights

| Term | Meaning | Do not say |
|---|---|---|
| **Phase pattern** | The symptoms a profile has logged most often in a given cycle phase, across its past cycles. | forecast, prediction, "how you might feel" |

#### Phone login

| Term | Meaning | Do not say |
|---|---|---|
| **Subscriber** | A phone number that BDApps reports as subscribed to Cycle Circle; the user behind it is Pro. | registered user, BDApps user |
| **Masked subscriber id** | The opaque address BDApps gives a subscriber in place of their phone number; it is the only address BDApps accepts for that subscriber, and it changes with each new subscription. | subscriber id (alone), masked number, tel id |
| **BDApps OTP** | A one-time code that BDApps sends to a phone number; verifying it subscribes the number, so it is how a new phone user logs in and becomes Pro. | OTP (alone), subscription OTP |
| **App OTP** | A one-time code that Cycle Circle sends by SMS to an existing subscriber; verifying it proves the person holds the number and logs them in, without subscribing anything. | manual OTP, our OTP, login code |
| **Daily subscription check** | The once-a-day job that asks BDApps whether each subscriber is still subscribed, and moves anyone who no longer is back to Free. | CaaS check, CAAS, subscription sync |
| **Pro price** | The amount a subscriber is charged and how often (daily, weekly or monthly), as set by an admin. It is what the customer app shows and what estimated revenue is counted from; it must match what BDApps actually charges. | CAAS fee, subscription fee, plan cost |

#### SMS campaigns

| Term | Meaning | Do not say |
|---|---|---|
| **Campaign** | A named series of SMS messages sent to every subscriber, one message per Bangladesh day over one or more days. A one-off SMS is a one-day campaign. | broadcast, blast, SMS job |
| **Campaign message** | One day's SMS within a campaign: its text and the Bangladesh day it goes out. | broadcast, campaign day, SMS (alone) |

#### Activity

| Term | Meaning | Do not say |
|---|---|---|
| **Active user** | A user who opened the app on a given Bangladesh day. Suspended and deleted users never count. | DAU (alone), logged-in user, active logger |
| **Churn** | A Pro user becoming non-Pro within a period, for one of four reasons: the daily subscription check found them unsubscribed, BDApps reported an unsubscribe, an admin revoked Pro, or the account was deleted. Admin revokes are reported but kept out of the churn rate. | cancellation, lapse (alone), drop-off |
| **Estimated revenue** | What Pro subscribers would have paid in a period at the Pro price in effect each day; an estimate, because BDApps does not report what it actually charged. | revenue (alone), earnings, billing total |

#### Operations logs

| Term | Meaning | Do not say |
|---|---|---|
| **Log channel** | One of six named streams that every server log line belongs to: merchant, customer, webhook, translog, cron, error. | log file, logger, category |
| **Merchant call** | A call Cycle Circle makes out to BDApps as the merchant app (OTP, subscription status, subscribe/unsubscribe, SMS, CaaS), recorded with its request and BDApps' response. | API log, BDApps log, outbound request |
| **Customer action** | Something an end user did in Cycle Circle that matters operationally: logging in, requesting or verifying an OTP, adding a phone, unsubscribing, logging out. | user event, activity, audit entry |
| **Webhook event** | A call BDApps makes into Cycle Circle (subscription notification, incoming SMS or USSD, delivery report), recorded with its payload and what we did with it. | callback, notification, inbound request |
| **Translog** | The record of one plan change: a user moving between Free and Pro, an admin override, or a charge, with who, from what, to what, and the cause. | transaction log, billing log, subscription history |
| **Cron run** | One execution of a scheduled job, recorded as a single summary of what it checked and changed, plus any per-item failures. | job log, scheduler log |

#### Admin actions

| Term | Meaning | Do not say |
|---|---|---|
| **Revoke** | An admin action that makes a user Free and unsubscribes their number on BDApps, so they stop being charged; their data is kept. | cancel Pro, downgrade, remove subscription |
| **Suspend** | An admin action that blocks a user from logging in and unsubscribes their number on BDApps; their data is kept, and Reactivate lifts only the block. | ban, disable, deactivate |
| **Admin override** | A plan (Free or Pro) set by an admin that wins over what BDApps reports, until BDApps reports a new subscription for that number. | manual plan, forced plan, comp |
| **Delete** | An admin action that hides a user's account and unsubscribes their number on BDApps; an admin can restore it within 30 days. | remove, purge, soft-delete |
### Related

- Writing rules for this handbook: Part 4 [Links](#rl-ops) lists the decision records behind several terms (for example ADR 0006 for Revoke, Suspend and Delete, and ADR 0008 for the Bangladesh day).
- Where the terms show up: [Plans and access](#pa-at-a-glance), [Logs](#lg-channels), [Scheduled jobs](#sj-overview).
