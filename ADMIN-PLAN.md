# Vesta Admin Panel — Implementation Plan

> Generated: 2026-05-29
> Branch: adib/backend-integration
> Scope: Full admin panel (FR-ADMIN, FR-CMS, FR-ANALYTICS, FR-EXPORT, FR-SMS admin, FR-FEEDBACK admin)
> Status: **ALL STEPS COMPLETE** — 0 type errors (admin + web), 22/22 web tests passing, 63 files, 7,115 lines

---

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Admin roles | Single Super Admin (existing `ADMIN` role) | SRS v1.2 removed Content Admin |
| Auth | Same JWT/cookie system, role=ADMIN check | Reuse @vesta/shared auth |
| CMS editor | Tiptap 3.x | SRS requirement, full rich-text |
| Charts | Recharts 3.x | SRS requirement |
| Data export | Server-side CSV/XLSX generation | Handles large datasets |
| Design | Match web app (glass, gradients, Vesta branding) | User preference |
| Schema | All models in single migration | Clean, reviewable |
| Admin i18n | English-only | Super Admin is technical staff |

---

## Resolved Ambiguities

| Flag | Resolution |
|---|---|
| FR-EXPORT scope | Admin exports feedback/analytics/SMS data. User self-export is separate (web app feature). |
| Grace-period views | Show UI section with current schema values (will be null/default in v1). Ready for v2. |
| SMS send history types | Single view with type column (BROADCAST vs ALERT). |
| Feedback PII | Admin sees all submissions including user info — intentional for Super Admin role. |
| Analytics freshness | KPI prediction-accuracy shows nightly MAE. Acceptable to be 24h stale. |
| Admin bilingual | English-only admin panel. |

---

## Step 1 — Schema + Shared Infrastructure

**Status:** Done
**Effort:** ~1.5hrs

### 1.1 New Enums

| Enum | Values |
|---|---|
| `ArticleStatus` | `DRAFT`, `PUBLISHED`, `ARCHIVED` |
| `CyclePhase` | `MENSTRUAL`, `FOLLICULAR`, `OVULATION`, `LUTEAL` |
| `SmsBroadcastStatus` | `DRAFT`, `SCHEDULED`, `SENDING`, `SENT`, `FAILED` |

### 1.2 New Models

| Model | Purpose | Key Fields |
|---|---|---|
| `Article` | CMS content | slug, titleEn/Bn, bodyEn/Bn, status, cyclePhases[], categoryId, authorId, publishedAt |
| `ArticleCategory` | Content categorization | name, slug |
| `SmsBroadcast` | SMS content queue | message, scheduledFor, sentAt, status, targetCount, deliveredCount, failedCount, createdBy |
| `AdminAuditLog` | Admin action tracking | adminId, action, targetType, targetId, metadata (Json) |

### 1.3 Model Modifications

| Model | New Fields |
|---|---|
| `User` | `suspendedAt`, `suspendedBy`, `deletedAt`, `lastLoginAt` |
| `Subscription` | `adminOverride`, `adminOverrideBy`, `adminOverrideAt` |

### 1.4 Shared Auth Utilities

- `requireAdminAuth()` — verifyAuth + role=ADMIN check
- `withAdminAuth(handler)` — route handler wrapper for admin API routes

---

## Step 2 — Admin App Foundation

**Status:** Done
**Effort:** ~2hrs

| Component | What |
|---|---|
| `middleware.ts` | Edge JWT decode + role=ADMIN check |
| `app/queries/auth-queries.ts` | `getCurrentAdminUser()`, `requireAdminUser()` |
| `app/login/page.tsx` | Admin magic-link login |
| `app/api/auth/` | Magic-link request, callback, logout routes |
| `app/(admin)/layout.tsx` | Sidebar + header shell |
| `components/Providers.tsx` | Theme sync |
| `lib/store.ts` | Zustand UI-only (sidebarCollapsed) |
| `app/globals.css` | Vesta design system (CSS vars, glass, gradients) |
| `components/ui/` | DataTable, Badge, StatCard, FilterBar, Pagination, ConfirmModal |
| `loading.tsx`, `error.tsx` | Loading/error states |

---

## Step 3 — Dashboard + User Management

**Status:** Done
**Effort:** ~2.5hrs

| Feature | What |
|---|---|
| KPI Dashboard | Total users, active profiles, Pro subscribers, daily logs, prediction accuracy |
| Trend Charts | Daily new users, MAU, profile creation (Recharts) |
| User List | Search, paginate, filter by status/role |
| User Detail | Profile metadata, subscription state, activity |
| User Actions | Suspend, reactivate, soft-delete |
| Audit Log | Record all admin actions |

---

## Step 4 — Subscription Management

**Status:** Done
**Effort:** ~1.5hrs

| Feature | What |
|---|---|
| Pro Subscribers List | All active Pro users with billing info |
| CAAS Transaction History | Per-user transaction list |
| Manual Grant/Revoke | Admin override with audit trail |
| Grace Period Display | Show schema fields (stub for v2) |

---

## Step 5 — Content CMS

**Status:** Done
**Effort:** ~3hrs

| Feature | What |
|---|---|
| Tiptap Editor | Rich-text with EN/BN side-by-side |
| Article CRUD | Create, edit, delete, archive |
| Draft/Publish | Status lifecycle with publishedAt |
| Categories | CRUD for ArticleCategory |
| Phase Tags | Multi-select CyclePhase assignment |
| HTML Sanitisation | Strip unsafe tags on save |

---

## Step 6 — Analytics

**Status:** Done
**Effort:** ~2hrs

| Feature | What |
|---|---|
| Population Charts | Cycle-length distribution, common symptoms by phase |
| Prediction Accuracy | Per-tier MAE report |
| Retention Curves | User retention over time |
| Privacy Guards | Anonymised aggregates only, no PII in responses |

---

## Step 7 — SMS Management + Feedback + Export

**Status:** Done
**Effort:** ~2hrs

| Feature | What |
|---|---|
| SMS Broadcast CRUD | Create, edit, schedule messages |
| CSV Batch Upload | Parse CSV, create SmsBroadcast records |
| Send History | Message content, dates, delivery stats |
| Feedback List | All submissions with category/date/rating filters |
| CSV Export | Server-side generation for feedback, analytics, SMS data |

---

## Dependencies

```
Step 1 (Schema) ──► Step 2 (Foundation) ──► Steps 3-7 (parallel)
```

Steps 3-7 can be developed in parallel once Step 2 is complete.

---

## New Dependencies to Install

| Package | App | Purpose |
|---|---|---|
| `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-*` | admin | CMS rich-text editor |
| `recharts` | admin | Analytics charts |
| `xlsx` | admin | Excel export generation |
| `sanitize-html` | admin | HTML sanitisation for CMS |
| `lucide-react` | admin | Icons (same as web app) |
| `clsx` | admin | className utility |
| `zustand` | admin | UI state |
| `jose` | admin | JWT verification in middleware |
