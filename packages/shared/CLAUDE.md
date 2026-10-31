## Shared Services Layer

12 pure async service modules in `packages/shared/src/server/services/` — no Next.js dependencies. Both apps use thin wrappers (auth + validation + revalidatePath/cache).

| Service | Scope |
|---------|-------|
| `profile-service` | CRUD, 6-profile cap, ownership checks |
| `tracking-service` | Period logs, symptoms, dashboard/calendar data |
| `content-service` | Article/category CRUD, published article listing |
| `feedback-service` | Create, list, export feedback |
| `notification-service` | Notification preference upsert |
| `user-service` | Profile completion, suspend/reactivate/soft-delete |
| `subscription-service` | Grant/revoke Pro, list subscriptions |
| `audit-service` | Admin audit log creation |
| `analytics-service` | Dashboard stats, trends, distributions, retention |
| `campaign-service` | SMS campaigns: planning, edit, delete, list/get with derived status, chart data |
| `campaign-send-service` | Sending campaign messages: claim/send/record, daily dispatch, stuck recovery, delivery reports |
| `export-service` | CSV generation (feedback, users) |
| `app-otp-service` | Phone login OTP request; App OTP for existing subscribers (ADR 0002) |

Import via `@vesta/shared/server/services`.

All Prisma operations run from `packages/shared/`.
