# BDApps Simulator cURL Flow Guide

This guide provides copy-paste cURL checks for the local Dockerized BDApps simulator and the Vesta simulator checker endpoints.

## Local Defaults

| Purpose | URL |
| --- | --- |
| Simulator Web UI | `http://localhost:10001/mchoice-tap-sdk` |
| Simulator REST base | `http://127.0.0.1:7002` |
| Vesta checker page | `http://localhost:3001/simulator-check` |
| Vesta checker API base | `http://localhost:3001/api/simulator-check` |
| Callback URL base for simulator UI | `http://host.docker.internal:3001` |

Use `127.0.0.1:7002` for terminal cURL requests to avoid localhost/IPv6 loopback quirks.

## Prerequisites

- The BDApps simulator container is already running.
- The Vesta checker app is running if testing callbacks.
- The current Vesta checker dev server is on port `3001`.
- If the checker runs on another port, replace every `3001` below with that port.

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

### 1.3 Vesta Checker Preflight

```bash
curl -sS "http://localhost:3001/api/simulator-check/preflight"
```

Expected: JSON containing `config`, `callbacks`, `defaults`, and `checks`.

## 2. Outbound Simulator API Flows

These commands call the BDApps simulator directly.

### 2.1 SMS MT: Send SMS to Simulator Phone

Endpoint from the BDApps guide: `POST /sms/send`.

```bash
curl -sS -X POST "http://127.0.0.1:7002/sms/send" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "APP_000006",
    "password": "password",
    "message": "Vesta simulator SMS MT smoke test",
    "destinationAddresses": ["tel:8801812345678"],
    "deliveryStatusRequest": "0",
    "version": "1.0"
  }'
```

Expected: JSON response with top-level or nested `statusCode: "S1000"`.

### 2.2 USSD MT: Send USSD Message

Endpoint from the BDApps guide: `POST /ussd/send`.

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
    "message": "Welcome to Vesta"
  }'
```

Expected: JSON response with `statusCode: "S1000"` when the simulator accepts the request.

### 2.3 CAAS Query Balance

Endpoint from the BDApps guide: `POST /caas/balance/query`.

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

Expected: JSON response with account fields and `statusCode: "S1000"` for success.

### 2.4 CAAS Direct Debit

Endpoint from the BDApps guide: `POST /caas/direct/debit`.

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

## 3. Vesta Checker Proxy Flows

These commands call the local Vesta checker, which forwards to the simulator and returns the raw request, raw response, and interpreted status.

### 3.1 SMS MT Through Checker

```bash
curl -sS -X POST "http://localhost:3001/api/simulator-check/sms/send" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "APP_000006",
    "password": "password",
    "message": "Vesta checker SMS MT smoke test",
    "destinationAddresses": ["tel:8801812345678"],
    "deliveryStatusRequest": "0",
    "version": "1.0"
  }'
```

Expected: `interpretedStatus: "success"` and simulator `statusCode: "S1000"`.

### 3.2 USSD MT Through Checker

```bash
curl -sS -X POST "http://localhost:3001/api/simulator-check/ussd/send" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "APP_003117",
    "password": "password",
    "version": "1.0",
    "sessionId": "local-session-001",
    "ussdOperation": "mt-cont",
    "destinationAddress": "tel:8801812345678",
    "message": "Welcome to Vesta"
  }'
```

### 3.3 CAAS Balance Through Checker

```bash
curl -sS -X POST "http://localhost:3001/api/simulator-check/caas/balance" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "APP_000010",
    "password": "password",
    "subscriberId": "tel:8801812345678",
    "paymentInstrumentName": "Mobile Account",
    "currency": "BDT"
  }'
```

### 3.4 CAAS Direct Debit Through Checker

```bash
curl -sS -X POST "http://localhost:3001/api/simulator-check/caas/direct-debit" \
  -H "Content-Type: application/json" \
  -d '{
    "externalTrxId": "vesta-local-002",
    "amount": "5",
    "applicationId": "APP_000010",
    "password": "password",
    "subscriberId": "tel:8801812345678",
    "paymentInstrumentName": "Mobile Account",
    "currency": "BDT",
    "accountId": "8801812345678"
  }'
```

## 4. Inbound Callback Flows

These commands simulate callbacks arriving at Vesta. They do not require the BDApps simulator UI; they test the local checker callback receivers directly.

### 4.1 SMS MO Receive Callback

Equivalent checker callback URL for the simulator UI:

```text
http://host.docker.internal:3001/api/simulator-check/webhooks/sms/receive
```

Terminal test:

```bash
curl -sS -X POST "http://localhost:3001/api/simulator-check/webhooks/sms/receive" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "APP_000006",
    "sourceAddress": "tel:8801812345678",
    "message": "hello vesta",
    "requestId": "local-sms-mo-001",
    "encoding": "0",
    "version": "1.0",
    "timeStamp": "20260518210030"
  }'
```

Expected: checker response with `statusCode: "S1000"` and an event with `type: "sms.receive"`.

### 4.2 SMS Delivery Report Callback

Equivalent checker callback URL for the simulator UI:

```text
http://host.docker.internal:3001/api/simulator-check/webhooks/sms/report
```

Terminal test:

```bash
curl -sS -X POST "http://localhost:3001/api/simulator-check/webhooks/sms/report" \
  -H "Content-Type: application/json" \
  -d '{
    "destinationAddress": "tel:8801812345678",
    "requestId": "local-sms-mt-001",
    "deliveryStatus": "DELIVERED",
    "timeStamp": "20260518210100"
  }'
```

Expected: checker response with `statusCode: "S1000"` and an event with `type: "sms.report"`.

### 4.3 USSD Receive Callback

Equivalent checker callback URL for the simulator UI:

```text
http://host.docker.internal:3001/api/simulator-check/webhooks/ussd/receive
```

Terminal test:

```bash
curl -sS -X POST "http://localhost:3001/api/simulator-check/webhooks/ussd/receive" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "APP_003117",
    "sessionId": "local-session-001",
    "ussdOperation": "mo-init",
    "sourceAddress": "tel:8801812345678",
    "message": "1",
    "requestId": "local-ussd-mo-001",
    "encoding": "0",
    "version": "1.0"
  }'
```

Expected: checker response with `statusCode: "S1000"` and an event with `type: "ussd.receive"`.

### 4.4 Subscription / CAAS Notify Callback

Equivalent checker callback URL for the simulator UI:

```text
http://host.docker.internal:3001/api/simulator-check/webhooks/subscription/notify
```

Terminal test:

```bash
curl -sS -X POST "http://localhost:3001/api/simulator-check/webhooks/subscription/notify" \
  -H "Content-Type: application/json" \
  -d '{
    "subscriberId": "tel:8801812345678",
    "status": "ACTIVE",
    "reason": "local simulator callback smoke test",
    "timeStamp": "20260518210200"
  }'
```

Expected: checker response with `statusCode: "S1000"` and an event with `type: "subscription.notify"`.

## 5. Callback Log Commands

### 5.1 Read Callback Log

```bash
curl -sS "http://localhost:3001/api/simulator-check/callbacks"
```

Expected: JSON object with an `events` array.

### 5.2 Clear Callback Log

```bash
curl -sS -X DELETE "http://localhost:3001/api/simulator-check/callbacks"
```

Expected: `{"events":[]}`.

## 6. Simulator UI Manual Flow Notes

Use the simulator UI at:

```text
http://localhost:10001/mchoice-tap-sdk
```

For SMS MO:

- Set the application URL to `http://host.docker.internal:3001/api/simulator-check/webhooks/sms/receive`.
- If delivery reports are enabled, set delivery report URL to `http://host.docker.internal:3001/api/simulator-check/webhooks/sms/report`.
- Use status/error code `S1000` for a happy-path run.

For USSD MO:

- Set the application URL to `http://host.docker.internal:3001/api/simulator-check/webhooks/ussd/receive`.
- Use service code such as `*213#`.
- Use status/error code `S1000` for a happy-path run.

For CAAS:

- Use the simulator UI to set balance, account type, account status, and status code.
- Run query balance and direct debit cURL commands afterward to verify how the configured state affects responses.

## 7. Troubleshooting

### cURL cannot connect to `127.0.0.1:7002`

The simulator REST port is not reachable from the host. Confirm the Docker compose mapping includes:

```yaml
ports:
  - "10001:10001"
  - "7002:7000"
```

### Simulator UI works but REST root returns `404`

That can be normal. Test endpoint-specific POSTs such as `/sms/send` and `/caas/balance/query`.

### Callback URLs do not work from simulator UI

Use `host.docker.internal` when the simulator runs in Docker and Vesta runs on the host:

```text
http://host.docker.internal:3001/api/simulator-check/webhooks/sms/receive
```

If Vesta runs inside the same Docker Compose network later, use the service DNS name instead, for example:

```text
http://app:3000/api/simulator-check/webhooks/sms/receive
```

### Direct simulator calls work but checker proxy calls time out

Confirm the checker app can use:

```text
BDAPPS_SIMULATOR_BASE_URL=http://127.0.0.1:7002
```

The checker uses a longer timeout for simulator POSTs because the Java simulator can be slow on first request.
