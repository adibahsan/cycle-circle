# BDApps subscriptions: operations

How Pro works in production, how to check a subscriber, and how to test with a real number. Decisions: [ADR 0002](../adr/0002-phone-login-is-the-bdapps-subscription.md) (phone login is the subscription, masked ids) and [ADR 0004](../adr/0004-server-logs-are-dated-files-per-channel.md) (logs).

---

## 1. How a user's plan is decided

| Event | Result | Translog `cause` |
|---|---|---|
| Phone login: OTP verify succeeds (`REGISTERED` or a charging-pending status) | **PRO** | `otp-verify` |
| Email user verifies a phone the same way | **PRO**, email trial cleared | `phone-verify` |
| BDApps webhook `subscription/notify` → `REGISTERED` / `UNREGISTERED` | PRO / FREE | `webhook` |
| Nightly `caas-check` (02:00 host time): `getStatus` says `UNREGISTERED` | FREE | `nightly-check` |
| User taps **Unsubscribe** (`/subscription/send`, action `0`) | FREE | `unsubscribe` |
| Admin grant / revoke / set status | whatever the admin set; **always wins** over all of the above | `admin` |

Errors from BDApps never downgrade anyone.

## 2. Masked subscriber ids (important)

`APP_140389` has **number masking**. After OTP verify, BDApps no longer knows the user as `tel:8801…`; it uses an opaque id:

```text
tel:ZTk2ZTk1OGEwN2IzNWI2NTlkOGQ4N2I0Njg4ODgwOTVlYThlOWUyMmE4NGU4ZTEwYzE5NzVhZWMyNDI5NGI1Nzpyb2Jp
                                       (base64 … ":robi" = the operator)
```

- The app stores it on the user's `Subscription.bdappsSubscriberId` at verify time and uses it for `getStatus`, unsubscribe and webhook matching.
- `getStatus` / `subscription/send` with the **raw number** return `E1951` ("invalid address **or** unregistered"), which is ambiguous. The nightly check therefore **skips** (never downgrades) rows that only hold a phone number: users who logged in before 2026-10-18 and the two legacy Pro users with no Subscription row. They are reconciled on their next login or by a webhook.
- The id must be sent **with** the `tel:` prefix; without it BDApps returns `E1325`.

## 3. Finding a subscriber's masked id

From the merchant log (every BDApps call, request + response):

```bash
just logs-prod merchant                       # today's file, tail -f
ssh vesta "jq -c 'select(.event==\"subscription/otp/verify\") | {ts, phone: .data.request.subscriberId, response: .data.response}' /var/log/vesta/app/merchant/$(TZ=Asia/Dhaka date +%F).log"
```

From the translog (plan changes, one line each, with `subscriberId`), or the database:

```bash
ssh vesta 'docker exec vesta-postgres-1 sh -c "psql -U \$POSTGRES_USER -d \$POSTGRES_DB -tAc \"select u.phone, s.status, s.\\\"bdappsSubscriberId\\\" from \\\"User\\\" u join \\\"Subscription\\\" s on s.\\\"userId\\\"=u.id where u.phone = '\''+8801XXXXXXXXX'\'';\""'
```

Webhook payloads are also stored in the `WebhookEvent` table and the webhook log channel.

## 4. Checking or changing a subscription by hand

Run from the VPS (its IP is allowlisted by BDApps; elsewhere you get `E1303`). Credentials are in `/opt/vesta/.env.web.production`.

```bash
ssh vesta
# Don't `source` the env file: unquoted values like `RESEND_FROM_EMAIL=Name <a@b>` break bash.
envv() { grep -E "^$1=" /opt/vesta/.env.web.production | cut -d= -f2- | tr -d '\r'; }
BDAPPS_APP_ID=$(envv BDAPPS_APP_ID); BDAPPS_PASSWORD=$(envv BDAPPS_PASSWORD)
SID='tel:<masked-id>'
# status
curl -4 -s -X POST https://developer.bdapps.com/subscription/getStatus -H 'content-type: application/json' \
  -d "{\"applicationId\":\"$BDAPPS_APP_ID\",\"password\":\"$BDAPPS_PASSWORD\",\"subscriberId\":\"$SID\"}"
# app-wide subscriber count
curl -4 -s -X POST https://developer.bdapps.com/subscription/query-base -H 'content-type: application/json' \
  -d "{\"applicationId\":\"$BDAPPS_APP_ID\",\"password\":\"$BDAPPS_PASSWORD\"}"
# unsubscribe (stops billing); the app learns it via the webhook or the nightly check
curl -4 -s -X POST https://developer.bdapps.com/subscription/send -H 'content-type: application/json' \
  -d "{\"applicationId\":\"$BDAPPS_APP_ID\",\"password\":\"$BDAPPS_PASSWORD\",\"subscriberId\":\"$SID\",\"action\":\"0\"}"
```

## 5. Real-number end-to-end test

1. Optional reset: if the number is already subscribed, unsubscribe it (§4) and confirm `getStatus` → `UNREGISTERED`.
2. Log in at `https://cycle-circle.com/login` with the number; enter the SMS code (operator charges apply).
3. Expect: the app shows **Pro**; `merchant` log has `subscription/otp/verify` with `subscriberId`; `translog` has `plan.change FREE→PRO cause=otp-verify`; within ~1 min `webhook` has `subscription.notify REGISTERED`.
4. Subscription page → **Unsubscribe from Pro**. Expect `merchant` `subscription/send`, `translog PRO→FREE cause=unsubscribe`, `getStatus` → `UNREGISTERED`.

## 6. Status and error codes seen in production

| Code | Meaning | What we do |
|---|---|---|
| `S1000` | Success | — |
| `E1303` | Caller IP not allowlisted | Call from the VPS (62.171.155.231) |
| `E1313` | Wrong app id / password | Check `.env.web.production` |
| `E1324` | Subscription over HTTP disabled for the app | BDApps support (fixed for `APP_140389` on 2026-10-15) |
| `E1325` | Address format invalid (masked id sent without `tel:`) | Always prefix `tel:` |
| `E1854` | OTP not found / expired | User requests a new code |
| `E1951` | Invalid address **or** not subscribed | Masked id: treat as unregistered. Raw phone: ambiguous, never downgrade |

CaaS (`/caas/*`) returns HTTP 404 for our app: parked, Pro is billed by the subscription itself.

## 7. Webhook listener URLs (registered in the BDApps portal)

- `https://cycle-circle.com/api/webhooks/subscription/notify`
- `https://cycle-circle.com/api/webhooks/sms/receive`
- `https://cycle-circle.com/api/webhooks/sms/report`
- `https://cycle-circle.com/api/webhooks/ussd/receive`

The BDApps webhook source seen so far is `202.134.12.117` (nginx access log, 2026-10-17).
