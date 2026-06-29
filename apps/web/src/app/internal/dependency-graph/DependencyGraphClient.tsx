'use client';

import { useState, useMemo } from 'react';

type Status = 'complete' | 'partial' | 'stub';

interface FlowNode {
  id: string;
  name: string;
  desc: string;
  group: number;
  type: string;
  status: Status;
  deps: string[];
  api: string[];
  store: string[];
  files: string[];
  steps: string[];
}

const GROUPS = [
  { id: 0, label: 'Docker Services', color: '#64748b', bg: '#1e293b' },
  { id: 1, label: 'Core Platform', color: '#6366f1', bg: '#1e1b4b' },
  { id: 2, label: 'Service Layer', color: '#8b5cf6', bg: '#2e1065' },
  { id: 3, label: 'Auth & Users', color: '#3b82f6', bg: '#172554' },
  { id: 4, label: 'Tracking & Predictions', color: '#10b981', bg: '#022c22' },
  { id: 5, label: 'Billing & Notifications', color: '#f59e0b', bg: '#422006' },
  { id: 6, label: 'Frontend Features', color: '#e8476c', bg: '#4c0519' },
];

const VISUAL_ORDER = [6, 5, 4, 3, 2, 1, 0];

const NODE_W = 160;
const NODE_H = 42;
const H_GAP = 12;
const V_GAP = 10;
const COLS = 6;
const GROUP_HEADER_H = 36;
const GROUP_GAP = 52;
const PAD_X = 24;
const PAD_TOP = 16;

const FLOWS: FlowNode[] = [
  // ══════════════════════════════════════════════════════
  // GROUP 0: DOCKER SERVICES
  // ══════════════════════════════════════════════════════
  {
    id: 'docker-postgres', name: 'PostgreSQL 16', desc: 'postgres:16-alpine with pgcrypto extension and current_app_user_id() RLS helper function. Persistent volume, pg_isready healthcheck.',
    group: 0, type: 'docker', status: 'complete', deps: [],
    api: [], store: [],
    files: ['ops/docker/compose.yml', 'ops/docker/postgres/init.sql'],
    steps: ['Start postgres:16-alpine container', 'Execute init.sql: pgcrypto + RLS helper', 'Healthcheck pg_isready every 5s', 'Expose port 5432, mount postgres_data volume'],
  },
  {
    id: 'docker-redis', name: 'Redis 7', desc: 'redis:7-alpine with persistent volume. Healthcheck via redis-cli ping. Used for JWT blacklist and rate limiting.',
    group: 0, type: 'docker', status: 'complete', deps: [],
    api: [], store: [],
    files: ['ops/docker/compose.yml'],
    steps: ['Start redis:7-alpine container', 'Healthcheck redis-cli ping every 5s', 'Expose port 6379, mount redis_data volume'],
  },
  {
    id: 'docker-mailpit', name: 'Mailpit', desc: 'axllent/mailpit:latest for local SMTP catching and email preview UI. SMTP on 1025, web UI on 8025.',
    group: 0, type: 'docker', status: 'complete', deps: [],
    api: [], store: [],
    files: ['ops/docker/compose.yml'],
    steps: ['Start axllent/mailpit container', 'Expose SMTP port 1025, web UI port 8025'],
  },
  {
    id: 'docker-bdapps-sim', name: 'BDApps Simulator', desc: 'Custom BDApps TAP SDK simulator (linux/amd64). REST API on 7002, UI on 10001. Curl healthcheck with 90s start period.',
    group: 0, type: 'docker', status: 'complete', deps: [],
    api: [], store: [],
    files: ['ops/docker/compose.yml', 'ops/simulator/bdapps/Dockerfile', 'ops/simulator/bdapps/entrypoint.sh'],
    steps: ['Build image (linux/amd64)', 'Set TAP_REST_PORT=7000, TAP_UI_PORT=10001', 'Run entrypoint.sh', 'Healthcheck curl every 30s, 90s start_period'],
  },
  {
    id: 'docker-worker', name: 'Worker Container', desc: 'Separate worker container built from ops/docker/worker/Dockerfile. Shares DATABASE_URL. Depends on postgres. Processes JobEvent queue.',
    group: 0, type: 'docker', status: 'partial', deps: [],
    api: [], store: [],
    files: ['ops/docker/compose.yml', 'ops/docker/worker/Dockerfile'],
    steps: ['Build worker image', 'Inject DATABASE_URL', 'Wait for postgres healthy', 'restart: unless-stopped'],
  },

  // ══════════════════════════════════════════════════════
  // GROUP 1: CORE PLATFORM
  // ══════════════════════════════════════════════════════
  {
    id: 'env-validation', name: 'Env Validation', desc: 'Zod schema validates all required env vars at startup. Required: DATABASE_URL, BDAPPS_APP_ID, BDAPPS_PASSWORD, JWT_SECRET (min 32), CRON_SECRET.',
    group: 1, type: 'config', status: 'complete', deps: [],
    api: [], store: [],
    files: ['src/lib/env.ts'],
    steps: ['Define Zod envSchema', 'Parse process.env at import time', 'Export typed env object'],
  },
  {
    id: 'prisma-config', name: 'Prisma Config', desc: 'Package-local Prisma scripts point the CLI at prisma/schema.prisma so generate, migrate, and studio commands run from app/.',
    group: 1, type: 'config', status: 'complete', deps: ['env-validation'],
    api: [], store: [],
    files: ['package.json', 'prisma/schema.prisma'],
    steps: ['package.json db:* scripts pass --schema ./prisma/schema.prisma', 'prisma.seed points at tsx prisma/seed.ts'],
  },
  {
    id: 'db-schema', name: 'DB Schema', desc: '13 Prisma models, 11 enums. User, Profile, PeriodLog, SymptomLog, Prediction, Subscription, CaasTransaction, OtpChallenge, MagicLink, WebhookEvent, JobEvent, NotificationPreference, Feedback.',
    group: 1, type: 'db', status: 'complete', deps: ['docker-postgres'],
    api: [], store: [],
    files: ['prisma/schema.prisma'],
    steps: ['11 enums defined', '13 models with relations', 'Indexes on profileId, phone, idempotencyKey', 'SymptomLog.value annotated @encrypted'],
  },
  {
    id: 'prisma-client', name: 'Prisma Client', desc: 'Singleton PrismaClient (plain, no extensions). Cached on globalThis in dev to prevent pool exhaustion.',
    group: 1, type: 'infra', status: 'complete', deps: ['db-schema', 'prisma-config'],
    api: [], store: [],
    files: ['src/server/db.ts'],
    steps: ['Create base PrismaClient', 'Cache on globalThis in non-production'],
  },
  {
    id: 'field-encryption', name: 'Field Encryption', desc: 'Deferred / not wired. prisma-field-encryption (AES-GCM-256) is intentionally out of scope for v1.x. SymptomLog.value is plaintext. Planned for v2 (FR-ENC).',
    group: 1, type: 'infra', status: 'stub', deps: [],
    api: [], store: [],
    files: ['prisma/schema.prisma'],
    steps: ['(deferred) Install prisma-field-encryption', '(deferred) Add PRISMA_FIELD_ENCRYPTION_KEY env var', '(deferred) Extend PrismaClient with fieldEncryptionExtension', '(deferred) SymptomLog.value encrypted transparently'],
  },
  {
    id: 'redis-adapter', name: 'Redis Adapter', desc: 'ioredis singleton. JWT blacklist (SET with TTL), sliding-window rate limiter (sorted sets: ZREMRANGEBYSCORE, ZADD, ZCARD, EXPIRE).',
    group: 1, type: 'infra', status: 'complete', deps: ['docker-redis', 'env-validation'],
    api: [], store: [],
    files: ['src/server/adapters/redis.ts'],
    steps: ['Create ioredis singleton from REDIS_URL', 'blacklistJti: SET blacklist:{jti} EX {ttl}', 'isJtiBlacklisted: EXISTS blacklist:{jti}', 'checkRateLimit: MULTI ZREMRANGEBYSCORE/ZADD/ZCARD/EXPIRE'],
  },
  {
    id: 'rls', name: 'Row-Level Security', desc: 'withRLS() wraps Prisma in interactive transaction. SET LOCAL app.current_user_id via parameterized $executeRaw. Uses init.sql helper function.',
    group: 1, type: 'infra', status: 'complete', deps: ['prisma-client', 'docker-postgres'],
    api: [], store: [],
    files: ['src/server/rls.ts', 'ops/docker/postgres/init.sql'],
    steps: ['Start $transaction interactive session', 'SET LOCAL app.current_user_id (parameterized)', 'Execute user callback fn(tx)', 'Transaction auto-commits/rolls back'],
  },
  {
    id: 'api-error', name: 'API Error Handling', desc: 'ApiError class (statusCode, message, code). apiError() creates JSON responses. handleApiError() dispatches ApiError or returns 500.',
    group: 1, type: 'infra', status: 'complete', deps: [],
    api: [], store: [],
    files: ['src/server/api-error.ts'],
    steps: ['ApiError extends Error with statusCode/code', 'apiError() → Response.json({error})', 'handleApiError() catches and formats'],
  },
  {
    id: 'request-validation', name: 'Request Validation', desc: 'parseBody(req, zodSchema) reads JSON and validates. parseSearchParams(req, zodSchema) validates query params. Throws ApiError(400) on failure.',
    group: 1, type: 'infra', status: 'complete', deps: ['api-error'],
    api: [], store: [],
    files: ['src/server/validation.ts'],
    steps: ['parseBody: request.json() → schema.parse()', 'parseSearchParams: URL.searchParams → schema.parse()', 'ZodError → ApiError(400, VALIDATION_ERROR)'],
  },
  {
    id: 'rate-limiting', name: 'Rate Limiting', desc: 'Sliding-window rate limiter using Redis sorted sets. Per-resource keys (otp:{phone}). Returns {allowed, remaining}.',
    group: 1, type: 'infra', status: 'complete', deps: ['redis-adapter'],
    api: [], store: [],
    files: ['src/server/adapters/redis.ts'],
    steps: ['Accept key, limit, windowSeconds', 'ZREMRANGEBYSCORE prune expired', 'ZADD current timestamp', 'ZCARD count window', 'Return allowed/remaining'],
  },
  {
    id: 'seed-data', name: 'Seed Data', desc: 'Idempotent seed with deterministic IDs. Demo user + 2 profiles + 3 period logs + prediction + notification prefs. Uses $transaction for batched upserts.',
    group: 1, type: 'db', status: 'complete', deps: ['prisma-client', 'db-schema'],
    api: [], store: [],
    files: ['prisma/seed.ts'],
    steps: ['Upsert demo User (tel:8801712345678)', 'Upsert self + wife Profiles', 'Upsert 3 PeriodLogs (3/2/1 months ago)', 'Upsert Prediction (AVERAGE, 0.75)', 'Upsert NotificationPreference records'],
  },

  // ══════════════════════════════════════════════════════
  // GROUP 2: SERVICE LAYER
  // ══════════════════════════════════════════════════════
  {
    id: 'jwt-middleware', name: 'JWT Middleware', desc: 'withAuth() wraps routes with JWT auth + email trial expiry. withCronAuth() validates Bearer CRON_SECRET. Issues HS256 JWTs (30-day, unique jti).',
    group: 2, type: 'auth', status: 'complete', deps: ['prisma-client', 'redis-adapter', 'env-validation', 'api-error'],
    api: [], store: [],
    files: ['src/server/middleware.ts', 'src/server/auth.ts'],
    steps: ['withAuth: requireAuth() → verifyAuth() → getAuthUser()', 'Read vesta_token cookie, jwtVerify HS256', 'Check jti not in Redis blacklist', 'Load User from Prisma by sub', 'Email trial enforcement (402 if expired + FREE)', 'withCronAuth: validate Authorization: Bearer CRON_SECRET'],
  },
  {
    id: 'session-mgmt', name: 'Session Management', desc: '30-day JWT in httpOnly/secure/SameSite=lax cookie. Revocation via Redis jti blacklist. No refresh token. Client auth in localStorage via Zustand persist.',
    group: 2, type: 'auth', status: 'complete', deps: ['jwt-middleware', 'redis-adapter'],
    api: [], store: [],
    files: ['src/server/auth.ts'],
    steps: ['issueJwt: HS256, sub, jti(randomUUID), 30d expiry', 'setAuthCookie: httpOnly, secure, sameSite lax', 'verifyAuth: read cookie → jwtVerify → blacklist check', 'logoutAndBlacklist: jti → Redis with remaining TTL', 'clearAuthCookie: delete vesta_token'],
  },
  {
    id: 'bdapps-client', name: 'BDApps Client', desc: 'HTTP client for BDApps TAP API. requestOtp, verifyOtp, caasDirectDebit, caasGetBalance, smsSend. Exponential backoff (1s/2s/4s). Dev uses simulator URL.',
    group: 2, type: 'adapter', status: 'complete', deps: ['env-validation'],
    api: [], store: [],
    files: ['src/server/adapters/bdapps.ts'],
    steps: ['fetchWithRetry: 3 retries, delays [1s, 2s, 4s]', 'requestOtp → POST /otp/request', 'verifyOtp → POST /otp/verify', 'caasDirectDebit → POST /caas/direct/debit', 'caasGetBalance → POST /caas/get/balance', 'smsSend → POST /sms/send', 'Dev: uses BDAPPS_SIMULATOR_BASE_URL'],
  },
  {
    id: 'mail-adapter', name: 'Mail Adapter', desc: 'Resend SDK for transactional email. Dev fallback: console.log (Mailpit catches SMTP). sendMagicLinkEmail (bilingual template) + generic sendEmail.',
    group: 2, type: 'adapter', status: 'complete', deps: ['env-validation'],
    api: [], store: [],
    files: ['src/server/adapters/mail.ts'],
    steps: ['Conditionally create Resend client if RESEND_API_KEY present', 'sendMagicLinkEmail: bilingual EN/BN HTML template', 'sendEmail: generic HTML email sender', 'Dev: falls back to console.log + Mailpit'],
  },
  {
    id: 'job-queue', name: 'Job Queue', desc: 'PostgreSQL-backed job queue via JobEvent table. enqueueJob writes PENDING. claimNextJob uses FOR UPDATE SKIP LOCKED for atomic claiming.',
    group: 2, type: 'infra', status: 'complete', deps: ['prisma-client'],
    api: [], store: [],
    files: ['src/server/adapters/jobs.ts'],
    steps: ['enqueueJob(type, payload): create PENDING JobEvent', 'claimNextJob: raw SQL FOR UPDATE SKIP LOCKED', 'Returns claimed job record', 'completeJob(id): set COMPLETED + completedAt', 'failJob(id, error): set FAILED + lastError'],
  },
  {
    id: 'worker-loop', name: 'Prediction Recalc (Inline)', desc: 'Prediction recalculation is now called directly inline after period log mutations. No separate worker process.',
    group: 2, type: 'infra', status: 'complete', deps: ['prisma-client', 'job-queue'],
    api: [], store: [],
    files: ['src/server/prediction-calc.ts'],
    steps: ['recalculatePrediction called inline after period log create/update/delete', 'Loads all PeriodLogs, computes cycle lengths', 'Selects tier (AVERAGE/<6 or ARIMA/>=6)', 'Upserts Prediction record'],
  },
  {
    id: 'notifications-adapter', name: 'Notifications', desc: 'Dispatches period alerts, fertile window alerts, logging reminders. Email to all users, SMS to PRO subscribers only. Bilingual EN/BN.',
    group: 2, type: 'adapter', status: 'complete', deps: ['mail-adapter', 'bdapps-client'],
    api: [], store: [],
    files: ['src/server/adapters/notifications.ts', 'src/server/email-templates.ts'],
    steps: ['sendPeriodAlert: email + SMS for PRO', 'sendFertileAlert: email + SMS for PRO', 'sendLoggingReminder: email + SMS for PRO', 'Email via Resend, SMS via BDApps smsSend', 'Templates: branded HTML, 600px responsive, bilingual'],
  },
  {
    id: 'webhook-handler', name: 'Webhook Handler', desc: 'IP whitelist validation via BDAPPS_WEBHOOK_IPS. Dedup via idempotencyKey unique index. persistWebhookEvent for all webhook types.',
    group: 2, type: 'adapter', status: 'complete', deps: ['prisma-client', 'env-validation'],
    api: [], store: [],
    files: ['src/server/adapters/webhooks.ts'],
    steps: ['validateWebhookSource: check x-forwarded-for vs allowlist', 'Allow all if BDAPPS_WEBHOOK_IPS unset (dev)', 'persistWebhookEvent: findUnique on idempotencyKey', 'Skip if already exists (dedup)'],
  },

  // ══════════════════════════════════════════════════════
  // GROUP 3: AUTH & USERS
  // ══════════════════════════════════════════════════════
  {
    id: 'otp-login', name: 'OTP Login', desc: 'Phone → BDApps OTP → verify → JWT → dashboard. Rate limited (3/60s). Validates Bangladeshi MSISDN. Upserts User.',
    group: 3, type: 'auth', status: 'complete', deps: ['bdapps-client', 'redis-adapter', 'prisma-client', 'jwt-middleware', 'rate-limiting'],
    api: ['/api/auth/otp/request', '/api/auth/otp/verify'], store: ['login'],
    files: ['src/app/(auth)/login/page.tsx', 'src/app/(auth)/verify-otp/page.tsx', 'src/app/api/auth/otp/request/route.ts', 'src/app/api/auth/otp/verify/route.ts'],
    steps: ['User enters phone, taps Send OTP', 'validateMsisdn normalizes to tel:88...', 'checkRateLimit (3 req/60s)', 'BDApps requestOtp with retry', 'Store OtpChallenge in DB', 'User enters 6-digit code', 'BDApps verifyOtp', 'Upsert User (authMethod=OTP)', 'issueJwt + setAuthCookie', 'Navigate to /dashboard or /onboarding'],
  },
  {
    id: 'magic-link', name: 'Magic Link Login', desc: 'Email → UUID token → Resend email → callback → JWT + 24h trial → dashboard. Rate limited (3/3600s).',
    group: 3, type: 'auth', status: 'partial', deps: ['mail-adapter', 'redis-adapter', 'prisma-client', 'jwt-middleware', 'rate-limiting'],
    api: ['/api/auth/magic-link/request', '/api/auth/magic-link/callback'], store: ['login'],
    files: ['src/app/(auth)/email-login/page.tsx', 'src/app/api/auth/magic-link/request/route.ts', 'src/app/api/auth/magic-link/callback/route.ts'],
    steps: ['User enters email, taps Send', 'checkRateLimit (3/3600s)', 'Generate UUID token, store MagicLink (1h expiry)', 'sendMagicLinkEmail via Resend', 'User clicks email link', 'GET /callback validates token, marks used', 'Upsert User (authMethod=EMAIL, trial=24h)', 'issueJwt + setAuthCookie', 'Redirect to /?auth=success'],
  },
  {
    id: 'logout', name: 'Logout', desc: 'JWT jti blacklisted in Redis with remaining TTL. Cookie cleared. Zustand store resets auth state. Fire-and-forget API call.',
    group: 3, type: 'auth', status: 'complete', deps: ['jwt-middleware', 'redis-adapter'],
    api: ['/api/auth/logout'], store: ['logout'],
    files: ['src/app/api/auth/logout/route.ts', 'src/server/auth.ts'],
    steps: ['Store: set isAuthenticated=false, user=null', 'authApi.logout() fire-and-forget', 'Server: read cookie, jwtVerify for jti+exp', 'blacklistJti with TTL=remaining seconds', 'clearAuthCookie'],
  },
  {
    id: 'auth-status', name: 'Auth Status', desc: 'GET /api/auth/status returns current user from DB. Protected by withAuth. Used by client to hydrate auth state.',
    group: 3, type: 'auth', status: 'complete', deps: ['jwt-middleware', 'prisma-client'],
    api: ['/api/auth/status'], store: [],
    files: ['src/app/api/auth/status/route.ts'],
    steps: ['Client calls auth.getStatus()', 'withAuth validates JWT + trial expiry', 'Query user from DB by jwt.sub', 'Return {user} JSON'],
  },
  {
    id: 'auth-guard', name: 'Auth Guard', desc: 'Client-side routing guards. Root page → /login, /onboarding, or /dashboard. Main layout redirects unauthenticated to /login.',
    group: 3, type: 'auth', status: 'complete', deps: ['zustand-store'],
    api: [], store: [],
    files: ['src/app/page.tsx', 'src/app/(main)/layout.tsx'],
    steps: ['src/app/page.tsx: check isAuthenticated + onboardingComplete', 'Dispatch to /login, /onboarding, or /dashboard', 'src/app/(main)/layout.tsx: redirect to /login if !isAuthenticated'],
  },
  {
    id: 'onboarding', name: 'Onboarding Wizard', desc: '5-step wizard: Welcome → Goal → Profile → Cycle History → Done. Creates profile via store + API. Navigates to /dashboard.',
    group: 3, type: 'onboarding', status: 'partial', deps: ['zustand-store', 'profile-crud'],
    api: ['/api/profiles'], store: ['addProfile', 'setOnboardingComplete'],
    files: ['src/app/onboarding/page.tsx'],
    steps: ['Step 1: Privacy notice', 'Step 2: Goal selection', 'Step 3: Profile relation + name', 'Step 4: Cycle/period length + last period date', 'Step 5: Summary → handleFinish', 'store.addProfile() + setOnboardingComplete(true)', 'Navigate to /dashboard'],
  },
  {
    id: 'profile-crud', name: 'Profile CRUD', desc: 'Full create/read/update/delete for user profiles. Max 6 profiles. Last profile cannot be deleted. Creates NotificationPreference on create.',
    group: 3, type: 'user', status: 'complete', deps: ['jwt-middleware', 'prisma-client', 'job-queue'],
    api: ['/api/profiles', '/api/profiles/[id]'], store: ['addProfile', 'deleteProfile', 'setActiveProfile'],
    files: ['src/app/api/profiles/route.ts', 'src/app/api/profiles/[id]/route.ts'],
    steps: ['GET /profiles: list all user profiles', 'POST /profiles: validate, enforce 6-limit, create + NotificationPref', 'GET /profiles/[id]: fetch with latest Prediction', 'PATCH /profiles/[id]: partial update with ownership check', 'DELETE /profiles/[id]: block if last, cascade delete', 'Enqueue PREDICTION_RECALC on create if lastPeriodStart set'],
  },
  {
    id: 'profile-nudge', name: 'Profile Completion', desc: 'After OTP login, showProfileCompletion=true. 60s timeout re-prompts. completeProfile updates fullName+phone in store. No API endpoint.',
    group: 3, type: 'user', status: 'stub', deps: ['zustand-store'],
    api: [], store: ['login', 'completeProfile', 'setShowProfileCompletion'],
    files: ['src/lib/store.ts'],
    steps: ['login(otp) sets showProfileCompletion=true', 'setTimeout 60s re-prompts', 'completeProfile(name, phone) updates store', 'No API call — store-only'],
  },

  // ══════════════════════════════════════════════════════
  // GROUP 4: TRACKING & PREDICTIONS
  // ══════════════════════════════════════════════════════
  {
    id: 'period-create', name: 'Period Log Create', desc: 'User creates period log via PeriodLogModal. Optimistic store update + fire-and-forget API. Enqueues PREDICTION_RECALC job.',
    group: 4, type: 'tracking', status: 'complete', deps: ['jwt-middleware', 'prisma-client', 'job-queue'],
    api: ['/api/tracking/period-logs'], store: ['addPeriodLog'],
    files: ['src/app/(main)/dashboard/page.tsx', 'src/app/api/tracking/period-logs/route.ts'],
    steps: ['User clicks Log Period in Quick Actions', 'PeriodLogModal: fill dates + flow intensity', 'store.addPeriodLog (optimistic, temp id)', 'tracking.createPeriodLog fire-and-forget', 'API validates, verifies ownership', 'Prisma creates PeriodLog', 'enqueueJob(PREDICTION_RECALC)'],
  },
  {
    id: 'period-update', name: 'Period Log Edit/Delete', desc: 'Edit via PeriodLogModal (pre-filled). PATCH/DELETE API routes. Both re-enqueue PREDICTION_RECALC. Store has no deletePeriodLog action.',
    group: 4, type: 'tracking', status: 'partial', deps: ['jwt-middleware', 'prisma-client', 'job-queue'],
    api: ['/api/tracking/period-logs/[id]'], store: ['updatePeriodLog'],
    files: ['src/app/(main)/dashboard/page.tsx', 'src/app/api/tracking/period-logs/[id]/route.ts'],
    steps: ['User clicks Edit log', 'PeriodLogModal in edit mode', 'store.updatePeriodLog (optimistic)', 'PATCH fire-and-forget', 'DELETE route: verify ownership, cascade', 'Both re-enqueue PREDICTION_RECALC'],
  },
  {
    id: 'symptom-log', name: 'Symptom Logging', desc: 'Toggle symptoms per (profile, date, category, symptomId). Optimistic add/remove in store. API create only (no delete endpoint).',
    group: 4, type: 'symptom', status: 'partial', deps: ['jwt-middleware', 'prisma-client'],
    api: ['/api/tracking/symptoms'], store: ['toggleSymptom'],
    files: ['src/app/(main)/symptoms/page.tsx', 'src/app/api/tracking/symptoms/route.ts'],
    steps: ['User selects date from strip', 'Choose category tab (Physical/Mood/Discharge/Lifestyle)', 'Tap SymptomChip to toggle', 'Store checks if exists → add or remove locally', 'If adding: tracking.createSymptom fire-and-forget', 'API validates, verifies ownership', 'Prisma creates SymptomLog (value @encrypted)'],
  },
  {
    id: 'dashboard-api', name: 'Dashboard API', desc: 'GET /api/tracking/dashboard aggregates currentCycleDay, phase, countdown, lastPeriod, prediction for a profile. Frontend uses API with store fallback.',
    group: 4, type: 'tracking', status: 'complete', deps: ['jwt-middleware', 'prisma-client'],
    api: ['/api/tracking/dashboard'], store: [],
    files: ['src/app/api/tracking/dashboard/route.ts'],
    steps: ['Verify profile ownership', 'Fetch most recent PeriodLog', 'Fetch stored Prediction', 'Calculate currentCycleDay from date diff', 'calculatePhase with prediction-aware ovulationDay', 'Return aggregate JSON'],
  },
  {
    id: 'calendar-api', name: 'Calendar API', desc: 'GET /api/tracking/calendar builds CalendarDay[] for a month. Sets for period/predicted/fertile/ovulation dates. Client converts to O(1) Map.',
    group: 4, type: 'calendar', status: 'complete', deps: ['jwt-middleware', 'prisma-client'],
    api: ['/api/tracking/calendar'], store: [],
    files: ['src/app/api/tracking/calendar/route.ts'],
    steps: ['Verify ownership, parse month param', 'Fetch PeriodLogs overlapping month', 'Fetch stored Prediction', 'Build date Sets: period, predicted, fertile, ovulation', 'Return CalendarDay[] array'],
  },
  {
    id: 'prediction-worker', name: 'Prediction Recalc', desc: 'recalculatePrediction called inline after period log mutations. Loads all logs, computes cycle lengths, selects tier (AVERAGE/<6 or ARIMA/>=6), weighted moving average, upserts Prediction.',
    group: 4, type: 'prediction', status: 'complete', deps: ['prisma-client'],
    api: [], store: [],
    files: ['src/server/prediction-calc.ts'],
    steps: ['Load all PeriodLogs for profile (ASC)', 'Compute cycle lengths (day diffs, filter 0<d<90)', 'Tier: ARIMA if >=6 cycles, else AVERAGE', 'AVERAGE: arithmetic mean', 'ARIMA: weighted [1,1.5,2,2.5,3,3.5] over last 6', 'nextPeriodStart = lastLog + avgCycle', 'ovulationDay = nextPeriod - 14d', 'fertileStart = ovulation - 5d, fertileEnd = ovulation + 1d', 'confidence = min(0.95, 0.5 + count*0.05)', 'Upsert Prediction record'],
  },
  {
    id: 'prediction-display', name: 'Prediction Display', desc: 'GET /api/predictions returns stored prediction + tier explanation. Dashboard and calendar embed predictions inline.',
    group: 4, type: 'prediction', status: 'complete', deps: ['jwt-middleware', 'prisma-client', 'prediction-worker'],
    api: ['/api/predictions'], store: [],
    files: ['src/app/api/predictions/route.ts'],
    steps: ['Verify profile ownership', 'Fetch Prediction (unique by profileId)', 'Map tier to explanation text', 'Return {prediction, tierExplanation}'],
  },
  {
    id: 'phase-detection', name: 'Phase Detection', desc: 'Two implementations: client-side (cycle-utils, cycleLength-14) and server-side (dashboard API, prediction-aware ovulationDay). Both classify menstrual/follicular/ovulatory/luteal.',
    group: 4, type: 'tracking', status: 'complete', deps: ['prediction-display'],
    api: [], store: [],
    files: ['src/lib/cycle-utils.ts', 'src/app/api/tracking/dashboard/route.ts'],
    steps: ['Client: getCurrentCycleDay (daysSince % cycleLength + 1)', 'Client: getCurrentPhase (ovulationDay = cycleLength-14)', 'Server: calculatePhase (uses Prediction.ovulationDay if available)', 'getPhaseColor / getPhaseEmoji for rendering'],
  },
  {
    id: 'client-prediction', name: 'Client Prediction', desc: 'computePrediction in cycle-utils. Weighted moving average (weight[i]=i+1). getPredictionTier, getConfidence. Always runs for dashboard confidence card.',
    group: 4, type: 'prediction', status: 'complete', deps: [],
    api: [], store: [],
    files: ['src/lib/cycle-utils.ts'],
    steps: ['predictCycleLength: weighted moving average', 'getPredictionTier: arima if >=6 else average', 'getConfidence: arima→70+n*2(cap 92), average→40+n*8(cap 75)', 'computePrediction: derives all dates', 'Used as fallback when API unavailable'],
  },

  // ══════════════════════════════════════════════════════
  // GROUP 5: BILLING & NOTIFICATIONS
  // ══════════════════════════════════════════════════════
  {
    id: 'billing-subscribe', name: 'Pro Subscribe', desc: 'User upgrades to Pro via BDApps CAAS direct debit (৳99/month). Upserts Subscription + CaasTransaction. Updates User to PRO.',
    group: 5, type: 'billing', status: 'complete', deps: ['jwt-middleware', 'bdapps-client', 'prisma-client'],
    api: ['/api/billing/subscribe'], store: [],
    files: ['src/app/api/billing/subscribe/route.ts'],
    steps: ['User clicks Upgrade to Pro', 'BDAppsModal shows confirm state', 'billing.subscribe(99) → POST /api/billing/subscribe', 'Generate externalTrxId, call caasDirectDebit', 'Upsert Subscription (status=PRO)', 'Create CaasTransaction record', 'Update User.subscriptionStatus = PRO'],
  },
  {
    id: 'caas-check', name: 'CAAS Balance Check', desc: 'Cron checks BDApps wallet for all PRO subscribers. 3 consecutive failures → demote to LAPSED.',
    group: 5, type: 'cron', status: 'complete', deps: ['jwt-middleware', 'bdapps-client', 'prisma-client'],
    api: ['/api/cron/caas-check'], store: [],
    files: ['src/app/api/cron/caas-check/route.ts'],
    steps: ['withCronAuth validates CRON_SECRET', 'Query all PRO subscriptions with user.phone', 'For each: caasGetBalance(phone)', 'Success: reset consecutiveFailures', 'Failure: increment consecutiveFailures', 'If >=3 failures: status=LAPSED on Subscription + User'],
  },
  {
    id: 'daily-reminders', name: 'Daily Reminders', desc: 'POST /api/cron/daily-reminders (08:00 UTC). Period alerts (0-2 days ahead), fertile alerts (today), logging reminders (3+ days stale). Per-profile try/catch.',
    group: 5, type: 'cron', status: 'complete', deps: ['jwt-middleware', 'notifications-adapter', 'prisma-client'],
    api: ['/api/cron/daily-reminders'], store: [],
    files: ['src/app/api/cron/daily-reminders/route.ts'],
    steps: ['withCronAuth validates secret', 'Fetch all profiles with user/prediction/prefs/lastLog', 'Period alert: if daysUntil in [0,2] + pref enabled', 'Fertile alert: if fertileStart === today + pref enabled', 'Logging reminder: if daysSinceLastLog >= 3 + pref enabled', 'Return { processed, periodAlerts, fertileAlerts, reminders, errors }'],
  },
  {
    id: 'email-dispatch', name: 'Email Dispatch', desc: 'Generates bilingual HTML from templates → Resend SDK (prod) or console.log (dev). Branded: Vesta gradient header, 600px responsive.',
    group: 5, type: 'notification', status: 'complete', deps: ['mail-adapter'],
    api: [], store: [],
    files: ['src/server/email-templates.ts', 'src/server/adapters/notifications.ts'],
    steps: ['periodAlertEmail / fertileWindowEmail / loggingReminderEmail', 'wrapLayout: bilingual branded HTML shell', 'Vesta colors (#E8476C, #9B7FD4, #FFF5F7)', 'sendEmail: Resend or console.log fallback'],
  },
  {
    id: 'sms-dispatch', name: 'SMS Dispatch', desc: 'BDApps smsSend to PRO subscribers only. Bilingual EN/BN text. Wrapped in .catch() so failures do not abort email delivery.',
    group: 5, type: 'notification', status: 'complete', deps: ['bdapps-client'],
    api: [], store: [],
    files: ['src/server/adapters/notifications.ts', 'src/server/adapters/bdapps.ts'],
    steps: ['Check isProSubscriber + phone exists', 'Construct bilingual SMS text', 'smsSend(text, [phone], deliveryStatusRequest=1)', 'fetchWithRetry to BDApps /sms/send'],
  },
  {
    id: 'webhook-sms', name: 'Webhook: SMS', desc: 'Receives inbound SMS and delivery reports from BDApps. IP validation, dedup by messageId/requestId. Persists WebhookEvent.',
    group: 5, type: 'webhook', status: 'partial', deps: ['webhook-handler', 'prisma-client'],
    api: ['/api/webhooks/sms/receive', '/api/webhooks/sms/report'], store: [],
    files: ['src/app/api/webhooks/sms/receive/route.ts', 'src/app/api/webhooks/sms/report/route.ts'],
    steps: ['POST from BDApps', 'validateWebhookSource IP check', 'Parse payload (sourceAddress/message/messageId)', 'persistWebhookEvent with dedup', 'Return S1000 Received'],
  },
  {
    id: 'webhook-sub', name: 'Webhook: Subscription', desc: 'Receives BDApps subscription lifecycle (ACTIVE/INACTIVE/SUSPENDED/EXPIRED). Maps to PRO/LAPSED. Syncs User + Subscription in DB.',
    group: 5, type: 'webhook', status: 'complete', deps: ['webhook-handler', 'prisma-client'],
    api: ['/api/webhooks/subscription/notify'], store: [],
    files: ['src/app/api/webhooks/subscription/notify/route.ts'],
    steps: ['Validate source IP', 'Parse: subscriberId, status, reason, timeStamp', 'persistWebhookEvent (dedup: subscriberId+timeStamp)', 'Map ACTIVE→PRO, INACTIVE/SUSPENDED/EXPIRED→LAPSED', 'Find user by normalized phone', 'Update User.subscriptionStatus + Subscription.status'],
  },

  // ══════════════════════════════════════════════════════
  // GROUP 6: FRONTEND FEATURES
  // ══════════════════════════════════════════════════════
  {
    id: 'api-client', name: 'API Client', desc: 'src/lib/api.ts typed fetch wrapper. Namespaced: auth, profiles, tracking, predictions, billing, feedback, notifications, health. Throws ApiClientError.',
    group: 6, type: 'frontend', status: 'complete', deps: [],
    api: [], store: [],
    files: ['src/lib/api.ts'],
    steps: ['request<T>(): fetch + Content-Type + error handling', 'auth: requestOtp, verifyOtp, requestMagicLink, logout, getStatus', 'profiles: list, get, create, update, delete', 'tracking: CRUD periodLogs + symptoms, getDashboard, getCalendar', 'billing.subscribe, feedback.submit, health.*'],
  },
  {
    id: 'zustand-store', name: 'Zustand Store', desc: 'Persisted store (vesta-store, localStorage). Auth, profiles, periodLogs, symptoms, settings, feedback. All mutations fire-and-forget to API.',
    group: 6, type: 'frontend', status: 'complete', deps: ['api-client'],
    api: [], store: ['login', 'logout', 'addProfile', 'deleteProfile', 'addPeriodLog', 'updatePeriodLog', 'toggleSymptom', 'setLanguage', 'setTheme', 'setNotificationPref', 'submitFeedback'],
    files: ['src/lib/store.ts'],
    steps: ['create(persist(...)): name vesta-store', 'Auth: login/logout/completeProfile', 'Profiles: add/delete/setActive (fire-and-forget API)', 'Tracking: addPeriodLog/updatePeriodLog (fire-and-forget)', 'Symptoms: toggleSymptom (add fires API, remove local-only)', 'Settings: language/theme/notificationPrefs', 'Feedback: submitFeedback (fire-and-forget)', 'partialize: persist all except functions'],
  },
  {
    id: 'ui-components', name: 'UI Components', desc: 'Shared primitives: Button (3 variants), Card, Input, LanguageToggle, Shimmer (skeleton), VestaLogo. Used across all pages.',
    group: 6, type: 'frontend', status: 'complete', deps: [],
    api: [], store: [],
    files: ['src/components/ui/Button.tsx', 'src/components/ui/Card.tsx', 'src/components/ui/Input.tsx', 'src/components/ui/LanguageToggle.tsx', 'src/components/ui/Shimmer.tsx', 'src/components/ui/VestaLogo.tsx'],
    steps: ['Button: primary/outline/ghost, sm/md/lg', 'Card: hover, padding, className passthrough', 'Input: label, error, icon slots', 'LanguageToggle: EN/BN switch', 'Shimmer: animated skeleton', 'VestaLogo: branded SVG'],
  },
  {
    id: 'fe-dashboard', name: 'Dashboard Page', desc: 'CycleRing SVG, cycle day, phase, predicted windows, last period, confidence. Fetches API with store fallback. PeriodLogModal bottom sheet.',
    group: 6, type: 'frontend', status: 'complete', deps: ['zustand-store', 'api-client'],
    api: ['/api/tracking/dashboard'], store: ['addPeriodLog', 'updatePeriodLog'],
    files: ['src/app/(main)/dashboard/page.tsx'],
    steps: ['Load store: profiles, periodLogs, activeProfileId', 'useEffect: fetch /api/tracking/dashboard', 'Compute cycle data from API or store fallback', 'Render CycleRing SVG (animated strokeDashoffset)', 'Stats cards: Next Period, Last Period, Confidence', 'PeriodLogModal: date pickers + flow intensity', 'Save: store.addPeriodLog/updatePeriodLog'],
  },
  {
    id: 'fe-calendar', name: 'Calendar Page', desc: 'Monthly grid with color-coded days (period/fertile/ovulation/predicted). API data → O(1) Map. DayDetail sheet. Monthly summary.',
    group: 6, type: 'frontend', status: 'complete', deps: ['zustand-store', 'api-client'],
    api: ['/api/tracking/calendar'], store: [],
    files: ['src/app/(main)/calendar/page.tsx'],
    steps: ['Fetch tracking.getCalendar per month', 'Convert to Map<dateStr, CalendarDay> for O(1) lookup', 'Build dayMetaMap: prefer API, fallback to store', 'Render 35-42 day grid with DayCell buttons', 'Color coding: period/fertile/ovulation/predicted', 'DayDetail sheet: log + symptoms for date', 'Legend and monthly summary prediction card'],
  },
  {
    id: 'fe-content', name: 'Content/Articles', desc: 'Bilingual health articles from DEMO_ARTICLES. Tabs: For You (current phase), per-phase, All. ArticleExpanded overlay with reading progress.',
    group: 6, type: 'frontend', status: 'complete', deps: ['zustand-store'],
    api: [], store: [],
    files: ['src/app/(main)/content/page.tsx'],
    steps: ['Derive currentPhase from active profile', 'Build phase-based tabs', 'Filter articles by activeFilter', 'ArticleCard: title, category badge, phase chips', 'ArticleExpanded: reading progress, ~200wpm time', 'Bengali fallback warning for BN content'],
  },
  {
    id: 'fe-symptoms', name: 'Symptoms Page', desc: 'Date strip (-7 to +2 days), 4 category tabs (Physical/Mood/Discharge/Lifestyle), SymptomChip grid, toggle → store + API.',
    group: 6, type: 'frontend', status: 'complete', deps: ['zustand-store', 'api-client'],
    api: ['/api/tracking/symptoms'], store: ['toggleSymptom'],
    files: ['src/app/(main)/symptoms/page.tsx'],
    steps: ['Build date strip: 7 past + today + 2 future', 'Horizontal scrollable DateChip components', 'Animated category tabs with motion indicator', 'SYMPTOMS_DATA grid with bilingual names', 'SymptomChip toggle → store.toggleSymptom', 'Fixed bottom summary bar with count'],
  },
  {
    id: 'fe-subscription', name: 'Subscription Page', desc: 'Free vs Pro comparison. BDApps modal: confirm → loading → success. Trial countdown for email users. ৳99/month.',
    group: 6, type: 'frontend', status: 'complete', deps: ['zustand-store', 'api-client'],
    api: ['/api/billing/subscribe'], store: [],
    files: ['src/app/(main)/subscription/page.tsx'],
    steps: ['Load user subscriptionStatus, phone, trial', 'useTrialCountdown: hours remaining, update every 60s', 'Feature comparison table (8 features)', 'handleUpgradeClick → BDAppsModal confirm', 'handleConfirm → billing.subscribe(99)', 'On success: transition to success state'],
  },
  {
    id: 'fe-feedback', name: 'Feedback Page', desc: 'Category selection (bug/feature/general/satisfaction), optional star rating, message. Optimistic store + fire-and-forget API. No backend route yet.',
    group: 6, type: 'frontend', status: 'partial', deps: ['zustand-store', 'api-client'],
    api: ['/api/feedback'], store: ['submitFeedback'],
    files: ['src/app/(main)/feedback/page.tsx'],
    steps: ['Select FeedbackCategory from pills', 'Optional StarRating component', 'Type message in textarea', 'handleSubmit → store.submitFeedback', 'feedbackApi.submit fire-and-forget', 'API route /api/feedback NOT yet implemented', '3s success animation, reset form'],
  },
  {
    id: 'fe-settings', name: 'Settings Page', desc: 'Language toggle (EN/BN + i18next), theme switch (dark class on html), notification prefs (3 toggles). Store-only persistence, no API sync for prefs.',
    group: 6, type: 'frontend', status: 'partial', deps: ['zustand-store'],
    api: [], store: ['setLanguage', 'setTheme', 'setNotificationPref'],
    files: ['src/app/(main)/settings/page.tsx', 'src/lib/i18n.ts'],
    steps: ['Language: EN/BN SegmentedControl', 'setLanguage + i18n.changeLanguage', 'Theme: Light/Dark toggle + document.documentElement.classList', 'Notification prefs: 3 Toggle switches', 'setNotificationPref updates store only', 'Gap: DB prefs not synced from client'],
  },
  {
    id: 'fe-checklist', name: 'Backend Checklist', desc: 'Developer tool: setup steps (localStorage), health status panel, API reference accordion, quick test panel, docker commands with copy.',
    group: 6, type: 'frontend', status: 'complete', deps: ['health-checks', 'api-client'],
    api: [], store: [],
    files: ['src/app/internal/backend-checklist/page.tsx', 'src/app/internal/backend-checklist/BackendChecklistClient.tsx'],
    steps: ['Hydrate checklist from localStorage', 'checkAllHealth: fan out to 5 endpoints', 'Setup steps with progress bar', 'API endpoint reference accordion', 'Quick Test Panel: fire real API calls', 'Docker commands with clipboard copy'],
  },
  {
    id: 'health-checks', name: 'Health Checks', desc: '4 health endpoints: /api/health/db (SELECT 1), /redis (PING), /bdapps (curl simulator), /mailpit (curl UI).',
    group: 6, type: 'infra', status: 'complete', deps: ['docker-postgres', 'docker-redis', 'docker-bdapps-sim', 'docker-mailpit'],
    api: ['/api/health/db', '/api/health/redis', '/api/health/bdapps', '/api/health/mailpit'], store: [],
    files: ['src/app/api/health/db/route.ts', 'src/app/api/health/redis/route.ts', 'src/app/api/health/bdapps/route.ts', 'src/app/api/health/mailpit/route.ts'],
    steps: ['DB: prisma.$queryRaw SELECT 1 + latency', 'Redis: redis.ping() + latency', 'BDApps: fetch simulator UI (4s timeout)', 'Mailpit: fetch web UI (4s timeout)'],
  },
];

// ==================== LAYOUT COMPUTATION ====================

interface NodePos { x: number; y: number }
interface GroupBand { gIdx: number; y: number; height: number; label: string; color: string }

function computeLayout(flows: FlowNode[]) {
  const positions = new Map<string, NodePos>();
  const groupBands: GroupBand[] = [];
  let currentY = PAD_TOP;

  for (const gIdx of VISUAL_ORDER) {
    const g = GROUPS[gIdx];
    const nodes = flows.filter(f => f.group === gIdx);
    const rows = Math.ceil(nodes.length / COLS) || 1;
    const bandHeight = GROUP_HEADER_H + rows * (NODE_H + V_GAP) - V_GAP;

    groupBands.push({ gIdx, y: currentY, height: bandHeight, label: g.label, color: g.color });

    nodes.forEach((node, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      positions.set(node.id, {
        x: PAD_X + col * (NODE_W + H_GAP),
        y: currentY + GROUP_HEADER_H + row * (NODE_H + V_GAP),
      });
    });

    currentY += bandHeight + GROUP_GAP;
  }

  return { positions, groupBands, totalHeight: currentY };
}

function edgePath(from: NodePos, to: NodePos): string {
  const x1 = from.x + NODE_W / 2;
  const y1 = from.y + NODE_H;
  const x2 = to.x + NODE_W / 2;
  const y2 = to.y;

  if (Math.abs(y1 - y2) < 10) {
    const midX = (x1 + x2) / 2;
    const arc = -30;
    return `M ${x1} ${y1} Q ${midX} ${y1 + arc} ${x2} ${y2}`;
  }

  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
}

// ==================== STATUS HELPERS ====================

const STATUS_COLORS: Record<Status, string> = {
  complete: '#22c55e',
  partial: '#eab308',
  stub: '#ef4444',
};

const STATUS_LABELS: Record<Status, string> = {
  complete: 'Complete',
  partial: 'Partial',
  stub: 'Stub',
};

// ==================== MAIN COMPONENT ====================

export default function DependencyGraphClient() {
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');

  const { positions, groupBands, totalHeight } = useMemo(() => computeLayout(FLOWS), []);

  const dependentsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    FLOWS.forEach(f => map.set(f.id, []));
    FLOWS.forEach(f => {
      f.deps.forEach(depId => {
        const arr = map.get(depId);
        if (arr) arr.push(f.id);
      });
    });
    return map;
  }, []);

  const activeId = hovered || selected;

  const connectedSet = useMemo(() => {
    if (!activeId) return new Set<string>();
    const node = FLOWS.find(f => f.id === activeId);
    if (!node) return new Set<string>();
    return new Set([activeId, ...node.deps, ...(dependentsMap.get(activeId) || [])]);
  }, [activeId, dependentsMap]);

  const filteredIds = useMemo(() => {
    return new Set(FLOWS.filter(f => {
      if (statusFilter !== 'all' && f.status !== statusFilter) return false;
      if (groupFilter !== 'all' && f.group !== Number(groupFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        return f.name.toLowerCase().includes(q) || f.desc.toLowerCase().includes(q) || f.id.includes(q);
      }
      return true;
    }).map(f => f.id));
  }, [statusFilter, groupFilter, search]);

  const stats = useMemo(() => ({
    total: FLOWS.length,
    complete: FLOWS.filter(f => f.status === 'complete').length,
    partial: FLOWS.filter(f => f.status === 'partial').length,
    stub: FLOWS.filter(f => f.status === 'stub').length,
    apiRoutes: new Set(FLOWS.flatMap(f => f.api)).size,
    storeActions: new Set(FLOWS.flatMap(f => f.store)).size,
  }), []);

  const selectedNode = selected ? FLOWS.find(f => f.id === selected) : null;

  const containerWidth = COLS * (NODE_W + H_GAP) - H_GAP + PAD_X * 2;

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#fafafa', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* ── HEADER ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: '#09090b', borderBottom: '1px solid #27272a', padding: '16px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ background: 'linear-gradient(135deg, #e8476c, #9b7fd4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Vesta</span>
                <span style={{ color: '#a1a1aa', fontWeight: 400 }}>Dependency Graph</span>
              </h1>
              <p style={{ color: '#71717a', fontSize: 13, margin: '4px 0 0' }}>Interactive architecture map — {stats.total} flows, {stats.apiRoutes} API routes, {stats.storeActions} store actions</p>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS.complete, display: 'inline-block' }} />{stats.complete} Complete</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS.partial, display: 'inline-block' }} />{stats.partial} Partial</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS.stub, display: 'inline-block' }} />{stats.stub} Stub</span>
            </div>
          </div>

          {/* ── FILTERS ── */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Search flows..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #3f3f46', background: '#18181b', color: '#fafafa', fontSize: 13, width: 220, outline: 'none' }}
            />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #3f3f46', background: '#18181b', color: '#fafafa', fontSize: 13, outline: 'none' }}>
              <option value="all">All statuses</option>
              <option value="complete">Complete</option>
              <option value="partial">Partial</option>
              <option value="stub">Stub</option>
            </select>
            <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #3f3f46', background: '#18181b', color: '#fafafa', fontSize: 13, outline: 'none' }}>
              <option value="all">All groups</option>
              {GROUPS.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
            {(search || statusFilter !== 'all' || groupFilter !== 'all') && (
              <button onClick={() => { setSearch(''); setStatusFilter('all'); setGroupFilter('all'); }} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #3f3f46', background: '#27272a', color: '#a1a1aa', fontSize: 13, cursor: 'pointer' }}>
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── MAIN GRAPH + DETAIL ── */}
      <div style={{ display: 'flex', maxWidth: 1200, margin: '0 auto', padding: '20px 0', gap: 0 }}>
        {/* ── GRAPH AREA ── */}
        <div style={{ flex: '1 1 auto', overflowX: 'auto', paddingBottom: 40 }}>
          <div style={{ position: 'relative', width: containerWidth, height: totalHeight, minWidth: containerWidth }}>
            {/* SVG Edge Layer */}
            <svg style={{ position: 'absolute', inset: 0, width: containerWidth, height: totalHeight, pointerEvents: 'none', zIndex: 10 }}>
              <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#71717a" opacity="0.6" />
                </marker>
                <marker id="arrowhead-active" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill="#e8476c" opacity="0.9" />
                </marker>
              </defs>

              {activeId && (() => {
                const node = FLOWS.find(f => f.id === activeId);
                if (!node) return null;
                const fromPos = positions.get(activeId);
                if (!fromPos) return null;

                const edges: React.ReactNode[] = [];

                node.deps.forEach(depId => {
                  const toPos = positions.get(depId);
                  if (!toPos) return;
                  edges.push(
                    <path
                      key={`dep-${activeId}-${depId}`}
                      d={edgePath(fromPos, toPos)}
                      fill="none"
                      stroke="#e8476c"
                      strokeWidth={2}
                      strokeOpacity={0.7}
                      markerEnd="url(#arrowhead-active)"
                    />
                  );
                });

                (dependentsMap.get(activeId) || []).forEach(depId => {
                  const depPos = positions.get(depId);
                  if (!depPos) return;
                  edges.push(
                    <path
                      key={`rev-${depId}-${activeId}`}
                      d={edgePath(depPos, fromPos)}
                      fill="none"
                      stroke="#9b7fd4"
                      strokeWidth={1.5}
                      strokeOpacity={0.5}
                      strokeDasharray="6 4"
                      markerEnd="url(#arrowhead)"
                    />
                  );
                });

                return edges;
              })()}
            </svg>

            {/* Group Bands + Nodes */}
            {groupBands.map(band => {
              const groupNodes = FLOWS.filter(f => f.group === band.gIdx);
              return (
                <div key={band.gIdx}>
                  {/* Group Label */}
                  <div style={{
                    position: 'absolute',
                    left: PAD_X,
                    top: band.y,
                    height: GROUP_HEADER_H - 4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <div style={{ width: 4, height: 20, borderRadius: 2, background: band.color }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: band.color, letterSpacing: '0.02em', textTransform: 'uppercase' }}>{band.label}</span>
                    <span style={{ fontSize: 11, color: '#52525b' }}>({groupNodes.length})</span>
                  </div>

                  {/* Nodes */}
                  {groupNodes.map(node => {
                    const pos = positions.get(node.id);
                    if (!pos) return null;
                    const isVisible = filteredIds.has(node.id);
                    const isActive = activeId === node.id;
                    const isConnected = connectedSet.has(node.id);
                    const isDimmed = !!activeId && !isConnected;
                    const group = GROUPS[node.group];

                    return (
                      <div
                        key={node.id}
                        onMouseEnter={() => setHovered(node.id)}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() => setSelected(selected === node.id ? null : node.id)}
                        style={{
                          position: 'absolute',
                          left: pos.x,
                          top: pos.y,
                          width: NODE_W,
                          height: NODE_H,
                          borderRadius: 8,
                          border: `1.5px solid ${isActive ? group.color : isConnected ? group.color + '80' : '#27272a'}`,
                          background: isActive ? group.bg : '#18181b',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          opacity: !isVisible ? 0.15 : isDimmed ? 0.25 : 1,
                          transform: isActive ? 'scale(1.05)' : 'scale(1)',
                          zIndex: isActive ? 30 : isConnected ? 20 : 1,
                          boxShadow: isActive ? `0 0 16px ${group.color}40` : 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          padding: '0 10px',
                          overflow: 'hidden',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLORS[node.status], flexShrink: 0 }} />
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: '#e4e4e7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</span>
                        </div>
                        <span style={{ fontSize: 9.5, color: '#71717a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1, paddingLeft: 12 }}>{node.type}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── DETAIL PANEL ── */}
        {selectedNode && (
          <div style={{
            width: 380,
            flexShrink: 0,
            background: '#18181b',
            borderLeft: '1px solid #27272a',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 120px)',
            position: 'sticky',
            top: 120,
            padding: 20,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: GROUPS[selectedNode.group].color }}>{selectedNode.name}</h2>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: STATUS_COLORS[selectedNode.status] + '20', color: STATUS_COLORS[selectedNode.status], fontWeight: 600 }}>
                    {STATUS_LABELS[selectedNode.status]}
                  </span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#27272a', color: '#a1a1aa' }}>
                    {selectedNode.type}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: 18, padding: 4 }}>×</button>
            </div>

            <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.5, margin: '0 0 16px' }}>{selectedNode.desc}</p>

            {/* Dependencies */}
            {selectedNode.deps.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 11, fontWeight: 600, color: '#e8476c', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Depends on ({selectedNode.deps.length})</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {selectedNode.deps.map(depId => {
                    const dep = FLOWS.find(f => f.id === depId);
                    return (
                      <button
                        key={depId}
                        onClick={() => setSelected(depId)}
                        style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '1px solid #e8476c30', background: '#e8476c10', color: '#f472b6', cursor: 'pointer' }}
                      >
                        {dep?.name || depId}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dependents */}
            {(dependentsMap.get(selectedNode.id) || []).length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 11, fontWeight: 600, color: '#9b7fd4', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Used by ({(dependentsMap.get(selectedNode.id) || []).length})</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {(dependentsMap.get(selectedNode.id) || []).map(depId => {
                    const dep = FLOWS.find(f => f.id === depId);
                    return (
                      <button
                        key={depId}
                        onClick={() => setSelected(depId)}
                        style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '1px solid #9b7fd430', background: '#9b7fd410', color: '#a78bfa', cursor: 'pointer' }}
                      >
                        {dep?.name || depId}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* API Routes */}
            {selectedNode.api.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>API Routes</h3>
                {selectedNode.api.map(route => (
                  <div key={route} style={{ fontSize: 12, fontFamily: 'monospace', color: '#60a5fa', padding: '2px 0' }}>{route}</div>
                ))}
              </div>
            )}

            {/* Store Actions */}
            {selectedNode.store.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 11, fontWeight: 600, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Store Actions</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {selectedNode.store.map(a => (
                    <span key={a} style={{ fontSize: 11, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4, background: '#10b98120', color: '#34d399' }}>{a}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            {selectedNode.files.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Key Files</h3>
                {selectedNode.files.map(f => (
                  <div key={f} style={{ fontSize: 11, fontFamily: 'monospace', color: '#fbbf24', padding: '1px 0', opacity: 0.8 }}>{f}</div>
                ))}
              </div>
            )}

            {/* Steps */}
            {selectedNode.steps.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>Flow Steps</h3>
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  {selectedNode.steps.map((step, i) => (
                    <li key={i} style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.6, marginBottom: 2 }}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── LEGEND ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 40px' }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12, color: '#71717a' }}>
          <span style={{ fontWeight: 600, color: '#a1a1aa' }}>Edge legend:</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="30" height="8"><line x1="0" y1="4" x2="30" y2="4" stroke="#e8476c" strokeWidth="2" /></svg>
            Depends on (solid)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="30" height="8"><line x1="0" y1="4" x2="30" y2="4" stroke="#9b7fd4" strokeWidth="1.5" strokeDasharray="6 4" /></svg>
            Used by (dashed)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Hover a node to see connections
          </span>
        </div>
      </div>
    </div>
  );
}
