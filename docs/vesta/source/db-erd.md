# Vesta Database ER Diagram

Source of truth: `prisma/schema.prisma`.

```mermaid
erDiagram
  User ||--o{ Profile : has
  User ||--o{ Subscription : has
  User ||--o{ OtpChallenge : has
  User ||--o{ MagicLink : has
  User ||--o{ Feedback : writes

  Profile ||--o{ PeriodLog : records
  Profile ||--o{ SymptomLog : records
  Profile ||--|| Prediction : has_latest
  Profile ||--|| NotificationPreference : has

  Subscription ||--o{ CaasTransaction : has

  %% Also persisted, not owned by a single user
  WebhookEvent }o--|| User : "may_relate_via_payload"
  JobEvent }o--|| Profile : "may_relate_via_payload"

  User {
    string id PK
    string phone UK
    string email UK
    string fullName
    enum authMethod
    enum subscriptionStatus
    enum language
    datetime emailTrialExpiresAt
    boolean profileCompleted
    enum role
    datetime createdAt
    datetime updatedAt
  }

  Profile {
    string id PK
    string userId FK
    string name
    enum relation
    int cycleLength
    int periodLength
    datetime lastPeriodStart
    string goal
    datetime createdAt
    datetime updatedAt
  }

  PeriodLog {
    string id PK
    string profileId FK
    datetime startDate
    datetime endDate
    enum flowIntensity
    datetime createdAt
    datetime updatedAt
  }

  SymptomLog {
    string id PK
    string profileId FK
    datetime date
    enum category
    string symptomId
    string value
    datetime createdAt
  }

  Prediction {
    string id PK
    string profileId FK_UK
    enum tier
    datetime nextPeriodStart
    datetime ovulationDay
    datetime fertileStart
    datetime fertileEnd
    float confidence
    datetime createdAt
    datetime updatedAt
  }

  NotificationPreference {
    string id PK
    string profileId FK_UK
    boolean periodAlert
    boolean fertileWindow
    boolean loggingReminder
  }

  Subscription {
    string id PK
    string userId FK
    enum status
    string bdappsSubscriberId
    string paymentInstrumentName
    int amount
    int consecutiveFailures
    datetime gracePeriodEndsAt
    datetime createdAt
    datetime updatedAt
  }

  CaasTransaction {
    string id PK
    string subscriptionId FK
    string externalTrxId UK
    string internalTrxId
    string referenceId
    int amount
    string status
    datetime createdAt
  }

  OtpChallenge {
    string id PK
    string userId FK
    string phone
    string referenceNo
    boolean verified
    datetime expiresAt
    datetime createdAt
  }

  MagicLink {
    string id PK
    string userId FK
    string email
    string token UK
    boolean used
    datetime expiresAt
    datetime createdAt
  }

  WebhookEvent {
    string id PK
    enum type
    json payload
    string idempotencyKey UK
    datetime processedAt
    datetime createdAt
  }

  JobEvent {
    string id PK
    string type
    json payload
    enum status
    int attempts
    string lastError
    datetime scheduledAt
    datetime startedAt
    datetime completedAt
    datetime createdAt
  }

  Feedback {
    string id PK
    string userId FK
    string profileId
    enum category
    string message
    int rating
    datetime createdAt
  }
```

