# Phase 1: Foundation, Auth, and Multi-Profile System - Research

**Researched:** 2026-03-26
**Domain:** Authentication, Multi-Profile Architecture, Bilingual i18n, Field-Level Encryption, Monorepo Setup
**Confidence:** HIGH

## Summary

Phase 1 establishes the entire foundation that every subsequent feature inherits. It requires converting the current single-package prototype into a pnpm + Turborepo monorepo with three packages (web, api, shared), building a custom Express 5 + Prisma backend with PostgreSQL, implementing JWT authentication with HttpOnly cookie refresh tokens, constructing the multi-profile tenant isolation model (the defining architectural characteristic of Vesta), setting up bilingual i18n infrastructure (English + Bengali from day one), implementing field-level encryption for health data, and delivering a complete onboarding flow that generates a first cycle prediction.

The most critical architectural element is the multi-profile ownership model: every health data query is scoped through a `profileId`, not a `userId`. This requires a mandatory `checkProfileOwnership` middleware on every profile-scoped route. Getting this wrong in Phase 1 means retrofitting authorization checks across every endpoint built in future phases. The second critical element is the Prisma version pin: `prisma-field-encryption` officially supports Prisma up to 6.13.0. While the peer dependency says `>= 4.7` and v1.6.1-beta exists (January 2026), the README ceiling at 6.13.0 means Prisma must be pinned to 6.13.0 and validated before any higher version is used. The third critical element is that Bengali is not a translation afterthought -- font loading, string length accommodation (Bengali text is 20-40% longer), and locale-aware date/number formatting must be built into every component from the start.

**Primary recommendation:** Build the monorepo structure, database schema with encryption, auth system, and multi-profile middleware first. Then build the i18n infrastructure and onboarding flow. Test encryption compatibility in an integration test before writing any production data.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can create account with email and password | Express 5 + Argon2id hashing + Prisma User model + Zod validation |
| AUTH-02 | User receives email verification after signup | Resend transactional email + verification token stored in DB |
| AUTH-03 | User can reset password via email link | Resend email + time-limited reset token + password update endpoint |
| AUTH-04 | User session persists across browser refresh (JWT) | JWT access token (15min) + refresh token in HttpOnly cookie (7 days) + token rotation |
| AUTH-05 | User can create multiple health profiles with relation types | Profile model with userId FK, relation enum, onboarding fields (DOB, height, weight, cycle length, last period) |
| AUTH-06 | User can switch between profiles via profile switcher UI | Zustand profileStore.activeProfileId + TanStack Query cache invalidation on switch |
| AUTH-07 | All health data scoped to individual profiles | checkProfileOwnership middleware + profileId in all query keys + profile-scoped URL pattern |
| AUTH-08 | User can edit or delete any profile they manage | CRUD endpoints under /profiles/:profileId with ownership verification + cascade delete |
| ONBD-01 | New user sees trust/privacy screens before entering personal data | Onboarding wizard component with trust screen as first step (Zustand onboardingStore) |
| ONBD-02 | User selects primary health goal | Goal selection step in onboarding (track period / try to conceive enum) |
| ONBD-03 | User enters cycle history | Onboarding step for last period date, cycle length estimate, period duration |
| ONBD-04 | User enters personal data | Onboarding step for DOB, height, weight with Zod shared schema validation |
| ONBD-05 | App generates first prediction after onboarding | Tier 1 prediction (simple average) using onboarding data, no prior logs needed |
| ONBD-06 | Onboarding flow supports English and Bengali | i18next namespace for onboarding, Noto Sans Bengali font, tested in both locales |
| I18N-01 | Every UI string translatable between English and Bengali | i18next + react-i18next with JSON namespace files, typed keys from shared package |
| I18N-02 | User can switch language at any time | Language switcher component + Zustand locale state + i18next.changeLanguage() |
| I18N-03 | Date and number formatting adapts to selected language | date-fns bn locale + Intl.NumberFormat('bn-BD') for Bengali numerals |
| I18N-04 | Bengali is the default for Bangladesh-based users | i18next-browser-languagedetector with navigator.language fallback to 'bn' |
| PRIV-01 | Health data encrypted at field level in database | prisma-field-encryption with AES-256-GCM, pinned to Prisma 6.13.0, integration test |
| PRIV-02 | User can delete account and all associated data | Cascade delete: User -> Profiles -> all profile-scoped data, hard delete endpoint |
| PRIV-03 | Clear privacy policy for multi-profile data handling | Static privacy policy page in both languages, served from content |
| PRIV-04 | Terms of service in English and Bengali | Static ToS page with i18n, presented during onboarding |
| PRIV-05 | Multi-profile consent mechanism | Consent acknowledgment during profile creation for managing another person's health data |
</phase_requirements>

## Standard Stack

### Core Backend (Phase 1 Specific)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express.js | 5.2.1 | HTTP framework | Promise-based error handling (no asyncHandler wrapper needed), ReDoS-safe routing |
| Prisma ORM | 6.13.0 (PINNED) | Database toolkit | Last version verified compatible with prisma-field-encryption. Do NOT bump without encryption integration test |
| @prisma/client | 6.13.0 (PINNED) | Generated client | Must match Prisma CLI version exactly |
| prisma-field-encryption | 1.6.0 | Field-level encryption | AES-256-GCM transparent encryption via Prisma client extensions |
| PostgreSQL | 16 | Primary database | Relational model fits multi-profile health data. DATE type for cycle dates |
| jsonwebtoken | 9.0.3 | JWT tokens | Access tokens (15min) + refresh tokens (7 days, HttpOnly cookie) |
| argon2 | 0.44.0 | Password hashing | OWASP-recommended Argon2id. Memory-hard, GPU-resistant |
| helmet | 8.1.0 | HTTP security headers | HSTS, CSP, X-Frame-Options. First middleware in chain |
| cors | 2.8.6 | CORS policy | Whitelist Vercel frontend domains. credentials: true for HttpOnly cookies |
| express-rate-limit | 8.3.1 | Rate limiting | 5 req/15min for login, 100 req/min for API |
| cookie-parser | 1.4.7 | Cookie handling | Parse HttpOnly refresh token cookies |
| zod | 4.3.6 | Request validation | Shared with frontend. Validate bodies, query params, route params |
| pino | 10.3.1 | Structured logging | JSON logger for Express. Use pino-http 11.0.0 for request logging |
| pino-http | 11.0.0 | Request logging | Automatic request/response logging middleware |
| Resend | SDK | Transactional email | Email verification, password reset. 3,000 emails/month free |

### Core Frontend (Phase 1 Specific)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.x | UI framework | Already in project |
| Vite | 6.x | Build tool | Already in project. LTS line |
| TypeScript | ~5.8 | Type safety | Already in project |
| Tailwind CSS | 4.x | Styling | Already in project. CSS-first config |
| React Router | 7.x | Routing | Already in project. Use lazy() for code splitting |
| TanStack Query | 5.95.2 | Server state | API data fetching, caching, background refetch, cache invalidation |
| Zustand | 5.0.12 | Client state | activeProfileId, locale, UI toggles, onboarding wizard state |
| React Hook Form | 7.72.0 | Form management | Onboarding wizard, profile creation, auth forms |
| @hookform/resolvers | 5.2.2 | Zod integration | zodResolver connects React Hook Form to shared Zod schemas |
| i18next | 25.10.10 | i18n core | JSON translation files, namespace support, interpolation |
| react-i18next | 16.6.6 | React bindings | useTranslation hook, Trans component |
| i18next-browser-languagedetector | 8.2.1 | Language detection | Auto-detect Bengali from navigator.language |
| date-fns | 4.1.x | Date utilities | Already in project. Bengali (bn) locale for date formatting |
| @fontsource/noto-sans-bengali | 5.2.11 | Bengali font | Self-hosted Noto Sans Bengali. Avoids Google Fonts external request |
| shadcn/ui (CLI) | 4.1.0 | Component library | Copy-paste components. Init for Tailwind v4 + React 19 |
| Sonner | 2.0.7 | Toast notifications | shadcn/ui recommended toast solution |
| clsx | 2.x | Conditional classes | Already in project |
| tailwind-merge | 3.x | Class deduplication | Already in project |
| lucide-react | 0.546.x | Icons | Already in project |

### Monorepo Infrastructure

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pnpm | 10.x | Package manager | Strict dependency resolution, disk-efficient monorepo support |
| Turborepo | 2.8.20 | Build orchestration | Cached builds, parallel task execution, dependency-aware build order |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prisma 6.13.0 | Prisma 6.19.2 or 7.5.0 | Higher Prisma versions offer better performance but prisma-field-encryption README caps at 6.13.0. Risk: encryption breaks silently in production |
| prisma-field-encryption | Custom application-level encryption | Full control, no version coupling. But 2-3x more code and must handle encrypt/decrypt in every service method. Reserve as fallback |
| Argon2id | bcrypt | bcrypt is battle-tested but not memory-hard. Argon2id is OWASP 2025+ recommendation for new projects |
| Zustand | Context API | Context causes unnecessary re-renders. Zustand is 1KB with zero boilerplate. Worth it for profileStore |
| @fontsource/noto-sans-bengali | Google Fonts CDN | Self-hosted avoids external data flow (privacy concern for health app). No GDPR/privacy policy conflict |

**Installation (packages/api):**
```bash
pnpm add express cors helmet cookie-parser express-rate-limit
pnpm add @prisma/client prisma-field-encryption
pnpm add jsonwebtoken argon2
pnpm add zod
pnpm add pino pino-http
pnpm add resend
pnpm add ioredis  # For rate-limit Redis store (Phase 3 BullMQ prep)
pnpm add -D typescript tsx prisma @types/express @types/jsonwebtoken @types/cors @types/cookie-parser
```

**Installation (packages/web):**
```bash
pnpm add react react-dom react-router-dom
pnpm add @tanstack/react-query zustand
pnpm add react-hook-form @hookform/resolvers zod
pnpm add i18next react-i18next i18next-browser-languagedetector
pnpm add date-fns @fontsource/noto-sans-bengali
pnpm add sonner
pnpm add clsx tailwind-merge lucide-react motion
pnpm add -D typescript vite @vitejs/plugin-react @tailwindcss/vite tailwindcss
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
# shadcn/ui initialization
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card dialog input label select tabs avatar dropdown-menu
```

**Installation (packages/shared):**
```bash
pnpm add zod
pnpm add -D typescript
```

## Architecture Patterns

### Recommended Project Structure (Phase 1 deliverable)

```
vesta/
├── packages/
│   ├── web/                          # React + Vite + Tailwind frontend
│   │   ├── src/
│   │   │   ├── app/                  # App shell, providers, router
│   │   │   │   ├── App.tsx
│   │   │   │   ├── router.tsx
│   │   │   │   └── providers.tsx     # QueryClient, i18n, Zustand
│   │   │   ├── components/
│   │   │   │   ├── ui/              # shadcn/ui base components
│   │   │   │   ├── layout/          # Shell, Header, ProfileSwitcher
│   │   │   │   └── features/
│   │   │   │       └── onboarding/  # TrustScreen, GoalSelector, CycleHistory, PersonalData
│   │   │   ├── pages/
│   │   │   │   ├── auth/            # Login, Register, ForgotPassword, VerifyEmail
│   │   │   │   ├── onboarding/      # Onboarding wizard page
│   │   │   │   ├── dashboard/       # Placeholder dashboard (first prediction display)
│   │   │   │   └── settings/        # Profile management, language toggle
│   │   │   ├── hooks/
│   │   │   │   ├── useActiveProfile.ts
│   │   │   │   ├── useProfileQuery.ts  # Wraps useQuery with profileId in key
│   │   │   │   └── useLocale.ts
│   │   │   ├── stores/
│   │   │   │   ├── profileStore.ts  # activeProfileId, profiles list
│   │   │   │   ├── uiStore.ts       # sidebar, locale
│   │   │   │   └── onboardingStore.ts
│   │   │   ├── api/                 # TanStack Query hooks
│   │   │   │   ├── client.ts        # fetch wrapper with JWT refresh interceptor
│   │   │   │   ├── auth.ts          # useLogin, useRegister, useRefreshToken
│   │   │   │   └── profiles.ts      # useProfiles, useCreateProfile, useUpdateProfile
│   │   │   ├── i18n/
│   │   │   │   ├── config.ts        # i18next initialization
│   │   │   │   ├── en/
│   │   │   │   │   ├── common.json
│   │   │   │   │   ├── auth.json
│   │   │   │   │   ├── onboarding.json
│   │   │   │   │   └── privacy.json
│   │   │   │   └── bn/              # Bengali (same structure)
│   │   │   └── lib/
│   │   │       ├── cn.ts            # clsx + tailwind-merge
│   │   │       ├── dates.ts         # date-fns with bn locale
│   │   │       └── format.ts        # Number formatting (Bengali/English)
│   │   └── vite.config.ts
│   │
│   ├── api/                          # Express 5 backend
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── auth.routes.ts
│   │   │   │   └── profile.routes.ts
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts           # verifyJWT, requireRole
│   │   │   │   ├── profileOwnership.ts  # checkProfileOwnership (CRITICAL)
│   │   │   │   ├── validate.ts       # validateBody(zodSchema)
│   │   │   │   ├── rateLimiter.ts
│   │   │   │   ├── errorHandler.ts   # Central error handler (Express 5 async)
│   │   │   │   └── requestLogger.ts
│   │   │   ├── services/
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── profile.service.ts
│   │   │   │   └── prediction.service.ts  # Tier 1 only for ONBD-05
│   │   │   ├── config/
│   │   │   │   ├── env.ts            # Zod-validated env vars
│   │   │   │   └── database.ts       # Prisma client with field-encryption extension
│   │   │   └── utils/
│   │   │       ├── email.ts          # Resend wrapper
│   │   │       └── logger.ts         # Pino config
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   └── server.ts
│   │
│   └── shared/                       # Shared between web + api
│       ├── src/
│       │   ├── schemas/
│       │   │   ├── auth.ts           # loginSchema, registerSchema
│       │   │   └── profile.ts        # createProfileSchema, updateProfileSchema
│       │   ├── types/
│       │   │   ├── user.ts
│       │   │   ├── profile.ts
│       │   │   └── api.ts            # API response envelope
│       │   ├── constants/
│       │   │   ├── relations.ts      # RelationType enum
│       │   │   └── roles.ts          # UserRole enum
│       │   └── i18n-keys/
│       │       └── index.ts          # Type-safe translation key constants
│       └── tsconfig.json
│
├── pnpm-workspace.yaml
├── turbo.json
├── docker-compose.yml                # Local dev: PostgreSQL + Redis
└── .env.example
```

### Pattern 1: Multi-Profile Tenant Isolation (CRITICAL - Phase 1 Foundation)

**What:** One user account owns multiple health profiles. Every data record belongs to a profile, not a user. Every API endpoint that touches health data passes through mandatory ownership verification.

**When to use:** Every profile-scoped API endpoint. No exceptions.

**Implementation:**

```typescript
// middleware/profileOwnership.ts
import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/database";

export async function checkProfileOwnership(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { profileId } = req.params;
  const userId = req.user!.id; // Set by verifyJWT middleware

  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId },
  });

  if (!profile) {
    return res.status(403).json({ error: "Profile access denied" });
  }

  req.profile = profile; // Attach for downstream handlers
  next();
}

// Usage in routes:
router.use(
  "/profiles/:profileId",
  verifyJWT,
  checkProfileOwnership
);
```

**URL pattern:** All profile-scoped routes nest under `/profiles/:profileId/`:
```
GET    /api/profiles                    # List user's profiles
POST   /api/profiles                    # Create new profile
GET    /api/profiles/:profileId         # Get profile details
PUT    /api/profiles/:profileId         # Update profile
DELETE /api/profiles/:profileId         # Delete profile (cascade)
```

### Pattern 2: JWT Auth with HttpOnly Cookie Refresh Tokens

**What:** Short-lived access token (15min) returned in JSON response body. Long-lived refresh token (7 days) stored in HttpOnly Secure SameSite=Strict cookie. Token rotation on refresh.

**When to use:** All authenticated endpoints.

**Implementation:**

```typescript
// Token creation
const accessToken = jwt.sign(
  { userId: user.id, role: user.role },
  process.env.JWT_ACCESS_SECRET!,
  { expiresIn: "15m" }
);

const refreshToken = jwt.sign(
  { userId: user.id, tokenVersion: user.tokenVersion },
  process.env.JWT_REFRESH_SECRET!,
  { expiresIn: "7d" }
);

// Set refresh token as HttpOnly cookie
res.cookie("refreshToken", refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/api/auth/refresh", // Only sent to refresh endpoint
});

// Return access token in body
res.json({ accessToken, user: { id: user.id, email: user.email } });
```

**Frontend refresh mutex pattern (prevents race condition -- Pitfall 16):**
```typescript
// api/client.ts
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise; // All concurrent 401s wait on same promise

  refreshPromise = fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include", // Send HttpOnly cookie
  })
    .then((res) => res.json())
    .then((data) => data.accessToken)
    .finally(() => { refreshPromise = null; });

  return refreshPromise;
}
```

### Pattern 3: Shared Zod Schema Validation

**What:** Define Zod schemas once in `packages/shared`. Frontend uses them with React Hook Form (`zodResolver`). Backend uses them in Express validation middleware. Both validate identically.

**When to use:** Every form submission and API endpoint.

```typescript
// packages/shared/src/schemas/profile.ts
import { z } from "zod";

export const relationTypeEnum = z.enum([
  "self", "wife", "sister", "mother", "daughter", "girlfriend"
]);

export const createProfileSchema = z.object({
  name: z.string().min(1).max(100),
  relationType: relationTypeEnum,
  dateOfBirth: z.string().date(), // YYYY-MM-DD format
  height: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  cycleLength: z.number().int().min(18).max(45).default(28),
  periodLength: z.number().int().min(2).max(10).default(5),
  lastPeriodDate: z.string().date().optional(),
  goalType: z.enum(["track_period", "try_to_conceive"]).default("track_period"),
});

// Frontend: useForm({ resolver: zodResolver(createProfileSchema) })
// Backend:  router.post("/profiles", validateBody(createProfileSchema), handler)
```

### Pattern 4: Profile-Aware TanStack Query Cache

**What:** Every query key includes `profileId`. On profile switch, invalidate all profile-scoped caches.

```typescript
// hooks/useProfileQuery.ts
import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { useProfileStore } from "../stores/profileStore";

export function useProfileQuery<T>(
  key: string[],
  queryFn: (profileId: string) => Promise<T>,
  options?: Omit<UseQueryOptions<T>, "queryKey" | "queryFn">
) {
  const activeProfileId = useProfileStore((s) => s.activeProfileId);

  return useQuery({
    queryKey: [...key, activeProfileId],
    queryFn: () => queryFn(activeProfileId!),
    enabled: !!activeProfileId,
    ...options,
  });
}

// On profile switch:
function switchProfile(newProfileId: string) {
  profileStore.getState().setActiveProfile(newProfileId);
  queryClient.invalidateQueries(); // Nuclear option: invalidate everything
  // Or selective: queryClient.removeQueries({ predicate: (q) => q.queryKey.includes(oldProfileId) });
}
```

### Pattern 5: i18n Namespace Organization

**What:** Translation files organized by feature namespace. Each namespace is a separate JSON file loaded on demand.

```typescript
// i18n/config.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./en/common.json";
import enAuth from "./en/auth.json";
import enOnboarding from "./en/onboarding.json";
import bnCommon from "./bn/common.json";
import bnAuth from "./bn/auth.json";
import bnOnboarding from "./bn/onboarding.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: enCommon, auth: enAuth, onboarding: enOnboarding },
      bn: { common: bnCommon, auth: bnAuth, onboarding: bnOnboarding },
    },
    defaultNS: "common",
    fallbackLng: "en",
    detection: {
      order: ["navigator", "htmlTag"],
      // Bengali users in Bangladesh will get 'bn' from navigator.language
    },
    interpolation: { escapeValue: false },
  });
```

### Anti-Patterns to Avoid

- **Profile ID in JWT claims:** JWT contains only userId and role. activeProfileId is client-side state (Zustand). Every request sends profileId as URL parameter. Server verifies ownership on every request.
- **Encrypting everything:** Only encrypt free-text fields (notes, personal details). Keep dates, enums, booleans, integers unencrypted and queryable.
- **Hardcoding English strings:** Every string must go through i18n from day one. Bengali text is 20-40% longer than English -- use flexible layouts, never fixed-width containers.
- **Storing cycle dates as TIMESTAMP:** Use DATE type in PostgreSQL. Send dates as `YYYY-MM-DD` from frontend. Never use `new Date().toISOString()` for date-only fields.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom bcrypt/scrypt wrapper | argon2 (0.44.0) with Argon2id | OWASP-recommended, memory-hard. Config: 19MiB memory, 2 iterations, 1 parallelism |
| JWT token management | Custom token parsing/signing | jsonwebtoken (9.0.3) | Battle-tested, handles edge cases (clock skew, algorithm confusion attacks) |
| Request validation | Manual if/else field checking | Zod schemas in shared package | Type-safe, composable, shared between frontend and backend |
| Form state management | useState per field + manual validation | React Hook Form + zodResolver | Uncontrolled components = minimal re-renders. Critical for onboarding wizard |
| HTTP security headers | Manual header setting | helmet (8.1.0) | HSTS, CSP, X-Frame-Options in one middleware. Covers edge cases you will forget |
| Rate limiting | Custom counter middleware | express-rate-limit (8.3.1) | Redis store for distributed deployment, sliding window, customizable per-route |
| Translation management | Custom context + string maps | i18next + react-i18next | Namespace support, interpolation, pluralization, language detection, Bengali locale |
| Date formatting (Bengali) | Manual string manipulation | date-fns with bn locale | Handles complex Bengali date names, ordinals, relative time |
| Bengali numeral conversion | Custom digit mapping function | Intl.NumberFormat('bn-BD') | Browser-native, handles grouping separators, decimal formatting |
| Field-level encryption | Custom AES wrappers in service layer | prisma-field-encryption (1.6.0) | Transparent encryption via Prisma client extensions. Handles key rotation, hashing |
| Bengali web font | Google Fonts CDN link | @fontsource/noto-sans-bengali (5.2.11) | Self-hosted, no external requests (privacy), optimized subsets |
| Structured logging | console.log | pino (10.3.1) + pino-http (11.0.0) | JSON structured output, 5x faster than Winston, request correlation |

**Key insight:** Phase 1 has zero business logic complexity (no cycle calculations, no prediction algorithms). The entire challenge is infrastructure correctness: auth security, data isolation, encryption integrity, and bilingual rendering. Every item above handles an infrastructure concern where custom code introduces security or correctness bugs.

## Common Pitfalls

### Pitfall 1: Multi-Profile Authorization Bypass (CRITICAL)
**What goes wrong:** User accesses another user's profiles by manipulating profileId in API requests. Horizontal privilege escalation exposes intimate health data of unrelated users.
**Why it happens:** Standard auth tutorials assume 1 user = 1 data scope. Developers build JWT auth but forget profile ownership checks on every route.
**How to avoid:** Mandatory `checkProfileOwnership` middleware on EVERY profile-scoped route. Never trust profileId from client without server-side verification. Write security tests that attempt cross-user profile access and verify 403.
**Warning signs:** No middleware between JWT verification and data access. No 403 test cases.

### Pitfall 2: Prisma Version Lock (CRITICAL)
**What goes wrong:** Upgrading Prisma beyond 6.13.0 breaks prisma-field-encryption. Encrypted data becomes inaccessible or stored unencrypted.
**Why it happens:** Prisma 6.14.0 removed middleware support. The extension may still work via client extensions, but the README caps compatibility at 6.13.0.
**How to avoid:** Pin Prisma to exactly 6.13.0. Write an integration test that encrypts, stores, retrieves, and decrypts a test record. Run this test in CI. NEVER upgrade Prisma without running this test first. Add a comment in package.json explaining the pin.
**Warning signs:** `prisma generate` warnings about incompatible extensions. Encrypted fields returning Base64 ciphertext instead of plaintext.

### Pitfall 3: Bengali Text as Afterthought
**What goes wrong:** UI designed for English string lengths breaks when Bengali text is 20-40% longer. Dates show "March 2026" instead of Bengali. Bengali font not loaded.
**Why it happens:** Developers test in English and add Bengali "later."
**How to avoid:** Load Noto Sans Bengali font in Phase 1. Test EVERY page in Bengali mode during development. Decide on Bengali vs Western numerals early (most Bangladeshi apps use Western digits even in Bengali text -- confirm with client).
**Warning signs:** Bengali font not loaded. No bn/ translation directory. Date fields ignore locale.

### Pitfall 4: JWT Refresh Token Race Condition
**What goes wrong:** Multiple concurrent API calls with expired access token all try to refresh simultaneously. Multiple new refresh tokens created, valid one invalidated. User randomly logged out.
**How to avoid:** Implement token refresh mutex in API client. First 401 triggers refresh; all other pending requests wait on same promise.
**Warning signs:** Users report random logouts on pages with multiple API calls. Refresh endpoint receives multiple calls within milliseconds.

### Pitfall 5: CORS Misconfiguration (Vercel + Railway Split)
**What goes wrong:** Frontend on Vercel cannot reach API on Railway. Or CORS set to `*` in production.
**How to avoid:** Whitelist exact Vercel domains. Include Vercel preview pattern `https://vesta-*.vercel.app`. Use `credentials: true` with explicit origin (not `*`). Test with curl from unauthorized origin.
**Warning signs:** `cors({ origin: "*" })` in production. Browser CORS errors. HttpOnly cookies not sent.

### Pitfall 6: Encrypted Field Query Limitations
**What goes wrong:** Developer adds WHERE clause on encrypted field. Returns nothing because AES-256-GCM is non-deterministic.
**How to avoid:** Document which fields are encrypted and what queries are impossible. Create a team reference: "You CANNOT search, filter, sort, or aggregate encrypted fields." Use companion hash fields for exact-match lookups only.
**Warning signs:** API returns empty results when data exists. Search works in dev (encryption disabled) but fails in production.

### Pitfall 7: i18n Key Typos and Missing Translations
**What goes wrong:** Translation key in code does not match JSON file. English shows raw key string. Bengali page completely broken.
**How to avoid:** Use typed i18n keys from shared package. Set i18next `debug: true` and `saveMissing: true` in development. CI lint step to validate all keys exist in both EN and BN JSON files.
**Warning signs:** Raw key strings visible in UI. Bengali JSON significantly shorter than English JSON.

## Code Examples

### Express 5 Server Bootstrap (Phase 1)

```typescript
// packages/api/src/server.ts
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { logger } from "./utils/logger";
import { env } from "./config/env";
import { authRoutes } from "./routes/auth.routes";
import { profileRoutes } from "./routes/profile.routes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

// Security middleware (order matters)
app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGINS, // string[] from env
  credentials: true,        // Required for HttpOnly cookies
}));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(pinoHttp({ logger }));

// Rate limiting
app.use("/api/auth", rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,                     // 20 requests per window for auth
  standardHeaders: "draft-8",
  legacyHeaders: false,
}));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profiles", profileRoutes);

// Express 5: async errors automatically caught
app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "Server started");
});
```

### Prisma Schema (Phase 1 Core Models)

```prisma
// packages/api/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  USER
  ADMIN
  SUPER_ADMIN
}

enum RelationType {
  SELF
  WIFE
  SISTER
  MOTHER
  DAUGHTER
  GIRLFRIEND
}

enum GoalType {
  TRACK_PERIOD
  TRY_TO_CONCEIVE
}

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String
  role          UserRole  @default(USER)
  locale        String    @default("bn")  // Bengali default
  isVerified    Boolean   @default(false)
  tokenVersion  Int       @default(0)     // For refresh token rotation

  profiles      Profile[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Profile {
  id            String       @id @default(uuid())
  userId        String
  user          User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  name          String
  relationType  RelationType
  dateOfBirth   DateTime?    @db.Date     // DATE type, not TIMESTAMP
  goalType      GoalType     @default(TRACK_PERIOD)
  cycleLength   Int          @default(28)
  periodLength  Int          @default(5)
  lastPeriodDate DateTime?   @db.Date
  height        Float?
  weight        Float?

  /// @encrypted
  personalNotes String?      // Encrypted: free-text personal notes

  consentGiven  Boolean      @default(false)  // Multi-profile consent (PRIV-05)
  isActive      Boolean      @default(true)

  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@index([userId])
}

model VerificationToken {
  id        String   @id @default(uuid())
  userId    String
  token     String   @unique
  type      String   // "email_verification" | "password_reset"
  expiresAt DateTime
  usedAt    DateTime?

  createdAt DateTime @default(now())

  @@index([token])
  @@index([userId])
}
```

### Prisma Client with Field Encryption

```typescript
// packages/api/src/config/database.ts
import { PrismaClient } from "@prisma/client";
import { fieldEncryptionExtension } from "prisma-field-encryption";
import { env } from "./env";

const basePrisma = new PrismaClient({
  log: env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
});

export const prisma = basePrisma.$extends(
  fieldEncryptionExtension({
    encryptionKey: env.FIELD_ENCRYPTION_KEY,
    // AES-256-GCM with random IV (non-deterministic)
  })
);
```

### Bengali Date/Number Formatting

```typescript
// packages/web/src/lib/format.ts
import { format as dateFnsFormat } from "date-fns";
import { bn } from "date-fns/locale";
import { enUS } from "date-fns/locale";

const localeMap = { en: enUS, bn: bn };

export function formatDate(date: Date | string, formatStr: string, locale: "en" | "bn"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return dateFnsFormat(d, formatStr, { locale: localeMap[locale] });
}

export function formatNumber(num: number, locale: "en" | "bn"): string {
  // Most Bangladeshi apps use Western digits even in Bengali UI
  // Use 'bn-BD' for Bengali digits, 'en-BD' for Western digits with Bengali text
  return new Intl.NumberFormat(locale === "bn" ? "en-BD" : "en-US").format(num);
}
```

### Environment Validation with Zod

```typescript
// packages/api/src/config/env.ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  FIELD_ENCRYPTION_KEY: z.string().min(32),
  CORS_ORIGINS: z.string().transform((s) => s.split(",")),
  RESEND_API_KEY: z.string().optional(),
  REDIS_URL: z.string().url().optional(),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Express 4 with asyncHandler wrappers | Express 5 native Promise error handling | Express 5.0 (Sept 2024), stable 5.2.1 | Remove all try-catch wrappers and asyncHandler utilities |
| bcrypt for password hashing | Argon2id (OWASP recommended) | OWASP 2024+ guidelines | Memory-hard, GPU-resistant. New projects should default to Argon2id |
| Prisma middleware for encryption | Prisma client extensions | Prisma 4.16+ (GA extensions) | Extensions are the supported pattern. Middleware deprecated in 6.14 |
| tailwind.config.js | @theme directive in CSS (Tailwind v4) | Tailwind v4 (Jan 2025) | No JS config file. CSS-first configuration with OKLCH colors |
| i18next-http-backend (lazy load) | Static imports for small apps | Current best practice | For 2 languages, static import is simpler and avoids loading flashes |
| Manual CORS origin lists | Vercel preview URL pattern matching | Vercel standard practice | `CORS_ORIGINS=https://vesta.vercel.app,https://vesta-*.vercel.app` |

**Deprecated/outdated:**
- Express 4 `asyncHandler()` wrapper: no longer needed in Express 5
- Prisma middleware API: removed in Prisma 6.14.0, use client extensions
- `tailwind.config.js`: Tailwind v4 uses CSS-based @theme directive
- `bcrypt`: Still works but Argon2id is the modern standard for new projects

## Open Questions

1. **Prisma 6.13.0 vs 6.19.x with prisma-field-encryption**
   - What we know: README says 6.13.0 ceiling. Peer dep says `>= 4.7`. Beta 1.6.1 exists (Jan 2026) that normalizes Prisma client output paths.
   - What's unclear: Whether v1.6.0 actually works with Prisma 6.19.x via client extensions (since it does NOT use middleware anymore).
   - Recommendation: Pin to 6.13.0 for Phase 1. Create a separate branch to test 6.19.x compatibility with the encryption integration test. If it passes, consider upgrading. This is a 2-hour validation task.

2. **Bengali numeral display preference**
   - What we know: Bengali digits exist. Most Bangladeshi apps (bKash, Pathao, Grameenphone) use Western digits even in Bengali UI.
   - What's unclear: Client preference for digit style.
   - Recommendation: Default to Western digits with Bengali text (matches market convention). Make it configurable.

3. **Email verification flow UX**
   - What we know: AUTH-02 requires email verification. Resend API handles delivery.
   - What's unclear: Whether to block access until verified or allow limited access. Whether to use magic link or 6-digit code.
   - Recommendation: Allow limited access (can browse but not create profiles). Use magic link (click to verify) as it's simpler for Bangladesh market where email usage patterns lean toward link-based.

4. **Monorepo migration strategy**
   - What we know: Current project is a single-package React prototype with package.json at root.
   - What's unclear: Whether to migrate existing code or start fresh in monorepo.
   - Recommendation: Start fresh monorepo. Current code is a prototype with no backend. Copy useful components (Layout, some pages) but restructure everything.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | None -- Wave 0 gap |
| Quick run command | `pnpm --filter api test` |
| Full suite command | `pnpm turbo run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | User registration with email/password | integration | `pnpm --filter api exec vitest run src/__tests__/auth.register.test.ts` | Wave 0 |
| AUTH-02 | Email verification sent after signup | integration | `pnpm --filter api exec vitest run src/__tests__/auth.verify.test.ts` | Wave 0 |
| AUTH-03 | Password reset via email link | integration | `pnpm --filter api exec vitest run src/__tests__/auth.reset.test.ts` | Wave 0 |
| AUTH-04 | JWT session persistence + refresh | integration | `pnpm --filter api exec vitest run src/__tests__/auth.jwt.test.ts` | Wave 0 |
| AUTH-05 | Multi-profile creation with fields | integration | `pnpm --filter api exec vitest run src/__tests__/profile.crud.test.ts` | Wave 0 |
| AUTH-06 | Profile switching (frontend cache) | unit | `pnpm --filter web exec vitest run src/__tests__/profileStore.test.ts` | Wave 0 |
| AUTH-07 | Profile data isolation (CRITICAL) | integration | `pnpm --filter api exec vitest run src/__tests__/profile.isolation.test.ts` | Wave 0 |
| AUTH-08 | Profile edit and cascade delete | integration | `pnpm --filter api exec vitest run src/__tests__/profile.crud.test.ts` | Wave 0 |
| ONBD-05 | First prediction from onboarding data | unit | `pnpm --filter api exec vitest run src/__tests__/prediction.tier1.test.ts` | Wave 0 |
| PRIV-01 | Field-level encryption roundtrip | integration | `pnpm --filter api exec vitest run src/__tests__/encryption.test.ts` | Wave 0 |
| PRIV-02 | Account deletion cascades all data | integration | `pnpm --filter api exec vitest run src/__tests__/account.delete.test.ts` | Wave 0 |
| I18N-01 | All keys exist in EN and BN files | unit | `pnpm --filter web exec vitest run src/__tests__/i18n.completeness.test.ts` | Wave 0 |
| ONBD-01-04 | Onboarding wizard flow | manual-only | Manual QA -- multi-step wizard UI | N/A |
| ONBD-06 | Onboarding in Bengali | manual-only | Manual QA -- visual Bengali rendering | N/A |
| I18N-02-04 | Language switching and formatting | unit + manual | `pnpm --filter web exec vitest run src/__tests__/i18n.test.ts` + visual QA | Wave 0 |
| PRIV-03-05 | Privacy/ToS pages + consent | manual-only | Manual QA -- static content review | N/A |

### Sampling Rate
- **Per task commit:** `pnpm turbo run test --filter=api --filter=web`
- **Per wave merge:** `pnpm turbo run test lint typecheck`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/api/vitest.config.ts` -- Vitest configuration for API tests
- [ ] `packages/web/vitest.config.ts` -- Vitest configuration for frontend tests
- [ ] `packages/api/src/__tests__/encryption.test.ts` -- CRITICAL: validates prisma-field-encryption on pinned Prisma 6.13.0
- [ ] `packages/api/src/__tests__/profile.isolation.test.ts` -- CRITICAL: security test for cross-user profile access
- [ ] `packages/api/src/__tests__/auth.jwt.test.ts` -- JWT refresh token rotation test
- [ ] `packages/web/src/__tests__/i18n.completeness.test.ts` -- Validates all keys exist in EN and BN
- [ ] Framework install: `pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom` (both web and api packages)
- [ ] `docker-compose.yml` -- Local PostgreSQL for integration tests

## Sources

### Primary (HIGH confidence)
- npm registry: Express 5.2.1, Prisma 6.13.0-6.19.2, prisma-field-encryption 1.6.0 (peer dep: `@prisma/client >= 4.7`), argon2 0.44.0, jsonwebtoken 9.0.3
- npm registry: i18next 25.10.10, react-i18next 16.6.6, date-fns 4.x (bn locale supported), TanStack Query 5.95.2, Zustand 5.0.12, React Hook Form 7.72.0
- npm registry: @fontsource/noto-sans-bengali 5.2.11, helmet 8.1.0, cors 2.8.6, express-rate-limit 8.3.1, pino 10.3.1
- [Express 5 release notes](https://expressjs.com/) -- Promise-based error handling, path-to-regexp v8
- [prisma-field-encryption GitHub](https://github.com/47ng/prisma-field-encryption) -- Supports Prisma 4.7.0 to 6.13.0 per README, v1.6.1-beta.2 (Jan 2026)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html) -- helmet + cors + rate-limit baseline

### Secondary (MEDIUM confidence)
- [Password Hashing Guide 2025](https://guptadeepak.com/the-complete-guide-to-password-hashing-argon2-vs-bcrypt-vs-scrypt-vs-pbkdf2-2026/) -- Argon2id recommended
- [React i18next](https://react.i18next.com/) -- De facto i18n for React, Bengali supported
- [date-fns Bengali locale PR](https://github.com/date-fns/date-fns/pull/845) -- bn locale merged
- [JWT HttpOnly Cookie Pattern](https://medium.com/@alperkilickaya/creating-a-jwt-authentication-system-with-http-only-refresh-token-using-react-and-node-js-6865f04087ce) -- Verified pattern for Express + React
- [pnpm Workspaces](https://pnpm.io/workspaces) -- Official docs for monorepo setup

### Tertiary (LOW confidence)
- prisma-field-encryption actual compatibility ceiling: README says 6.13.0 but peer dep allows higher. Needs integration test validation.
- Bengali numeral preference for Bangladesh market: Based on observation of popular BD apps, not formal research. Confirm with client.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All package versions verified against npm registry on 2026-03-26. Express 5, Prisma 6, React 19 are all stable.
- Architecture: HIGH - Multi-profile pattern, JWT auth, and i18n setup follow established patterns documented in project architecture research.
- Pitfalls: HIGH - Prisma version lock, auth bypass, and Bengali text issues are well-documented in project pitfalls research and verified against current package state.
- Encryption compatibility: MEDIUM - prisma-field-encryption says 6.13.0 ceiling in README but peer dep allows higher. Integration test needed.
- Monorepo setup: MEDIUM - pnpm + Turborepo is well-documented but this project requires migration from a single-package prototype.

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (30 days -- stable ecosystem, Prisma version pin means no drift)
