# Cycle Circle

A bilingual (English + Bengali) reproductive health and cycle intelligence product for Bangladesh, used by individuals and up to six family profiles.

## Language

**Cycle Circle**:
The product's name, written as two title-case words in all user-facing English text. The logo always uses the Latin wordmark; running Bengali text writes it সাইকেল সার্কেল.
_Avoid_: Vesta, ভেস্তা, CycleCircle, cycle circle

**Vesta**:
The product's former name, kept only as the internal code name in identifiers; never shown to users.
_Avoid_: using it in any user-facing text

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
