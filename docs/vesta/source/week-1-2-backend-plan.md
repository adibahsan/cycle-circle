# Week 1-2 Backend Plan: Vesta P0

## Summary

Implement the SRS P0 backend inside the existing Next.js app using Route Handlers, Prisma, PostgreSQL, Redis, and service adapters for BDApps, QStash, and Resend. Local development will use a full Docker Compose stack. Production planning stays architecture-level.

Important validation notes:

- The repo is currently a UI prototype using Zustand and dummy data.
- The existing BDApps simulator is reusable and already Dockerized.
- `docs/vesta/source/vesta-kb.md` still mentions an Express backend in places; `docs/vesta/source/SRS.md` is the source of truth, so use Next.js Route Handlers.

## Key Changes

- Add backend foundation:
  - Prisma `6.13.x`, PostgreSQL schema, migrations, generated client, env validation, API error format, and request validation.
  - Add service adapters: `bdapps`, `mail`, `redis`, `jobs`, `auth`, `encryption`, `webhooks`.
  - Add a thin frontend API client so existing demo-store flows can migrate endpoint by endpoint.

- Add database model:
  - `users`, `profiles`, `period_logs`, `symptom_logs`, `predictions`, `subscriptions`, `caas_transactions`, `otp_challenges`, `magic_links`, `webhook_events`, `job_events`.
  - Encrypt sensitive health values through `prisma-field-encryption`.
  - Enforce ownership in API guards and DB RLS.
  - RLS strategy: use a Prisma transaction helper that sets `app.current_user_id` via `set_config`, then policies compare row ownership against that setting.

- Implement P0 route handlers:
  - Auth: OTP request/verify, email magic-link request/callback, logout/JWT blacklist, profile completion status.
  - Profiles: create, list, update, delete, max six profiles, relation types from SRS.
  - Tracking: period logs, symptom logs, dashboard summary, calendar data.
  - Prediction: Tier 1 average, Tier 2 ARIMA-labelled statistical implementation after six cycles, Tier 3 v2 stub only.
  - Billing: CAAS direct debit subscribe flow and cron-protected balance check audit.
  - Webhooks: SMS receive, SMS report, USSD receive, subscription notify with validation, persistence, idempotency, and fast `200` responses.

- Local async design:
  - Use a job abstraction.
  - Local provider writes jobs to the DB and a Compose `worker` service consumes them.
  - Production provider publishes to Upstash QStash.

## Local Dockerized Stack

- Add root Compose stack:
  - `app`: Next.js dev server on `3000`.
  - `postgres`: PostgreSQL 16 with `pgcrypto`.
  - `redis`: local Redis for blacklist/rate limits.
  - `worker`: local job consumer for prediction recalculation.
  - `mailpit`: local email capture for magic links.
  - `bdapps-simulator`: existing simulator, UI `10001`, REST host `7002`.

- Add local commands:
  - `pnpm docker:dev`
  - `pnpm docker:down`
  - `pnpm db:migrate`
  - `pnpm db:seed`
  - `pnpm backend:test`

## Production Architecture

- Vercel runs frontend, API route handlers, middleware, and cron endpoints.
- Supabase PostgreSQL stores all app data with migrations, `pgcrypto`, RLS, and encrypted health fields.
- Upstash Redis stores blacklist entries, rate limits, and short-lived auth state.
- Upstash QStash runs prediction recalculation jobs.
- Resend sends email fallback magic links.
- BDApps handles OTP, CAAS direct debit, balance checks, and inbound webhook callbacks.

## Test Plan

- Unit tests:
  - MSISDN validation, JWT issue/blacklist, email trial expiry, profile limits, prediction tier selection, RLS helper behavior, webhook idempotency keys.

- Integration tests:
  - OTP request/verify using mocked BDApps adapter.
  - Email magic-link login and 24-hour trial expiry.
  - Profile CRUD with cross-user access rejection.
  - Period log save triggers prediction recalculation.
  - Symptom values are encrypted at rest and readable only by owner.
  - CAAS subscribe updates transaction, subscription, and `subscription_status`.
  - Webhooks reject invalid requests, persist valid payloads, dedupe duplicates, and update subscription/SMS status.

- Local smoke tests:
  - Full Compose stack boots.
  - App reaches Postgres, Redis, Mailpit, worker, and BDApps simulator.
  - Core path works: login -> profile -> period log -> prediction -> dashboard/calendar response.

## Assumptions

- `docs/vesta/source/SRS.md` overrides older KB implementation notes.
- Backend remains in the current Next.js app; no separate Express/Nest service.
- Local stack is full Compose.
- Production plan is architecture-level, not a deploy runbook.
- Pro/free gating remains deferred except email-trial expiry enforcement.
- Grace-period warnings and Pro auto-disable remain v2 behavior; Week 1-2 only preserves schema/audit state.
