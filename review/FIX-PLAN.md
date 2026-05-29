# Vesta Web App — Architecture Migration & Fix Plan

> Generated: 2026-05-29
> Branch: adib/backend-integration
> Scope: Server Actions + RSC migration, remove dummy data, security fixes
> Status: **ALL STEPS COMPLETE** — 0 type errors, 22/22 tests passing

---

## Architecture Changes

| Layer | Before | After |
|---|---|---|
| Data fetching | `useEffect` + `fetch('/api/...')` + Zustand persist | RSC async components + React `cache()` |
| Mutations | `fetch('/api/...')` from Zustand actions | Server Actions with `revalidatePath()` |
| Client state | Zustand stores everything (user, profiles, logs, prefs) | Zustand keeps only UI state (theme, language, activeProfileId) |
| Demo mode | `useDummyData` flag + `dummy-data.ts` | Removed entirely. DB only. |
| API routes | 20+ routes for both UI and external integrations | ~15 routes for external systems only |

---

## Files to Delete (after migration)

| File | Reason |
|---|---|
| `apps/web/src/lib/dummy-data.ts` | No more hardcoded data |
| `apps/web/src/lib/api.ts` | Client API wrapper replaced by Server Actions |
| `apps/web/src/lib/api-mappers.ts` | Mapping layer unnecessary with direct DB access |
| `apps/web/src/lib/hydrate-store.ts` | No more client-side hydration from API |
| `apps/web/src/app/api/profiles/route.ts` | → Server Actions |
| `apps/web/src/app/api/profiles/[id]/route.ts` | → Server Actions |
| `apps/web/src/app/api/tracking/period-logs/route.ts` | → Server Actions |
| `apps/web/src/app/api/tracking/period-logs/[id]/route.ts` | → Server Actions |
| `apps/web/src/app/api/tracking/symptoms/route.ts` | → Server Actions |
| `apps/web/src/app/api/tracking/dashboard/route.ts` | → RSC fetch |
| `apps/web/src/app/api/tracking/calendar/route.ts` | → RSC fetch |
| `apps/web/src/app/api/predictions/route.ts` | → RSC fetch |

---

## Zustand Store — Stays vs Goes

| Stays | Goes |
|---|---|
| `language`, `setLanguage` | `user`, `isAuthenticated`, `login`, `logout` |
| `theme`, `setTheme` | `profiles`, `addProfile`, `deleteProfile` |
| `activeProfileId`, `setActiveProfile` | `periodLogs`, `addPeriodLog`, `updatePeriodLog` |
| `onboardingComplete`, `setOnboardingComplete` | `symptomLogs`, `toggleSymptom` |
| | `feedbackHistory`, `submitFeedback` |
| | `notificationPrefs`, `setNotificationPref` |
| | `dataMode`, `isHydrated`, `isHydrating` |
| | `showProfileCompletion`, `completeProfile` |

---

## Step 1 — Security Fixes on Surviving Routes

**Status:** Done
**Effort:** ~1hr

| # | Fix | File | What |
|---|---|---|---|
| 1.1 | Guard internal pages | `internal/backend-checklist/page.tsx`, `internal/dependency-graph/page.tsx` | Add `notFound()` in production |
| 1.2 | Fix webhook IP validation | `packages/shared/src/server/adapters/webhooks.ts` | Use `x-real-ip`, not `x-forwarded-for` |
| 1.3 | Rate limit OTP verify | `api/auth/otp/verify/route.ts` | Max 5 attempts per `referenceNo` |
| 1.4 | Hard-code billing amount | `api/billing/subscribe/route.ts` | Remove client-controlled `amount` |
| 1.5 | Fix magic-link trial reset | `api/auth/magic-link/callback/route.ts` | Only set trial on user creation |
| 1.6 | Fix billing charge-before-record | `api/billing/subscribe/route.ts` | Record pending tx first, then charge |
| 1.7 | Add `env.local` to `.gitignore` | `.gitignore` | Stop tracking credentials |

---

## Step 2 — Server Actions Layer

**Status:** Done
**Effort:** ~2hrs

Create `apps/web/src/app/actions/`:

| Action file | Functions | Replaces |
|---|---|---|
| `profile-actions.ts` | `createProfile`, `deleteProfile`, `renameProfile` | `/api/profiles` routes |
| `tracking-actions.ts` | `createPeriodLog`, `updatePeriodLog`, `deletePeriodLog`, `toggleSymptom` | `/api/tracking/*` routes |
| `feedback-actions.ts` | `submitFeedback` | Missing `/api/feedback` route |
| `user-actions.ts` | `completeProfile` | Missing `/api/user/complete-profile` |
| `settings-actions.ts` | `updateNotificationPrefs` | Missing `/api/notifications/preferences` |

Each action: `'use server'`, validates with Zod, reads auth from `cookies()`, calls Prisma, calls `revalidatePath()`.

---

## Step 3 — RSC Data Fetching Layer

**Status:** Done
**Effort:** ~2hrs

Create `apps/web/src/app/queries/`:

| Query file | Functions | Replaces |
|---|---|---|
| `profile-queries.ts` | `getProfiles`, `getProfile` | `/api/profiles` GET |
| `tracking-queries.ts` | `getDashboardData`, `getCalendarData`, `getPeriodLogs` | `/api/tracking/*` GET |
| `prediction-queries.ts` | `getPrediction` | `/api/predictions` GET |
| `symptom-queries.ts` | `getSymptomLogs` | `/api/tracking/symptoms` GET |

Each uses React `cache()` for request-level dedup. Auth via `cookies()` + `verifyAuth()`.

---

## Step 4 — Convert Pages to RSC

**Status:** Done
**Effort:** ~3hrs

| Page | Change |
|---|---|
| `dashboard/page.tsx` | RSC — fetch data server-side, pass to `<DashboardClient>` island |
| `calendar/page.tsx` | RSC — fetch data server-side, pass to `<CalendarClient>` island |
| `profiles/page.tsx` | RSC — fetch profiles server-side, pass to `<ProfilesClient>` |
| `symptoms/page.tsx` | RSC — fetch logs server-side, pass to `<SymptomsClient>` for tap UI |
| `feedback/page.tsx` | RSC — fetch history server-side, pass to `<FeedbackClient>` for form |
| `content/page.tsx` | RSC — fetch articles server-side, pass to client island |
| `settings/page.tsx` | RSC — fetch prefs server-side, pass to `<SettingsClient>` |
| `subscription/page.tsx` | Keep client — BDApps modal needs full client control |

---

## Step 5 — Remove Dummy Data + Old Plumbing

**Status:** Done (merged with Step 4)
**Effort:** ~1hr

- Delete the 12 files listed in "Files to Delete"
- Gut Zustand store to UI-only state
- Remove `useDummyData`, `currentDataMode`, `DataMode` from `@vesta/shared/utils/config`
- Remove all `if (useDummyData)` branches
- Delete `/api/auth/dev-login/route.ts`

---

## Step 6 — Frontend Patterns

**Status:** Done
**Effort:** ~2hrs

| Fix | What |
|---|---|
| HTML `lang` attribute | Dynamic in Providers based on Zustand language |
| `loading.tsx` files | Add shimmer skeletons to `(main)/` and `(auth)/` |
| `error.tsx` file | Error boundary for `(main)/` |
| `not-found.tsx` | App root 404 page |
| Per-page metadata | `generateMetadata` on each page |
| `middleware.ts` for auth | Server-side redirect, remove client `useEffect` guard |
| `next/font` | Replace `<link>` Google Fonts with `next/font/google` |
| Security headers | CSP, X-Frame-Options, HSTS in `next.config.ts` |
| Remove `'use client'` from UI primitives | Button, Card, Input, Shimmer can be RSC |

---

## Step 7 — i18n Completeness

**Status:** Done
**Effort:** ~1hr

| Fix | What |
|---|---|
| Add LanguageToggle to auth + onboarding | 4 screens missing it |
| Replace ~20 hardcoded strings | Use `t()` throughout |
| Consolidate language state | Remove i18next LanguageDetector, single source in Zustand |
| Bengali date formatting | Pass `bn-BD` locale to `date-fns` |
| Fix phase algorithm disagreement | Unify ovulatory window in one place |
