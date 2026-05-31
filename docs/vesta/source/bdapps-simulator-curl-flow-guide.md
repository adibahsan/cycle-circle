# BDApps Simulator Direct cURL Flow Guide

This guide is for understanding the Dockerized BDApps TAP simulator directly. It uses only:

- Simulator UI: `http://localhost:10001/mchoice-tap-sdk`
- Simulator REST API base from host: `http://127.0.0.1:7002`

It does not require the project web app or any project API route.

## Local Defaults

| Purpose | URL |
| --- | --- |
| Simulator Web UI | `http://localhost:10001/mchoice-tap-sdk` |
| Simulator REST base from host | `http://127.0.0.1:7002` |
| Simulator REST base inside Compose network | `http://bdapps-simulator:7000` |

Use `127.0.0.1:7002` for terminal cURL requests to avoid localhost/IPv6 loopback quirks.

## Start

From the repository root:

```bash
just simulator
```

Or from the simulator directory:

```bash
cd ops/simulator/bdapps
docker compose up -d
```

Then open:

```text
http://localhost:10001/mchoice-tap-sdk
```

## UI-First Testing Loop

Use the TAP Simulator UI as the thing you watch:

1. Open `http://localhost:10001/mchoice-tap-sdk`.
2. Select `SMS`, `USSD`, or `CAAS`.
3. Configure the screen state where needed.
4. Run the matching direct simulator cURL command from this guide.
5. Watch the simulator UI update.

What you can do directly with simulator UI plus simulator REST:

| Flow | How you trigger it | What you watch |
| --- | --- | --- |
| SMS confirmation / OTP-style message | `POST /sms/send` | `SMS` tab `Customers Phone` and `Messages sent to Customer` |
| USSD service prompt | `POST /ussd/send` | `USSD` tab simulated phone/session area |
| CAAS balance | Configure CAAS tab, then `POST /caas/balance/query` | JSON response should match configured account state |
| CAAS debit | Configure CAAS tab, then `POST /caas/direct/debit` | Re-query balance and check success/error status |

MO callbacks are different: the simulator UI `Send Message To Application` form needs an application URL to POST into. If you do not want to involve `apps/web`, point it at any standalone test receiver you control. The visible reply still comes from a follow-up direct REST call to `/sms/send` or `/ussd/send`.

## Status Code Notes

| Code | Meaning |
| --- | --- |
| `S1000` | Success |
| `E1313` | Authentication failed |
| `E1312` | Malformed or invalid request |
| `E1326` | Insufficient balance |

The simulator REST root may return `404`. That is acceptable; endpoint-specific POST requests are the real checks.

## 1. Health Checks

### 1.1 Simulator UI

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" \
  "http://localhost:10001/mchoice-tap-sdk"
```

Expected: `200`.

### 1.2 Simulator REST Base Reachability

```bash
curl -i "http://127.0.0.1:7002/"
```

Expected: any HTTP response, commonly `404`. A connection error means the REST simulator is not reachable.

## 2. SMS: Send Confirmation or OTP-Style Message to Simulator Phone

Endpoint from the BDApps guide: `POST /sms/send`.

Open the simulator `SMS` tab first. Keep `Customers Phone` and `Messages sent to Customer` visible.

```bash
curl -sS -X POST "http://127.0.0.1:7002/sms/send" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "APP_000006",
    "password": "password",
    "message": "Your OTP is 420420",
    "destinationAddresses": ["tel:8801812345678"],
    "deliveryStatusRequest": "0",
    "version": "1.0"
  }'
```

Expected API result: JSON response with top-level or nested `statusCode: "S1000"`.

Expected UI result:

- The `SMS` tab `Customers Phone` screen shows `Your OTP is 420420`.
- The send is listed under `Messages sent to Customer`.

Use the same endpoint for any confirmation message:

```bash
curl -sS -X POST "http://127.0.0.1:7002/sms/send" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "APP_000006",
    "password": "password",
    "message": "Your request has been received",
    "destinationAddresses": ["tel:8801812345678"],
    "deliveryStatusRequest": "0",
    "version": "1.0"
  }'
```

The bundled TAP simulator covers SMS, USSD, and CAAS. It does not expose a documented OTP-specific `/otp/request` simulator flow in the vendor guides, so local OTP-screen testing should be represented as an OTP-style SMS MT message.

## 3. SMS UI MO Then Visible Reply

Use this only if you have a standalone receiver URL outside `apps/web`.

1. Open the simulator `SMS` tab.
2. In `Send Message To Application`, set `URL` to your receiver, for example:

   ```text
   http://host.docker.internal:5555/mo-receiver
   ```

3. Enter a customer message such as `SEND OTP`.
4. Choose `S1000:Success`.
5. Click `Send`.
6. Confirm your receiver saw the inbound payload.
7. Run the `/sms/send` cURL from section 2 to send the confirmation or OTP-style message back to the simulator phone.

This models the visual loop without `apps/web`: simulator customer sends an MO payload to a service API you control, then the service sends an MT SMS back through the simulator REST API.

## 4. USSD: Send Service Prompt to Simulator Phone

Endpoint from the BDApps guide: `POST /ussd/send`.

Open the simulator `USSD` tab first.

```bash
curl -sS -X POST "http://127.0.0.1:7002/ussd/send" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "APP_003117",
    "password": "password",
    "version": "1.0",
    "sessionId": "local-session-001",
    "ussdOperation": "mt-cont",
    "destinationAddress": "tel:8801812345678",
    "message": "Welcome. Reply 1 to continue."
  }'
```

Expected API result: JSON response with `statusCode: "S1000"` when the simulator accepts the request.

Expected UI result:

- The `USSD` tab simulated phone/session area shows the prompt.
- Follow-up messages should reuse the same `sessionId`.
- Use `mt-fin` when you want to end the session.

Example session close:

```bash
curl -sS -X POST "http://127.0.0.1:7002/ussd/send" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "APP_003117",
    "password": "password",
    "version": "1.0",
    "sessionId": "local-session-001",
    "ussdOperation": "mt-fin",
    "destinationAddress": "tel:8801812345678",
    "message": "Thank you. Your request is complete."
  }'
```

## 5. USSD UI MO Then Visible Reply

Use this only if you have a standalone receiver URL outside `apps/web`.

1. Open the simulator `USSD` tab.
2. Set the application URL to your receiver, for example:

   ```text
   http://host.docker.internal:5555/ussd-receiver
   ```

3. Start a customer session with a service code such as `*213#`, `mo-init`, and status `S1000`.
4. Confirm your receiver saw the inbound payload and noted the `sessionId`.
5. Run `/ussd/send` with the same `sessionId` to send the service prompt back to the simulator screen.

## 6. CAAS Balance Query

Endpoint from the BDApps guide: `POST /caas/balance/query`.

Open the simulator `CAAS` tab first. Set the account balance, account type, account status, and status code in the UI.

```bash
curl -sS -X POST "http://127.0.0.1:7002/caas/balance/query" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "APP_000010",
    "password": "password",
    "subscriberId": "tel:8801812345678",
    "paymentInstrumentName": "Mobile Account",
    "currency": "BDT"
  }'
```

Expected: JSON response with account fields and `statusCode: "S1000"` for success. Compare the returned balance fields to the state configured in the CAAS UI.

## 7. CAAS Direct Debit

Endpoint from the BDApps guide: `POST /caas/direct/debit`.

Set a CAAS UI balance greater than the debit amount for the success path.

```bash
curl -sS -X POST "http://127.0.0.1:7002/caas/direct/debit" \
  -H "Content-Type: application/json" \
  -d '{
    "externalTrxId": "vesta-local-001",
    "amount": "5",
    "applicationId": "APP_000010",
    "password": "password",
    "subscriberId": "tel:8801812345678",
    "paymentInstrumentName": "Mobile Account",
    "currency": "BDT",
    "accountId": "8801812345678"
  }'
```

Expected:

- `S1000` when the simulator account has enough balance.
- `E1326` or another CAAS error when balance or simulator status is configured to fail.

After a successful debit, re-run the balance query to confirm the remaining balance changed.

## 8. Failure Injection

### 8.1 Authentication Error

```bash
curl -sS -X POST "http://127.0.0.1:7002/sms/send" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "APP_000006",
    "password": "wrong-password",
    "message": "Auth failure smoke test",
    "destinationAddresses": ["tel:9900014"],
    "deliveryStatusRequest": "0",
    "version": "1.0"
  }'
```

Expected: authentication-style failure such as `E1313`.

### 8.2 Insufficient Balance

In the CAAS tab, set a low balance or force an insufficient-balance status. Then run the direct debit command again.

Expected: insufficient-balance-style failure such as `E1326`.

## 9. Troubleshooting

### cURL cannot connect to `127.0.0.1:7002`

The simulator REST port is not reachable from the host. Confirm the Docker compose mapping includes:

```yaml
ports:
  - "10001:10001"
  - "7002:7000"
```

### Simulator UI works but REST root returns `404`

That can be normal. Test endpoint-specific POSTs such as `/sms/send`, `/ussd/send`, and `/caas/balance/query`.

### Simulator UI cannot call your standalone receiver

If the receiver runs on your host and the simulator runs in Docker, the URL in the simulator UI should usually use `host.docker.internal`, for example:

```text
http://host.docker.internal:5555/mo-receiver
```

If the receiver is another Compose service, use the service DNS name and container port instead.

### Direct CAAS debit always fails

Open the CAAS tab and confirm the configured balance is higher than the debit amount, the account status is active, and the forced status/error code is set to a success path.
