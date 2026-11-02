# Cycle Circle

A bilingual (English + Bengali) reproductive health and cycle intelligence product for Bangladesh, used by individuals and up to six family profiles.

## Language

**Cycle Circle**:
The product's name, written as two title-case words in all user-facing English text. The logo always uses the Latin wordmark; running Bengali text writes it সাইকেল সার্কেল.
_Avoid_: Vesta, ভেস্তা, CycleCircle, cycle circle

**Vesta**:
The product's former name, kept only as the internal code name in identifiers; never shown to users.
_Avoid_: using it in any user-facing text

**Bangladesh day**:
A calendar day in Bangladesh time (UTC+6, no daylight saving): the day that "today", "35 days ago" and every date the product shows or stores is counted in. An event (a signup, a sent SMS, a check-in) belongs to the Bangladesh day its moment falls on, so every per-day count groups by Bangladesh day.
_Avoid_: local day, server day, UTC day

### People

**User**:
Anyone with a Cycle Circle account who tracks cycles in the app, whether a Subscriber or an email-trial account.
_Avoid_: customer, client, member

**Admin**:
A staff member of the company operating Cycle Circle who signs in to the admin panel to manage Users, content and messaging.
_Avoid_: customer, operator, staff user

### Prompts and engagement

**Check-in**:
The once-a-day quick log of how the user feels today: a few common symptoms, or "all good". The lightest form of logging.
_Avoid_: daily log, mood check, quick log

**Logging nudge**:
A reminder card that appears only when the active profile has logged nothing for three or more days.
_Avoid_: check-in card, "How are you feeling" banner

**Profile completion**:
How much of the optional account details (such as a recovery email) the user has filled in, shown as a percentage ring on the profile chip.
_Avoid_: onboarding progress, setup score

**Auto-prompt**:
A pop-up the app opens on its own, not in response to a tap: the trial lock, the late-period alert, the onboarding tour, the check-in, and the profile-completion prompt. At most one shows per page load.
_Avoid_: popup, interstitial, nag

**Trial lock**:
The blocking screen shown to an email-trial account whose 24-hour trial has ended; only upgrading or logging out gets past it.
_Avoid_: paywall, trial expired modal

### Cycle insights

**Phase pattern**:
The symptoms a profile has logged most often in a given cycle phase, across its past cycles.
_Avoid_: forecast, prediction, "how you might feel"

### Phone login

**Subscriber**:
A phone number that BDApps reports as subscribed to Cycle Circle; the user behind it is Pro.
_Avoid_: registered user, BDApps user

**Masked subscriber id**:
The opaque address BDApps gives a subscriber in place of their phone number; it is the only address BDApps accepts for that subscriber, and it changes with each new subscription.
_Avoid_: subscriber id (alone), masked number, tel id

**BDApps OTP**:
A one-time code that BDApps sends to a phone number; verifying it subscribes the number, so it is how a new phone user logs in and becomes Pro.
_Avoid_: OTP (alone), subscription OTP

**App OTP**:
A one-time code that Cycle Circle sends by SMS to an existing subscriber; verifying it proves the person holds the number and logs them in, without subscribing anything.
_Avoid_: manual OTP, our OTP, login code

**Daily subscription check**:
The once-a-day job that asks BDApps whether each subscriber is still subscribed, and moves anyone who no longer is back to Free.
_Avoid_: CaaS check, CAAS, subscription sync

**Pro price**:
The amount a subscriber is charged and how often (daily, weekly or monthly), as set by an admin. It is what the customer app shows and what estimated revenue is counted from; it must match what BDApps actually charges.
_Avoid_: CAAS fee, subscription fee, plan cost

### SMS campaigns

**Campaign**:
A named series of SMS messages sent to every subscriber, one message per Bangladesh day over one or more days. A one-off SMS is a one-day campaign.
_Avoid_: broadcast, blast, SMS job

**Campaign message**:
One day's SMS within a campaign: its text and the Bangladesh day it goes out.
_Avoid_: broadcast, campaign day, SMS (alone)

### Activity

**Active user**:
A user who opened the app on a given Bangladesh day. Suspended and deleted users never count.
_Avoid_: DAU (alone), logged-in user, active logger

**Churn**:
A Pro user becoming non-Pro within a period, for one of four reasons: the daily subscription check found them unsubscribed, BDApps reported an unsubscribe, an admin revoked Pro, or the account was deleted. Admin revokes are reported but kept out of the churn rate.
_Avoid_: cancellation, lapse (alone), drop-off

**Estimated revenue**:
What Pro subscribers would have paid in a period at the Pro price in effect each day; an estimate, because BDApps does not report what it actually charged.
_Avoid_: revenue (alone), earnings, billing total

### Operations logs

**Log channel**:
One of six named streams that every server log line belongs to: merchant, customer, webhook, translog, cron, error.
_Avoid_: log file, logger, category

**Merchant call**:
A call Cycle Circle makes out to BDApps as the merchant app (OTP, subscription status, subscribe/unsubscribe, SMS, CaaS), recorded with its request and BDApps' response.
_Avoid_: API log, BDApps log, outbound request

**Customer action**:
Something an end user did in Cycle Circle that matters operationally: logging in, requesting or verifying an OTP, adding a phone, unsubscribing, logging out.
_Avoid_: user event, activity, audit entry

**Webhook event**:
A call BDApps makes into Cycle Circle (subscription notification, incoming SMS or USSD, delivery report), recorded with its payload and what we did with it.
_Avoid_: callback, notification, inbound request

**Translog**:
The record of one plan change: a user moving between Free and Pro, an admin override, or a charge, with who, from what, to what, and the cause.
_Avoid_: transaction log, billing log, subscription history

**Cron run**:
One execution of a scheduled job, recorded as a single summary of what it checked and changed, plus any per-item failures.
_Avoid_: job log, scheduler log

### Admin actions

**Revoke**:
An admin action that makes a user Free and unsubscribes their number on BDApps, so they stop being charged; their data is kept.
_Avoid_: cancel Pro, downgrade, remove subscription

**Suspend**:
An admin action that blocks a user from logging in and unsubscribes their number on BDApps; their data is kept, and Reactivate lifts only the block.
_Avoid_: ban, disable, deactivate

**Admin override**:
A plan (Free or Pro) set by an admin that wins over what BDApps reports, until BDApps reports a new subscription for that number.
_Avoid_: manual plan, forced plan, comp

**Delete**:
An admin action that hides a user's account and unsubscribes their number on BDApps; an admin can restore it within 30 days.
_Avoid_: remove, purge, soft-delete
