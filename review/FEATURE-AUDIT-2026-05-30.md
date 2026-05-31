# Feature & Data Audit Report

> Generated: 2026-05-30
> Scope: `apps/web/`, `apps/admin/`, `packages/shared/`
> Method: Parallel subagent codebase audit
> Last verified: 2026-05-30 (post-fix verification pass)

---

## Verification Summary

| Category | Found | Fixed | Still Open |
|----------|-------|-------|------------|
| Critical bugs | 5 | 4 | 1 (FR-ENC deferred) |
| Missing features | 9 | 9 | 0 |
| Data integrity issues | 6 | 5 | 1 (goal field — cosmetic) |
| Missing service functions | 5 | 5 | 0 |
| **Total** | **25** | **23** | **2** |

**Files changed:** 29 files, +1874 / -136 lines. Zero new type errors.

---

## Issues Found & Status

### Critical Issues

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 1 | OTP verify sends `code`, API expects `otp` | **FIXED** | `verify-otp/page.tsx:116` now sends `otp: code` |
| 2 | Subscription UI ৳99/month vs API ৳5 | **FIXED** | UI updated to ৳5/day, amount matches API |
| 3 | SMS broadcast can't be sent | **FIXED** | `sendBroadcast` service + Send button in admin |
| 4 | Field encryption not implemented | **DEFERRED** | `prisma-field-encryption` to be installed in later phase |
| 5 | Admin middleware not wired | **FIXED** | `apps/admin/src/middleware.ts` re-exports proxy |

### Missing Features

| # | Feature | Status | Evidence |
|---|---------|--------|----------|
| 6 | User data export (Settings) | **FIXED** | `exportUserDataCsv` action + blob download |
| 7 | ProfileCompletionModal | **FIXED** | Real modal rendered in main layout for email-login users |
| 8 | Profile editing | **FIXED** | Edit form + `updateProfile` at service/action/UI layers |
| 9 | Calendar day symptoms | **FIXED** | Symptom logs fetched server-side, rendered in DayDetail |
| 10 | Content search (admin) | **FIXED** | Client-side title filter wired to DataTable |
| 11 | Feedback/SMS search (admin) | **FIXED** | Both clients filter by search term |
| 12 | Category management UI | **FIXED** | Manage Categories modal with create/delete |
| 13 | User CSV export (admin) | **FIXED** | Export CSV button wired to `exportUsersCsv` |
| 14 | Audit log viewer | **FIXED** | `listAuditLogs` service + page + sidebar nav |

### Data Integrity / Logic Issues

| # | Issue | Status | Evidence |
|---|-------|--------|----------|
| 15 | `updateArticle` doesn't clear `publishedAt` | **FIXED** | Sets `publishedAt: null` on DRAFT/ARCHIVED |
| 16 | Table sorting client-side only | **FIXED** | `onSortChange` prop + server-side sort in user-queries |
| 17 | Goal field saved but never read | **OPEN (by design)** | No downstream use planned — cosmetic gap |
| 18 | `onboardingComplete` dead code | **FIXED** | Removed from verify-otp; store field kept (used in onboarding) |
| 19 | TOCTOU race on profile limit | **FIXED** | `createProfile` wrapped in `prisma.$transaction` |
| 20 | CHECKLIST.md stale | **FIXED** | FR-ENC → NOT STARTED, P2 admin items → DONE |

### Service Layer Gaps

| Service | Gap | Status |
|---------|-----|--------|
| `sms-service.ts` | Missing `sendBroadcast` | **FIXED** |
| `audit-service.ts` | Missing `listAuditLogs` | **FIXED** |
| `profile-service.ts` | Missing `updateProfile` | **FIXED** |
| `user-service.ts` | Missing `listUsers` | **FIXED** — `listUsers` added; admin query now delegates to shared service |
| `content-service.ts` | Missing `updateCategory` | **FIXED** — `updateCategory` added + inline rename UI in category manager |
| `feedback-service.ts` | Missing date range filter | **FIXED** — `dateFrom`/`dateTo` params added to `listFeedback` |

---

## Remaining Open Items

### Must Fix (future phases)

| # | Item | Severity | Notes |
|---|------|----------|-------|
| 4 | FR-ENC field encryption | P0 blocker | `prisma-field-encryption` not installed. `SymptomLog.value` stored plaintext. Blocks security gate. |

### Low Priority (cosmetic)

| Item | Severity | Notes |
|------|----------|-------|
| Goal field has no downstream effect | Low | Saved in onboarding but never used to customize app behavior. |

---

## What's Working Correctly

- All auth flows (dev-login, OTP request/verify, magic link, admin login)
- Dashboard, calendar, symptom tracking — all real DB data
- Calendar now shows actual symptom data per day
- Profile CRUD (create, edit, delete) with 6-profile cap + transaction safety
- Content CMS with Tiptap editor (create/edit/delete articles + category management)
- Admin user management (suspend/reactivate/soft-delete/grant Pro/revoke Pro)
- Analytics dashboard (6 real Prisma aggregate queries)
- Audit log viewer with filterable history
- BDApps adapter (OTP, CAAS billing, SMS) — production-grade with retry logic
- SMS broadcast creation and sending (dev stub in development, real BDApps in prod)
- Feedback submission and admin review
- User data CSV export (both web app Settings and admin Users page)
- ProfileCompletionModal prompts email-login users to add phone
- Search works on Content, Feedback, and SMS admin pages
- Server-side table sorting on Users page
- JWT blacklisting and rate limiting via Redis
- Admin routes protected at edge via middleware
- All 17 Prisma models complete with proper relations
- Subscription billing with correct ৳5/day pricing

---

## Fix Log

### Wave 1 — Critical Bugs
| # | Fix | Files |
|---|-----|-------|
| 1 | OTP `code` → `otp` field name | `verify-otp/page.tsx` |
| 2 | Subscription ৳99/month → ৳5/day | `SubscriptionClient.tsx` |
| 5 | Admin middleware wired | `apps/admin/src/middleware.ts` (new) |
| 15 | `updateArticle` clears `publishedAt` on un-publish | `content-service.ts` |
| 18 | Removed dead `onboardingComplete` code | `verify-otp/page.tsx` |

### Wave 2 — Missing Core Features
| # | Fix | Files |
|---|-----|-------|
| 3 | `sendBroadcast` service + Send Now button | `sms-service.ts`, `sms-actions.ts`, `SmsClient.tsx` |
| 9 | Calendar day symptoms display | `CalendarClient.tsx`, `calendar/page.tsx` |
| 8 | Profile edit UI | `ProfilesClient.tsx`, `profile-actions.ts`, `profile-service.ts` |
| 6 | User data export (CSV) | `settings-actions.ts`, `SettingsClient.tsx` |

### Wave 3 — Admin Polish
| # | Fix | Files |
|---|-----|-------|
| 10 | Content search wired | `ContentClient.tsx` |
| 11 | Feedback + SMS search wired | `FeedbackClient.tsx`, `SmsClient.tsx` |
| 13 | User export CSV button | `UsersClient.tsx` |
| 16 | Server-side table sorting | `DataTable.tsx`, `user-queries.ts`, `users/page.tsx`, `UsersClient.tsx` |

### Wave 4 — Cleanup
| # | Fix | Files |
|---|-----|-------|
| 19 | TOCTOU race fixed with `$transaction` | `profile-service.ts` |
| 20 | CHECKLIST.md corrected | `CHECKLIST.md` |

### Wave 5 — Previously Deferred
| # | Fix | Files |
|---|-----|-------|
| 12 | Category management UI | `ContentClient.tsx` |
| 14 | Audit log viewer | `audit-service.ts`, `audit-queries.ts`, `audit-logs/page.tsx`, `AuditLogClient.tsx`, `layout.tsx` |
| 7 | ProfileCompletionModal | `ProfileCompletionModal.tsx`, `(main)/layout.tsx` |

### Wave 6 — Service Layer Gaps
| Item | Fix | Files |
|------|-----|-------|
| `listUsers` | Moved query into shared service; admin query is now thin wrapper | `user-service.ts`, `user-queries.ts` |
| `updateCategory` | Service function + server action + inline rename in category manager | `content-service.ts`, `content-actions.ts`, `ContentClient.tsx` |
| Feedback date range | `dateFrom`/`dateTo` params added to `listFeedback` + admin query | `feedback-service.ts`, `feedback-queries.ts` |
