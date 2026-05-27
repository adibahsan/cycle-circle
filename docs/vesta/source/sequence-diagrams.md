# Vesta Sequence Diagrams

These diagrams describe the high-level flows across UI → API routes → DB → worker/webhooks.

## OTP login + session cookie + frontend hydration

```mermaid
sequenceDiagram
  participant U as User
  participant UI as NextUI
  participant API as NextAPI
  participant DB as Postgres
  participant BD as BDApps

  U->>UI: Enter phone, request OTP
  UI->>API: POST /api/auth/otp/request
  API->>BD: requestOtp(phone)
  BD-->>API: referenceNo
  API->>DB: create OtpChallenge(referenceNo, phone, expiresAt)
  API-->>UI: { referenceNo }

  U->>UI: Enter OTP
  UI->>API: POST /api/auth/otp/verify
  API->>BD: verifyOtp(referenceNo, otp)
  BD-->>API: ok
  API->>DB: mark OtpChallenge verified
  API->>DB: upsert User(phone, authMethod=OTP)
  API-->>UI: { user, token } (also sets HttpOnly cookie)

  UI->>UI: store.login(user)
  UI->>API: GET /api/auth/status (hydrate)
  API->>DB: select user
  API-->>UI: { user }
```

## Create profile + enqueue prediction recalculation job

```mermaid
sequenceDiagram
  participant UI as NextUI
  participant API as NextAPI
  participant DB as Postgres
  participant W as Worker

  UI->>API: POST /api/profiles (lastPeriodStart provided)
  API->>DB: create Profile
  API->>DB: create NotificationPreference(profileId)
  API->>DB: insert JobEvent(type=PREDICTION_RECALC, payload={profileId})
  API-->>UI: { profile }

  W->>DB: claim next JobEvent (FOR UPDATE SKIP LOCKED)
  DB-->>W: JobEvent
  W->>DB: read PeriodLogs + Profile
  W->>DB: upsert Prediction(profileId, dates, tier, confidence)
  W->>DB: mark JobEvent COMPLETED
```

## Period log create/update triggers recalculation

```mermaid
sequenceDiagram
  participant UI as NextUI
  participant API as NextAPI
  participant DB as Postgres
  participant W as Worker

  UI->>API: POST /api/tracking/period-logs
  API->>DB: create PeriodLog
  API->>DB: insert JobEvent(PREDICTION_RECALC, {profileId})
  API-->>UI: { log }

  W->>DB: claim job
  W->>DB: compute + upsert Prediction
```

## Symptom logging

```mermaid
sequenceDiagram
  participant UI as NextUI
  participant API as NextAPI
  participant DB as Postgres

  UI->>API: POST /api/tracking/symptoms
  API->>DB: verify profile ownership
  API->>DB: create SymptomLog(date, category, symptomId, value)
  API-->>UI: { log }
```

## Webhook persistence (idempotent)

```mermaid
sequenceDiagram
  participant BD as BDApps
  participant API as NextAPI
  participant DB as Postgres

  BD->>API: POST /api/webhooks/* (payload + idempotency key)
  API->>API: validateWebhookSource()
  API->>DB: find WebhookEvent(idempotencyKey)
  alt Already seen
    DB-->>API: existing row
    API-->>BD: 200 (ack)
  else New
    API->>DB: create WebhookEvent(type, payload, idempotencyKey)
    API-->>BD: 200 (ack)
  end
```

