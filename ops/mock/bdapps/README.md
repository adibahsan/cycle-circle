# BDApps mock

A zero-dependency (plain Node 24) mock of the BDApps endpoints Cycle Circle calls:
`/subscription/{otp/request,otp/verify,getStatus,send,query-base}`, `/sms/send`, `/ussd/send`,
`/caas/*`. Unlike the official Java simulator (`ops/simulator/bdapps`) it implements
`/subscription/*`. State is in memory; restart or `POST /_mock/reset` to clear it.
Real BDApps costs money and needs an allowlisted IP, so use this for local work.

## Run

```bash
pnpm bdapps:mock                                          # http://localhost:7003
docker compose -f ops/docker/compose.yml up -d bdapps-mock
node --test ops/mock/bdapps/                              # tests
```

## Env (mock)

| Var | Default |
|---|---|
| `PORT` | `7003` |
| `BDAPPS_APP_ID` / `BDAPPS_PASSWORD` | `APP_SIMULATOR` / `simulator_password` (must match the app's `.env`) |
| `MOCK_OTP` | `123456` (the generated code is also accepted; OTPs expire after 5 min) |
| `WEBHOOK_URL` | `http://localhost:3000/api/webhooks/subscription/notify` |
| `MOCK_CAAS` | unset: `/caas/*` returns 404 like prod. `enabled`: S1000 responses |

Wrong credentials return `E1313` (HTTP 200). Unregistered numbers return `E1951`.

## Point the app at it

In `apps/web/.env.local`: `NODE_ENV=development`, `DEV_MODE` off, `BDAPPS_SIMULATOR_BASE_URL=http://localhost:7003`,
and `BDAPPS_APP_ID` / `BDAPPS_PASSWORD` equal to the mock's values.

## Dashboard and control endpoints

Open http://localhost:7003/ to see subscribers, OTPs and sent SMS/USSD, with Subscribe/Unsubscribe buttons.

- `GET /_mock/state`, `POST /_mock/reset`
- `POST /_mock/subscribers/:msisdn/unsubscribe` and `/subscribe` change state and POST the
  subscription-notify webhook to `WEBHOOK_URL` (simulates a user unsubscribing via USSD/SMS).

## Test the subscription flow locally

1. Start the mock and the web app with the env above.
2. Enter a Bangladesh number (e.g. `01711111111`) on the login page; the OTP is printed as
   `[bdapps-mock] OTP for tel:8801711111111 = 123456 (ref ...)`.
3. Enter `123456`; the number is now REGISTERED (see the dashboard) and you are logged in.
4. Click Unsubscribe on the dashboard; the webhook fires and the app should downgrade the account.
5. Click Subscribe (or log in again) to restore it, then check SMS sent in the dashboard.
