# Architecture Research

**Domain:** Reproductive Health & Cycle Intelligence Platform (Web-based, Bangladesh-first)
**Researched:** 2026-03-26
**Confidence:** HIGH

---

## Standard Architecture

### System Overview

```
                            CLIENTS
 ┌──────────────────────────────────────────────────┐
 │  Browser (Desktop)    Mobile Browser    PWA       │
 └─────────────────────────┬────────────────────────┘
                           │ HTTPS (TLS 1.3)
                           ▼
 ┌──────────────────────────────────────────────────┐
 │              FRONTEND  (Vercel CDN)               │
 │                                                    │
 │  React 19 SPA  +  Vite 6  +  Tailwind v4          │
 │  ┌────────────┐ ┌──────────┐ ┌────────────────┐   │
 │  │ User App   │ │  Admin   │ │ Partner View   │   │
 │  │ (lazy)     │ │  Panel   │ │ (lazy)         │   │
 │  │            │ │  (lazy)  │ │                │   │
 │  └─────┬──────┘ └────┬─────┘ └───────┬────────┘   │
 │        │             │               │             │
 │  ┌─────┴─────────────┴───────────────┴──────────┐  │
 │  │  Shared Shell: ProfileSwitcher, i18n, Auth   │  │
 │  │  TanStack Query  |  Zustand  |  React Router │  │
 │  └──────────────────────┬───────────────────────┘  │
 └─────────────────────────┬──────────────────────────┘
                           │ REST/JSON (JWT in HttpOnly cookies)
                           ▼
 ┌──────────────────────────────────────────────────┐
 │              API SERVER  (Railway)                 │
 │                                                    │
 │  Express 5  +  TypeScript  +  Prisma 6             │
 │  ┌─────────────────────────────────────────────┐   │
 │  │              Middleware Chain                │   │
 │  │  helmet -> cors -> rateLimit -> cookieParser │   │
 │  │  -> verifyJWT -> checkProfileOwnership       │   │
 │  │  -> validateBody(Zod) -> handler             │   │
 │  └──────────────────────┬──────────────────────┘   │
 │  ┌─────────┐ ┌──────────┴──┐ ┌─────────────────┐  │
 │  │ Routes  │ │  Services   │ │ Prediction Eng.  │  │
 │  │ /auth   │ │ CycleService│ │ ┌─────────────┐ │  │
 │  │ /profiles│ │ ProfileSvc │ │ │ Tier1:Avg   │ │  │
 │  │ /cycles │ │ NotifySvc  │ │ │ Tier2:ARIMA │ │  │
 │  │ /predict│ │ PredictSvc │ │ │ Tier3:LSTM  │ │  │
 │  │ /admin  │ │ AdminSvc   │ │ └─────────────┘ │  │
 │  │ /content│ │ ContentSvc │ │ (Strategy Ptrn) │  │
 │  └─────────┘ └─────┬──────┘ └─────────────────┘  │
 └─────────────────────┼─────────────────────────────┘
                       │
         ┌─────────────┼──────────────┐
         ▼             ▼              ▼
 ┌──────────────┐ ┌─────────┐ ┌──────────────────┐
 │ PostgreSQL 16│ │  Redis 7│ │ BullMQ Worker    │
 │              │ │         │ │ (Separate Proc)  │
 │ - Profiles   │ │ - Jobs  │ │                  │
 │ - Cycles     │ │ - Cache │ │ - send-sms       │
 │ - Symptoms   │ │ - Rate  │ │ - send-email     │
 │ - Pregnancy  │ │   Limit │ │ - recalc-predict │
 │ - Encrypted  │ │ - Sess  │ │ - daily-reminder │
 │   fields     │ │         │ │ - content-notify │
 │ (pgcrypto)   │ │         │ │                  │
 └──────────────┘ └─────────┘ └───────┬──────────┘
                                      │
                       ┌──────────────┼──────────────┐
                       ▼              ▼              ▼
                ┌───────────┐  ┌──────────┐  ┌──────────┐
                │ SSL       │  │ Resend   │  │ AWS S3   │
                │ Wireless  │  │ Email    │  │ (Files)  │
                │ (SMS/BD)  │  │ API      │  │          │
                └───────────┘  └──────────┘  └──────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Web Frontend (React SPA)** | UI rendering, client-side routing, form validation, i18n locale switching, profile switcher UI, data fetching/caching via TanStack Query, client state via Zustand | API Server via REST/JSON |
| **Admin Panel (same SPA, lazy-loaded)** | User management, content CMS, analytics dashboards, prediction accuracy reports, notification management, security controls | API Server via REST/JSON (admin-scoped endpoints) |
| **Partner View (same SPA, lazy-loaded)** | Read-only cycle calendar, daily phase insights, pregnancy updates for invited partners | API Server via REST/JSON (partner-scoped endpoints) |
| **API Server (Express 5)** | Request handling, JWT authentication, profile ownership authorization, request validation (Zod), business logic orchestration, database access (Prisma), job scheduling | PostgreSQL, Redis, BullMQ, external services |
| **BullMQ Worker (separate process)** | Background job execution: SMS/email delivery, prediction recalculation, scheduled reminders (daily cron), batch operations, content notification triggers | Redis (queue), PostgreSQL (data), SMS/Email providers |
| **PostgreSQL 16** | Persistent relational data storage, field-level encryption (pgcrypto via prisma-field-encryption), foreign key integrity, indexes for query performance | API Server, BullMQ Worker (read/write) |
| **Redis 7** | BullMQ job queue backing store, API response caching, session storage, rate limit counters | API Server, BullMQ Worker |
| **Shared Package** | Zod validation schemas, TypeScript types/interfaces, enums, constants, i18n key types -- zero runtime code, build-time only | Imported by Web + API at compile time |

---

## Recommended Project Structure

### Monorepo Layout (pnpm + Turborepo)

```
vesta/
├── packages/
│   ├── web/                          # React + Vite + Tailwind frontend
│   │   ├── src/
│   │   │   ├── app/                  # App shell, providers, router config
│   │   │   │   ├── App.tsx           # Root component with providers
│   │   │   │   ├── router.tsx        # React Router route definitions
│   │   │   │   └── providers.tsx     # QueryClient, i18n, Zustand providers
│   │   │   │
│   │   │   ├── components/
│   │   │   │   ├── ui/              # shadcn/ui base components (Button, Card, Dialog...)
│   │   │   │   ├── layout/          # Shell, Sidebar, Header, ProfileSwitcher, Footer
│   │   │   │   └── features/        # Feature-specific composites
│   │   │   │       ├── cycle/       # CycleCalendar, CycleDayCounter, PhaseDisplay
│   │   │   │       ├── symptoms/    # SymptomLogger, SymptomGrid, SymptomHistory
│   │   │   │       ├── pregnancy/   # WeekTracker, KickCounter, AppointmentList
│   │   │   │       ├── medicine/    # MedicineTracker, AlarmConfig, PillStreak
│   │   │   │       ├── analytics/   # CycleTrendChart, SymptomCorrelation
│   │   │   │       ├── partner/     # PartnerCalendar, PhaseInsight
│   │   │   │       ├── onboarding/  # GoalSelector, DataCollector, TrustScreens
│   │   │   │       ├── content/     # ArticleCard, VideoPlayer, ContentFeed
│   │   │   │       └── admin/       # UserTable, AnalyticsDash, ContentEditor
│   │   │   │
│   │   │   ├── pages/               # Route-level components (lazy-loaded)
│   │   │   │   ├── dashboard/       # Home dashboard (cycle day, phase, predictions)
│   │   │   │   ├── calendar/        # Full calendar view
│   │   │   │   ├── symptoms/        # Symptom logging page
│   │   │   │   ├── pregnancy/       # Pregnancy tracker
│   │   │   │   ├── analytics/       # Health analytics dashboard
│   │   │   │   ├── settings/        # Profile settings, notifications, privacy
│   │   │   │   ├── onboarding/      # Onboarding wizard
│   │   │   │   ├── partner/         # Partner sharing view
│   │   │   │   ├── content/         # Article/video viewer
│   │   │   │   ├── auth/            # Login, Register, ForgotPassword
│   │   │   │   └── admin/           # Admin panel pages (lazy, role-gated)
│   │   │   │       ├── users/
│   │   │   │       ├── content-mgmt/
│   │   │   │       ├── analytics/
│   │   │   │       ├── predictions/
│   │   │   │       └── notifications/
│   │   │   │
│   │   │   ├── hooks/               # Custom React hooks
│   │   │   │   ├── useActiveProfile.ts    # Current profile from Zustand
│   │   │   │   ├── useCycleData.ts        # TanStack Query wrapper for cycle data
│   │   │   │   ├── usePredictions.ts      # Fetch predictions for active profile
│   │   │   │   ├── useProfileSwitcher.ts  # Profile switching logic
│   │   │   │   └── useLocale.ts           # i18n locale hooks
│   │   │   │
│   │   │   ├── stores/              # Zustand client state stores
│   │   │   │   ├── profileStore.ts  # activeProfileId, profiles list
│   │   │   │   ├── uiStore.ts       # sidebar, calendar view mode, theme
│   │   │   │   └── onboardingStore.ts # Onboarding wizard step state
│   │   │   │
│   │   │   ├── api/                 # TanStack Query hooks (server state)
│   │   │   │   ├── client.ts        # Axios/fetch instance with JWT interceptor
│   │   │   │   ├── profiles.ts      # useProfiles, useCreateProfile, useUpdateProfile
│   │   │   │   ├── cycles.ts        # useCycles, useLogPeriod, useCyclePredictions
│   │   │   │   ├── symptoms.ts      # useSymptoms, useLogSymptom
│   │   │   │   ├── pregnancy.ts     # usePregnancy, useLogKick, useAppointments
│   │   │   │   ├── medicine.ts      # useMedicines, useLogDose
│   │   │   │   ├── notifications.ts # useNotificationPrefs, useUpdatePrefs
│   │   │   │   ├── content.ts       # useArticles, useContentCategories
│   │   │   │   ├── partner.ts       # usePartnerData, useShareCode
│   │   │   │   └── admin.ts         # useAdminUsers, useAdminAnalytics
│   │   │   │
│   │   │   ├── i18n/                # Translation files
│   │   │   │   ├── config.ts        # i18next initialization
│   │   │   │   ├── en/              # English namespaces
│   │   │   │   │   ├── common.json
│   │   │   │   │   ├── cycle.json
│   │   │   │   │   ├── pregnancy.json
│   │   │   │   │   ├── symptoms.json
│   │   │   │   │   ├── admin.json
│   │   │   │   │   └── onboarding.json
│   │   │   │   └── bn/              # Bengali namespaces (same structure)
│   │   │   │
│   │   │   └── lib/                 # Utilities
│   │   │       ├── cn.ts            # clsx + tailwind-merge utility
│   │   │       ├── dates.ts         # date-fns helpers (cycle calculations)
│   │   │       ├── constants.ts     # App-level constants
│   │   │       └── format.ts        # Number/date formatting (Bengali locale)
│   │   │
│   │   ├── public/
│   │   ├── index.html
│   │   └── vite.config.ts
│   │
│   ├── api/                          # Express.js backend
│   │   ├── src/
│   │   │   ├── routes/               # Route definitions (thin controllers)
│   │   │   │   ├── auth.routes.ts
│   │   │   │   ├── profile.routes.ts
│   │   │   │   ├── cycle.routes.ts
│   │   │   │   ├── symptom.routes.ts
│   │   │   │   ├── pregnancy.routes.ts
│   │   │   │   ├── medicine.routes.ts
│   │   │   │   ├── notification.routes.ts
│   │   │   │   ├── content.routes.ts
│   │   │   │   ├── partner.routes.ts
│   │   │   │   ├── prediction.routes.ts
│   │   │   │   └── admin/            # Admin-only routes
│   │   │   │       ├── users.routes.ts
│   │   │   │       ├── analytics.routes.ts
│   │   │   │       ├── content.routes.ts
│   │   │   │       └── notifications.routes.ts
│   │   │   │
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts           # verifyJWT, requireRole('admin')
│   │   │   │   ├── profileOwnership.ts  # checkProfileOwnership (CRITICAL)
│   │   │   │   ├── partnerAccess.ts  # checkPartnerAccess (read-only scope)
│   │   │   │   ├── validate.ts       # validateBody(zodSchema), validateQuery
│   │   │   │   ├── rateLimiter.ts    # express-rate-limit with Redis store
│   │   │   │   ├── errorHandler.ts   # Central error handling (Express 5 async)
│   │   │   │   └── requestLogger.ts  # Pino HTTP request logging
│   │   │   │
│   │   │   ├── services/             # Business logic layer (NO Express types)
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── profile.service.ts
│   │   │   │   ├── cycle.service.ts
│   │   │   │   ├── symptom.service.ts
│   │   │   │   ├── pregnancy.service.ts
│   │   │   │   ├── medicine.service.ts
│   │   │   │   ├── notification.service.ts
│   │   │   │   ├── content.service.ts
│   │   │   │   ├── partner.service.ts
│   │   │   │   └── admin.service.ts
│   │   │   │
│   │   │   ├── prediction/           # Prediction engine (Strategy Pattern)
│   │   │   │   ├── types.ts          # PredictionEngine interface
│   │   │   │   ├── factory.ts        # getPredictionEngine(dataPointCount)
│   │   │   │   ├── tier1/
│   │   │   │   │   └── simple.ts     # SimpleAveragePrediction
│   │   │   │   ├── tier2/
│   │   │   │   │   └── arima.ts      # ARIMAPrediction
│   │   │   │   └── tier3/
│   │   │   │       └── lstm.ts       # LSTMPrediction (TensorFlow.js)
│   │   │   │
│   │   │   ├── jobs/                 # BullMQ job processors
│   │   │   │   ├── queues.ts         # Queue definitions
│   │   │   │   ├── sendSms.job.ts
│   │   │   │   ├── sendEmail.job.ts
│   │   │   │   ├── recalcPrediction.job.ts
│   │   │   │   ├── dailyReminder.job.ts
│   │   │   │   └── medicineAlarm.job.ts
│   │   │   │
│   │   │   ├── utils/
│   │   │   │   ├── encryption.ts     # Field encryption helpers
│   │   │   │   ├── sms.ts           # SSL Wireless wrapper
│   │   │   │   ├── email.ts         # Resend wrapper
│   │   │   │   ├── s3.ts            # AWS S3 presigned URL helpers
│   │   │   │   └── logger.ts        # Pino logger config
│   │   │   │
│   │   │   └── config/
│   │   │       ├── env.ts            # Zod-validated env vars
│   │   │       └── redis.ts          # Redis connection
│   │   │
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   │
│   │   ├── server.ts                 # Express app entry point
│   │   └── worker.ts                 # BullMQ worker entry point (separate process)
│   │
│   └── shared/                       # Shared between web + api
│       ├── src/
│       │   ├── schemas/              # Zod validation schemas
│       │   │   ├── auth.ts           # loginSchema, registerSchema
│       │   │   ├── profile.ts        # createProfileSchema, updateProfileSchema
│       │   │   ├── cycle.ts          # createCycleSchema, updateCycleSchema
│       │   │   ├── symptom.ts        # logSymptomSchema
│       │   │   ├── pregnancy.ts      # pregnancySchema, appointmentSchema
│       │   │   ├── medicine.ts       # medicineSchema, doseLogSchema
│       │   │   └── notification.ts   # notificationPrefSchema
│       │   │
│       │   ├── types/                # TypeScript interfaces
│       │   │   ├── user.ts
│       │   │   ├── profile.ts
│       │   │   ├── cycle.ts
│       │   │   ├── prediction.ts
│       │   │   ├── symptom.ts
│       │   │   ├── pregnancy.ts
│       │   │   ├── api.ts            # API response envelope types
│       │   │   └── admin.ts
│       │   │
│       │   ├── constants/
│       │   │   ├── symptoms.ts       # Symptom categories + IDs
│       │   │   ├── phases.ts         # Cycle phase definitions
│       │   │   ├── relations.ts      # Profile relation types
│       │   │   └── roles.ts          # User roles (user, admin, superAdmin)
│       │   │
│       │   └── i18n-keys/            # Type-safe translation key constants
│       │       └── index.ts
│       │
│       ├── package.json
│       └── tsconfig.json
│
├── pnpm-workspace.yaml               # Workspace definition
├── turbo.json                         # Turborepo build orchestration
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint, type-check, test on PR
│       └── deploy.yml                # Deploy on merge to main
├── Dockerfile                         # Multi-stage: builder -> runner
├── docker-compose.yml                 # Local dev: Postgres + Redis
└── .env.example
```

### Structure Rationale

- **`packages/web/`:** Feature-based component organization (`components/features/cycle/`) keeps related UI together. Pages are route-level lazy-loaded shells that compose feature components. The `api/` folder contains TanStack Query hooks -- not raw fetch calls -- providing cache-aware server state management.

- **`packages/api/`:** Three-layer architecture (routes -> services -> data). Routes are thin controllers that wire middleware and call services. Services contain all business logic and are framework-agnostic (no Express types). This makes services independently testable and reusable from BullMQ workers.

- **`packages/shared/`:** Zero runtime dependencies. Only Zod schemas, TypeScript types, and constants. Both web and api import at build time. Changes here trigger both packages to rebuild via Turborepo dependency graph.

- **`prediction/`:** Isolated from the rest of the API behind a Strategy Pattern interface. Each tier is a separate module implementing the same `PredictionEngine` contract. The factory selects the tier based on available data points. This isolation means Tier 3 (TensorFlow.js) can be added later without touching any existing code.

- **`jobs/`:** Each job type is a separate file. The worker process (`worker.ts`) registers all job processors. Separation from the API server process means a heavy prediction job cannot block HTTP responses.

---

## Architectural Patterns

### Pattern 1: Multi-Profile Tenant Isolation (CRITICAL)

**What:** Vesta's defining architectural characteristic. One authenticated user (account holder) owns multiple health profiles. Every data record belongs to a profile, not directly to a user. The user-to-profile relationship is one-to-many, and every data query must be scoped to a verified profileId.

**When to use:** Every API endpoint that touches health data. No exceptions.

**Trade-offs:** Adds a mandatory middleware step to every request (+1-2ms latency per request). Requires explicit thinking about "which profile?" in every feature. Worth it because a profile authorization bypass in a reproductive health app is catastrophic.

**Implementation:**

```
USER ACCOUNT (1)
    │
    ├── Profile: "Self" (self)
    │     ├── CycleLog[]
    │     ├── SymptomLog[]
    │     ├── Pregnancy?
    │     ├── MedicineLog[]
    │     ├── Predictions[]
    │     └── NotificationPrefs
    │
    ├── Profile: "Wife" (wife)
    │     ├── CycleLog[]
    │     ├── SymptomLog[]
    │     └── ...
    │
    └── Profile: "Mother" (mother)
          ├── CycleLog[] (menopause-focused)
          └── ...
```

**URL pattern:** All profile-scoped routes use `/profiles/:profileId/` as prefix:

```
GET    /api/profiles                          # List user's profiles
POST   /api/profiles                          # Create new profile
GET    /api/profiles/:profileId               # Get profile details
PUT    /api/profiles/:profileId               # Update profile

GET    /api/profiles/:profileId/cycles        # Get cycle history
POST   /api/profiles/:profileId/cycles        # Log new period
GET    /api/profiles/:profileId/predictions   # Get predictions
POST   /api/profiles/:profileId/symptoms      # Log symptoms
GET    /api/profiles/:profileId/pregnancy     # Get pregnancy data
GET    /api/profiles/:profileId/analytics     # Get health analytics
```

**Middleware chain for every profile-scoped route:**

```typescript
// Every profile-scoped endpoint must pass through this chain:
router.use("/profiles/:profileId/*",
  verifyJWT,              // 1. Is the request authenticated?
  checkProfileOwnership,  // 2. Does this user own this profile?
  // Then: route-specific middleware (validation, etc.)
);
```

**Database enforcement:** Application-level ownership checks in middleware are the primary defense. PostgreSQL Row-Level Security (RLS) is the secondary defense-in-depth layer.

```sql
-- RLS policy: even if application code has a bug, the database prevents cross-user access
ALTER TABLE "CycleLog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY cycle_isolation ON "CycleLog"
  USING ("profileId" IN (
    SELECT id FROM "Profile" WHERE "userId" = current_setting('app.current_user_id')::uuid
  ));
```

### Pattern 2: Shared Schema Validation (Frontend + Backend)

**What:** Define Zod schemas once in the `shared` package. Frontend uses them with React Hook Form (`zodResolver`). Backend uses them in Express validation middleware (`validateBody`). Both sides validate identically.

**When to use:** Every form submission and API endpoint.

**Trade-offs:** Requires monorepo setup overhead. Shared package must be built before web/api. Worth it because validation drift (frontend accepts what backend rejects, or vice versa) causes confusing user-facing errors.

**Example:**

```typescript
// packages/shared/src/schemas/cycle.ts
export const createCycleSchema = z.object({
  startDate: z.string().date(),
  endDate: z.string().date().optional(),
  flowIntensity: z.enum(["light", "medium", "heavy", "spotting"]),
  symptoms: z.array(z.string()).default([]),
  notes: z.string().max(500).optional(),
});

// Frontend: const form = useForm({ resolver: zodResolver(createCycleSchema) });
// Backend:  router.post("/cycles", validateBody(createCycleSchema), handler);
```

### Pattern 3: Prediction Engine Strategy Pattern

**What:** Abstract prediction behind a `PredictionEngine` interface. Each tier (Simple, ARIMA, LSTM) implements the same contract. A factory function selects the appropriate tier based on the number of available data points.

**When to use:** Cycle prediction, fertile window calculation, ovulation estimation.

**Trade-offs:** Interface overhead for simple calculations. Worth it because the client needs cost-differentiated tiers, and tiers must be addable/removable without touching caller code.

```typescript
// prediction/types.ts
interface PredictionEngine {
  predictNextCycle(cycles: CycleLog[]): Promise<CyclePrediction>;
  predictFertileWindow(cycles: CycleLog[]): Promise<FertileWindow>;
  readonly requiredDataPoints: number;
  readonly tier: 1 | 2 | 3;
}

// prediction/factory.ts
function getPredictionEngine(dataPointCount: number, maxTier: number): PredictionEngine {
  if (maxTier >= 3 && dataPointCount >= 12) return new LSTMPrediction();
  if (maxTier >= 2 && dataPointCount >= 6)  return new ARIMAPrediction();
  return new SimpleAveragePrediction();
}
```

**Execution model:** Tier 1 runs synchronously in the request cycle (fast, <10ms). Tier 2/3 are queued as background jobs via BullMQ and results are cached in Redis. The API returns Tier 1 immediately and higher tiers asynchronously.

### Pattern 4: Selective Field-Level Encryption

**What:** Encrypt only truly sensitive fields via `prisma-field-encryption`. Keep structured/queryable data unencrypted.

**When to use:** Sex life details, free-text medical notes, free-text symptom descriptions. NOT for dates, enum values, or boolean flags.

**Trade-offs:** Encrypted fields cannot be indexed, searched, sorted, or used in WHERE clauses. Non-deterministic encryption means the same plaintext produces different ciphertext each time. Companion hash fields enable exact-match lookups but not range queries or partial matches.

**Encrypt these fields:**
- `SexLifeLog.details` (intercourse details, protection method)
- `SexLifeLog.notes`
- `SymptomLog.freeTextNotes` (if any)
- `MedicalNote.content`
- `PregnancyLog.personalNotes`

**Do NOT encrypt these:**
- Dates (startDate, endDate -- needed for range queries)
- Enum values (flowIntensity, moodType -- needed for aggregation)
- Boolean flags (isProtected, fertilityMatch -- needed for analytics)
- Profile metadata (name, relation -- needed for display queries)

### Pattern 5: Layered Admin Panel (Same SPA, Role-Gated)

**What:** The admin panel lives inside the same React SPA but behind role-based route guards and lazy-loaded route bundles. Not a separate application.

**When to use:** Vesta requires admin functionality (user management, content CMS, analytics) from Phase 1.

**Trade-offs:** Admin bundle size added to the SPA (mitigated by lazy loading -- admin code is only downloaded when an admin navigates there). Alternative is a separate admin SPA, which doubles deployment/auth complexity for no real benefit at this scale.

```typescript
// router.tsx
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const UserManagement = lazy(() => import("./pages/admin/users/UserManagement"));

// Role-gated route
<Route
  path="/admin/*"
  element={
    <RequireRole roles={["admin", "superAdmin"]}>
      <AdminLayout />
    </RequireRole>
  }
>
  <Route path="users" element={<UserManagement />} />
  <Route path="content" element={<ContentManagement />} />
  <Route path="analytics" element={<AdminAnalytics />} />
</Route>
```

### Pattern 6: Profile-Aware Cache Invalidation

**What:** TanStack Query cache keys must include the active profileId. When the user switches profiles, all profile-scoped queries invalidate and refetch for the new profile.

**When to use:** Every profile-scoped TanStack Query hook.

**Trade-offs:** Profile switching triggers multiple refetches (~200ms perceived delay). Worth it because stale cross-profile data in a health app is dangerous.

```typescript
// Query key structure: always include profileId
const cycleQueryKey = (profileId: string) => ["cycles", profileId];
const predictionQueryKey = (profileId: string) => ["predictions", profileId];

// On profile switch: invalidate everything profile-scoped
function switchProfile(newProfileId: string) {
  profileStore.setActiveProfile(newProfileId);
  queryClient.invalidateQueries({ queryKey: ["cycles"] });
  queryClient.invalidateQueries({ queryKey: ["predictions"] });
  queryClient.invalidateQueries({ queryKey: ["symptoms"] });
  // etc.
}
```

---

## Data Flow

### Core Data Flow: Period Logging

```
1. User selects a profile via ProfileSwitcher (Zustand: activeProfileId)
2. User taps "Log Period" on CycleCalendar component
3. React Hook Form collects: startDate, endDate, flowIntensity, symptoms[]
4. Zod schema validates input (shared/schemas/cycle.ts)
5. TanStack Query mutation: POST /api/profiles/:profileId/cycles
6. Express middleware chain:
   verifyJWT -> checkProfileOwnership -> validateBody(createCycleSchema)
7. CycleService:
   a. Prisma creates CycleLog row in PostgreSQL
   b. Immediately runs Tier 1 prediction (sync, <10ms)
   c. Queues BullMQ job: "recalculate-predictions" for Tier 2/3
8. Response: 201 { cycle, prediction: { tier1Result, higherTiersPending: true } }
9. TanStack Query invalidates ["cycles", profileId] and ["predictions", profileId]
10. UI updates calendar + prediction display with Tier 1 results
11. BullMQ worker (separate process) picks up the prediction job:
    a. Runs Tier 2 (ARIMA) if >= 6 data points
    b. Caches result in Redis: prediction:{profileId}
12. Next time client fetches predictions, Redis cache includes higher-tier results
```

### Scheduled Reminder Flow

```
1. BullMQ repeatable job runs daily at 8:00 AM BST (cron: "0 8 * * *")
2. Worker queries PostgreSQL:
   SELECT profiles WHERE predicted_period_start BETWEEN now() AND now() + 2 days
3. For each matched profile:
   a. Load notification preferences for the profile's owner
   b. Determine channels: SMS, email, push (per preference)
   c. Determine language: en or bn (from user settings)
4. Queue individual delivery jobs:
   - "send-sms" with Bengali/English template + SSL Wireless API params
   - "send-email" with Resend template
5. Individual workers process each send job:
   - Retry with exponential backoff (3 attempts, 30s/60s/120s delays)
   - On success: log to NotificationLog table
   - On failure after all retries: mark as failed, alert admin
6. Admin panel displays delivery success rates via NotificationLog aggregation
```

### Partner Sharing Flow

```
1. Primary user generates a share code: POST /api/profiles/:profileId/share
2. Server creates PartnerAccess record: { profileId, shareCode, permissions }
   - permissions define what partner can see (calendar: true, symptoms: false)
3. Partner enters share code in their account
4. Server validates code, creates partner link: { partnerUserId, profileId, permissions }
5. Partner's frontend fetches /api/partner/:profileId/calendar (partner-scoped endpoint)
6. partnerAccess middleware verifies: is this user a partner for this profile?
   - Checks PartnerAccess table, not profile ownership
   - Applies field-level filtering based on permissions
7. Partner sees: cycle calendar, current phase, fertile window
   Partner does NOT see: symptom details, sex life data, personal notes
8. Primary user can revoke: DELETE /api/profiles/:profileId/share/:partnerId
```

### Admin Analytics Flow

```
1. Admin navigates to /admin/analytics (role-gated route)
2. Frontend loads admin-specific TanStack Query hooks
3. GET /api/admin/analytics/overview
4. requireRole("admin") middleware validates JWT role claim
5. AdminService queries aggregated data (never individual user data):
   - Total active users, profiles, cycle logs this month
   - Prediction accuracy: predicted vs actual period start (aggregate)
   - Notification delivery success rates
   - Content engagement metrics
6. Response: aggregated metrics for dashboard visualization (Recharts)
```

### State Management Strategy

```
ZUSTAND (Client State)                    TANSTACK QUERY (Server State)
┌────────────────────────┐               ┌──────────────────────────────┐
│ profileStore           │               │ ["profiles"]      -> API     │
│   .activeProfileId     │──selects──>   │ ["cycles", pid]   -> API     │
│   .profiles[]          │               │ ["predictions", pid] -> API  │
│                        │               │ ["symptoms", pid] -> API     │
│ uiStore                │               │ ["pregnancy", pid] -> API    │
│   .sidebarOpen         │               │ ["articles"]      -> API     │
│   .calendarViewMode    │               │ ["admin/users"]   -> API     │
│   .locale              │               │                              │
│                        │               │ Cached, background-refetched,│
│ onboardingStore        │               │ invalidated on mutations     │
│   .currentStep         │               └──────────────────────────────┘
│   .collectedData       │
└────────────────────────┘

Rule: If data comes from the server, use TanStack Query.
      If data is UI-only (toggles, selections, wizard state), use Zustand.
      Never duplicate server state in Zustand.
```

---

## Database Schema Design

### Core Entity Relationships

```
┌─────────────────┐       ┌───────────────────┐
│     User         │       │    Profile          │
│─────────────────│       │───────────────────│
│ id         UUID │──1:N─>│ id          UUID   │
│ email      STR  │       │ userId      FK     │
│ password   HASH │       │ name        STR    │
│ role       ENUM │       │ relationType ENUM  │
│ locale     ENUM │       │ dateOfBirth DATE   │
│ createdAt  TS   │       │ goalType    ENUM   │
│                  │       │ cycleLength INT    │
└─────────────────┘       │ periodLength INT   │
                          │ isActive    BOOL   │
                          │ createdAt   TS     │
                          └─────────┬──────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐
  │    CycleLog       │  │   SymptomLog      │  │  Prediction      │
  │──────────────────│  │──────────────────│  │─────────────────│
  │ id        UUID   │  │ id        UUID   │  │ id       UUID   │
  │ profileId FK     │  │ profileId FK     │  │ profileId FK    │
  │ startDate DATE   │  │ date      DATE   │  │ nextPeriod DATE │
  │ endDate   DATE?  │  │ category  ENUM   │  │ ovulation  DATE │
  │ flowIntensity    │  │ symptomId STR    │  │ fertileStart    │
  │      ENUM        │  │ severity  INT?   │  │ fertileEnd DATE │
  │ createdAt TS     │  │ notes     STR?   │  │ tier     INT    │
  └──────────────────┘  │  /// @encrypted   │  │ confidence FLOAT│
                        │ createdAt TS     │  │ createdAt TS    │
                        └──────────────────┘  └─────────────────┘
              │                     │
              ▼                     ▼
  ┌──────────────────┐  ┌──────────────────┐
  │   PregnancyLog    │  │   MedicineLog     │
  │──────────────────│  │──────────────────│
  │ id        UUID   │  │ id        UUID   │
  │ profileId FK     │  │ profileId FK     │
  │ startDate DATE   │  │ name      STR    │
  │ dueDate   DATE   │  │ dosage    STR    │
  │ currentWeek INT  │  │ schedule  JSON   │
  │ status    ENUM   │  │ isActive  BOOL   │
  │ /// @encrypted    │  │ createdAt TS     │
  │ notes     STR?   │  └──────────────────┘
  │ createdAt TS     │
  └──────────────────┘        ┌──────────────────┐
                              │   SexLifeLog      │
  ┌──────────────────┐        │──────────────────│
  │ NotificationPref  │        │ id        UUID   │
  │──────────────────│        │ profileId FK     │
  │ id        UUID   │        │ date      DATE   │
  │ profileId FK     │        │ /// @encrypted    │
  │ periodReminder   │        │ details   STR    │
  │        BOOL      │        │ /// @encrypted    │
  │ fertileAlert     │        │ notes     STR?   │
  │        BOOL      │        │ fertilityMatch   │
  │ medicineAlarm    │        │        BOOL?     │
  │        BOOL      │        │ createdAt TS     │
  │ channels  JSON   │        └──────────────────┘
  │ // {sms,email,   │
  │    push}          │        ┌──────────────────┐
  └──────────────────┘        │  PartnerAccess    │
                              │──────────────────│
  ┌──────────────────┐        │ id        UUID   │
  │ NotificationLog   │        │ profileId FK     │
  │──────────────────│        │ partnerUserId FK │
  │ id        UUID   │        │ shareCode STR    │
  │ profileId FK     │        │ permissions JSON │
  │ type      ENUM   │        │ isActive  BOOL   │
  │ channel   ENUM   │        │ createdAt TS     │
  │ status    ENUM   │        └──────────────────┘
  │ sentAt    TS     │
  │ error     STR?   │
  └──────────────────┘
```

### Multi-Profile Impact on Database Design

The multi-profile model is the single most consequential architectural decision. It affects database design in five ways:

**1. Every health data table has a `profileId` foreign key, not `userId`.**
This is a hard rule. There is no table where health data points directly at a user. The `Profile` table is the bridge. This means every query that fetches health data requires a JOIN through Profile (or a direct profileId column).

**2. Indexes must be profile-scoped.**
Every health data table needs a composite index on `(profileId, date)` or `(profileId, createdAt)`. Without this, queries like "get cycle history for profile X" scan the entire table.

```sql
CREATE INDEX idx_cycle_profile_date ON "CycleLog" ("profileId", "startDate" DESC);
CREATE INDEX idx_symptom_profile_date ON "SymptomLog" ("profileId", "date" DESC);
CREATE INDEX idx_prediction_profile ON "Prediction" ("profileId", "createdAt" DESC);
```

**3. Cascading deletes must be careful.**
Deleting a profile must cascade-delete all associated health data (cycles, symptoms, predictions, medicines, pregnancy, notifications). Deleting a user must cascade through profiles first. Prisma's `onDelete: Cascade` handles this, but must be tested.

**4. Analytics queries must aggregate by profile, not by user.**
Admin dashboard metrics like "average cycle length" must count per-profile, not per-user. A user with 3 profiles contributes 3 data points to population analytics. The admin panel must never expose which profiles belong to the same user.

**5. Notification routing goes: Profile -> Owner User -> Preferred Channel.**
When a reminder fires for a profile, the system must look up who owns that profile, then route the notification to that user's preferred channel. This is a two-hop lookup, not a simple user query.

### Multi-Profile Impact on API Design

**1. All profile-scoped routes are nested under `/profiles/:profileId/`.**
This makes the ownership boundary explicit in the URL structure. There is no ambiguity about which profile an operation targets.

**2. Profile switching is a client-side concern, not a server-side session.**
The server is stateless about "which profile is active." The client sends the profileId with every request. The server verifies ownership on every request. This means no server-side "active profile" session state to manage.

**3. The `checkProfileOwnership` middleware is mandatory infrastructure.**
It runs on every profile-scoped route before any data access. It queries the database to verify `WHERE profile.id = :profileId AND profile.userId = :authenticatedUserId`. This is a ~2ms query that prevents the most dangerous class of bugs.

**4. Partner access is a separate authorization path.**
Partners are not profile owners. They get a distinct middleware (`checkPartnerAccess`) that verifies the partner relationship and applies field-level permissions. Partner endpoints return filtered data (no sex life, no free-text notes, no medical details).

**5. API responses should include profile context.**
Every profile-scoped response includes `profileId` and `profileName` in the response envelope so the frontend can verify it's displaying data for the correct profile:

```json
{
  "data": { "cycles": [...] },
  "meta": {
    "profileId": "uuid",
    "profileName": "Fatima",
    "relationType": "wife"
  }
}
```

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **0-1K users** | Single PostgreSQL instance on Railway, single API process, single BullMQ worker. Redis on Railway hobby tier. This handles the launch period and initial validation. No optimization needed. |
| **1K-10K users** | Add connection pooling (PgBouncer or Prisma Accelerate). Add Redis caching for frequently-read data (predictions, cycle calendar month views). Consider read replica for analytics queries. Move BullMQ to 2 workers. |
| **10K-100K users** | Separate admin/analytics queries to a read replica to avoid impacting user-facing reads. Add CDN caching for content articles. Deploy 2-3 API instances behind load balancer. Redis cache for prediction results becomes critical. |
| **100K+ users** | Table partitioning by profileId range for CycleLog and SymptomLog (highest-volume tables). Dedicated ML inference service for Tier 3 predictions. Consider message queue between API and prediction service. Auto-scaling container orchestration (Kubernetes/ECS). |

### Scaling Priorities

1. **First bottleneck: Database connections.** A single PostgreSQL instance handles ~100 concurrent connections. With connection pooling (PgBouncer), this extends to ~1000 effective connections. This is the first thing that breaks as users grow. Add PgBouncer before anything else.

2. **Second bottleneck: Prediction computation.** As users accumulate 6+ cycles, Tier 2 (ARIMA) predictions trigger more frequently. Pre-compute predictions nightly (BullMQ cron job) and cache results in Redis. Predictions only need recalculation when new data is logged -- not on every read.

3. **Third bottleneck: Notification throughput.** SMS and email APIs have rate limits. SSL Wireless allows ~10 SMS/second. At 10K+ profiles with daily reminders, a single worker cannot clear the queue in time. Scale workers horizontally and implement priority queues (urgent medicine alarms > period reminders > content notifications).

---

## Anti-Patterns

### Anti-Pattern 1: Profile ID in JWT Claims

**What people do:** Store the "active profile" in the JWT token to avoid sending profileId with every request.

**Why it's wrong:** The user switches profiles frequently. JWTs are signed and immutable -- you cannot update them without reissuing. This leads to stale profile references, complex refresh logic, and session state leaking into auth tokens.

**Do this instead:** JWT contains only userId and role. The activeProfileId is client-side state (Zustand). Every request sends profileId as a URL parameter. The server verifies ownership on every request. Stateless, simple, correct.

### Anti-Pattern 2: Encrypting Everything

**What people do:** Mark every column in every health table as `/// @encrypted` because "it's a health app."

**Why it's wrong:** Encrypted fields cannot be indexed, searched, sorted, or used in WHERE clauses. Cycle date range queries become impossible. Symptom aggregation queries (for analytics) fail. Performance degrades catastrophically.

**Do this instead:** Encrypt only free-text fields that could contain personally identifiable or embarrassing information (sex life details, medical notes, free-text symptoms). Keep structured data (dates, enums, booleans, integers) unencrypted and queryable.

### Anti-Pattern 3: Separate Admin Application

**What people do:** Build a completely separate React app for the admin panel with its own build, deployment, and auth system.

**Why it's wrong:** At Vesta's scale, a separate admin app doubles deployment complexity, requires duplicate auth logic, and creates a maintenance burden for a team of 1-3 developers. The admin panel needs the same component library, i18n system, and design tokens as the user-facing app.

**Do this instead:** Lazy-load admin pages within the same SPA behind role-based route guards. Admin bundles are only downloaded when an admin navigates to `/admin/*`. This is ~50KB of additional JS that non-admin users never download.

### Anti-Pattern 4: Running Predictions Synchronously

**What people do:** Run all prediction tiers synchronously in the request-response cycle when a user logs a period.

**Why it's wrong:** ARIMA takes ~100ms. LSTM inference takes 1-5 seconds. The user waits for all tiers to complete before seeing any result. If the ML model crashes, the entire period logging request fails.

**Do this instead:** Return Tier 1 (simple average, <10ms) synchronously in the response. Queue Tier 2/3 as BullMQ background jobs. Cache results in Redis. The frontend polls for updated predictions or fetches them on next page load.

### Anti-Pattern 5: Bengali as an Afterthought

**What people do:** Build the entire app in English, then "add translations" at the end.

**Why it's wrong:** Bengali has different text lengths (generally 20-30% longer than English), different numeral systems, different date formats, and complex conjunct characters (juktakshar) that break layouts. Retrofitting i18n into a completed UI requires touching every component.

**Do this instead:** Set up i18next on day one. Use translation keys from the first component. Test every page in both locales during development. Include Bengali web fonts (Noto Sans Bengali) in the initial build.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **SSL Wireless** (Bangladesh SMS) | HTTP API via thin Node.js wrapper in `utils/sms.ts`. Called from BullMQ worker, never from request cycle. | Supports Unicode (Bengali). Rate limit: ~10 SMS/sec. Fallback to Alpha Net BD on failure. BTRC requires Bengali for bulk SMS (English only for OTP/numbers). |
| **Resend** (Transactional email) | SDK (`resend` npm package) called from BullMQ worker. Templates stored as React Email components or inline HTML. | 3,000 emails/month free tier. Welcome, password reset, reminders, partner invites. |
| **AWS S3** (File storage) | SDK v3 (`@aws-sdk/client-s3`). Multer for upload parsing, presigned URLs for secure download. | Ultrasound images, profile photos. SSE-S3 encryption at rest. Region: ap-southeast-1 (Singapore, closest to Bangladesh). Presigned URLs expire in 1 hour. |
| **Sentry** (Error tracking) | `@sentry/node` for API errors, `@sentry/react` for frontend errors. | Critical for health app -- silent failures are unacceptable. Track API 5xx rates, prediction job failures, SMS delivery failures. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Web <-> API** | REST/JSON over HTTPS. JWT in HttpOnly Secure cookie (access token: 15min, refresh: 7 days). | CORS restricted to Vercel domain. No cookie access from JS (HttpOnly). |
| **API <-> Worker** | BullMQ queues via Redis. API enqueues jobs, worker processes them. No direct communication. | Shared codebase (same `packages/api`), different entry points (`server.ts` vs `worker.ts`). Worker imports services directly. |
| **API <-> PostgreSQL** | Prisma Client (type-safe queries). Connection via `DATABASE_URL` env var. | Connection pooling essential beyond ~100 users. Prisma Accelerate or PgBouncer. |
| **API <-> Redis** | `ioredis` client. Used by: BullMQ (jobs), `express-rate-limit` (counters), manual cache (`prediction:{profileId}`). | Single Redis instance for all uses at launch. Separate instances if BullMQ throughput impacts cache latency. |
| **Shared <-> Web/API** | TypeScript imports at build time. No runtime communication. Turborepo ensures shared builds before dependents. | Changes to shared schemas trigger rebuild of both web and api packages. |

---

## Suggested Build Order

Build order is driven by dependency chains. Components later in the list depend on components earlier.

### Phase 1: Foundation (must exist before any feature)

```
1. Monorepo scaffold (pnpm workspace + Turborepo + shared package)
2. Database schema + Prisma setup (User, Profile, core tables)
3. Auth system (registration, login, JWT, refresh tokens)
4. Multi-profile CRUD (create profile, switch profile, ownership middleware)
5. i18n setup (i18next config, English + Bengali namespaces, locale switcher)
6. Frontend shell (layout, sidebar, header, profile switcher, routing)
```

**Rationale:** Everything else is built on top of auth + multi-profile + i18n. These are architecturally invasive -- bolting them on later requires touching every file.

### Phase 2: Core Tracking (the product's reason to exist)

```
7. Period logging (CycleLog CRUD, calendar display)
8. Tier 1 prediction engine (simple average, inline calculation)
9. Cycle calendar (month view, color-coded phases, prediction display)
10. Symptom logging (top 20 symptoms, icon-based UI)
11. Dashboard (cycle day counter, phase display, next period prediction)
12. Onboarding flow (goal selection, data collection, trust screens)
```

**Rationale:** This is the minimum viable product. A user can register, create a profile, log periods, see predictions, and log symptoms. This validates the core product-market fit.

### Phase 3: Notifications + Background Jobs

```
13. BullMQ setup (Redis connection, queue definitions, worker process)
14. Email notifications (Resend integration, period reminders)
15. SMS notifications (SSL Wireless integration, Bengali templates)
16. Notification preferences (per-profile channel selection)
17. Scheduled reminders (daily cron job, prediction-based triggers)
```

**Rationale:** Notifications depend on prediction data (Phase 2) and profiles (Phase 1). BullMQ worker is a separate deployment concern that adds operational complexity -- defer until core tracking works.

### Phase 4: Extended Tracking

```
18. Pregnancy tracking (week-by-week, appointments, ultrasound upload to S3)
19. Medicine tracker (schedule, alarms via BullMQ, pill streak)
20. Sleep + exercise tracking (manual entry, cycle correlation)
21. Sex life tracking (encrypted fields, fertility matching)
22. Menopause/perimenopause mode (mode switch, specific symptoms)
```

**Rationale:** These features share the same per-profile data model and middleware infrastructure from Phases 1-2. They add new data types but not new architectural patterns.

### Phase 5: Analytics + Partner + Content

```
23. Health analytics dashboard (Recharts: cycle trends, symptom patterns)
24. Partner sharing (share code, partner access, read-only view)
25. Content platform (articles, videos, CMS, phase-based recommendations)
26. PDF health report export (doctor's report)
```

**Rationale:** Analytics require accumulated data (useless at launch). Partner sharing requires the cycle data to exist. Content requires a CMS infrastructure. These are engagement and retention features, not acquisition features.

### Phase 6: Admin Panel

```
27. Admin dashboard (user metrics, activity stats)
28. User management (list, suspend, delete)
29. Content CMS (create/edit articles, manage categories, bilingual)
30. Prediction accuracy reports (predicted vs actual, per-tier)
31. Notification management (delivery logs, broadcast, emergency alerts)
32. Data export (CSV/Excel for analytics)
```

**Rationale:** Admin panel requires all user-facing features to exist first (cannot manage what does not exist). However, the client has specified admin in Phase 1 scope, so basic admin (user list + dashboard) should be prioritized earlier. Full admin with CMS and prediction reports follows.

### Phase 7: Advanced Prediction (Tier 2 + 3)

```
33. Tier 2: ARIMA prediction (arima npm package, auto-escalation at 6 cycles)
34. Tier 3: LSTM prediction (TensorFlow.js, multi-factor model, training pipeline)
35. Prediction accuracy tracking (admin dashboard: predicted vs actual)
36. Auto-tier escalation (factory pattern, data-point-based promotion)
```

**Rationale:** Higher prediction tiers need real user data to be meaningful. LSTM (Tier 3) specifically needs 12+ cycles per profile -- data that takes months to accumulate post-launch. Building Tier 3 before users exist is wasted effort.

### Build Order Dependency Graph

```
Phase 1 (Foundation)
    │
    ├──> Phase 2 (Core Tracking) ──> Phase 3 (Notifications)
    │                                     │
    │                                     ▼
    │                               Phase 4 (Extended Tracking)
    │                                     │
    │                                     ▼
    │                               Phase 5 (Analytics + Partner + Content)
    │                                     │
    │                                     ▼
    │                               Phase 7 (Advanced Prediction)
    │
    └──> Phase 6 (Admin Panel) -- can start after Phase 2, parallel with Phases 3-5
```

**Key insight:** Phase 6 (Admin Panel) can be built in parallel with Phases 3-5 because it primarily reads data that Phase 2 creates. Basic admin (user list, dashboard stats) can start as soon as Phase 2 completes. Full admin (CMS, prediction reports) needs Phases 5 and 7.

---

## Sources

### Verified (HIGH confidence)
- [Architecting Secure Multi-Tenant PostgreSQL (HealthTech)](https://www.wellally.tech/blog/postgres-multi-tenant-database-row-level-security) -- RLS patterns for health data isolation
- [Crunchy Data: Designing Postgres for Multi-Tenancy](https://www.crunchydata.com/blog/designing-your-postgres-database-for-multi-tenancy) -- Shared schema vs schema-per-tenant tradeoffs
- [Prisma + Row-Level Security](https://atlasgo.io/guides/orms/prisma/row-level-security) -- RLS integration with Prisma ORM
- [BullMQ Documentation](https://bullmq.io/) -- v5.71, job scheduling, worker patterns
- [BullMQ Background Jobs 2026 Guide](https://1xapi.com/blog/bullmq-5-background-job-queues-nodejs-2026-guide) -- Current best practices
- [Express.js Architecture Patterns](https://treblle.com/blog/egergr) -- Three-layer architecture for REST APIs
- [Turborepo + Vite + React Monorepo](https://dev.to/ashishxcode/turborepo-vite-with-react-monorepo-part-1-3f15) -- Monorepo setup patterns
- [Predictive Modeling of Menstrual Cycle Length (arXiv)](https://arxiv.org/abs/2308.07927) -- ARIMA/LSTM comparison for cycle prediction
- [Flo Health Comprehensive Product Research](/Volumes/KingstonFURYRenegade/Github/React/cycle-circle/docs/flo-health-comprehensive-guide%20.md) -- Flo architecture and feature analysis (local)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html) -- helmet + cors + rate-limit baseline
- [prisma-field-encryption](https://github.com/47ng/prisma-field-encryption) -- AES-256-GCM transparent field encryption

### Community-verified (MEDIUM confidence)
- [Multi-Tenant RLS with Prisma (Medium)](https://medium.com/@francolabuschagne90/securing-multi-tenant-applications-using-row-level-security-in-postgresql-with-prisma-orm-4237f4d4bd35) -- Practical RLS + Prisma integration
- [Sharing Types in pnpm Monorepo](https://dev.to/lico/step-by-step-guide-sharing-types-and-values-between-react-esm-and-nestjs-cjs-in-a-pnpm-monorepo-2o2j) -- Shared Zod schemas between frontend/backend
- [RBAC in React SPA](https://medium.com/@ignatovich.dm/implementing-role-based-access-control-rbac-in-node-js-and-react-c3d89af6f945) -- Role-based routing in same SPA
- [Women's Health App Development Guide](https://topflightapps.com/ideas/how-to-make-women-health-tracking-app/) -- Health app feature architecture

---
*Architecture research for: Vesta -- Reproductive Health & Cycle Intelligence Platform*
*Researched: 2026-03-26*
