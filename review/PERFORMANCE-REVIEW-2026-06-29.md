# Performance Review & Fixes — 2026-06-29

Codebase-wide performance audit of the Vesta monorepo (web + admin + shared),
focused on the mobile-first Bangladesh audience (slow networks, low-end phones).
Three parallel audits were run — server data-fetching/DB, client runtime, and
navigation/bundle — then the high-impact findings were fixed and committed one
task per commit.

## Method

- Audited: every RSC `page.tsx`/`layout.tsx`, the shared services + `queries/*`,
  Prisma schema/indexes, all client handlers/effects, Zustand usage, every
  `next/link` + `router` navigation, and all heavy-library imports.
- Each fix was verified with `tsc` (web, admin, shared) and the full web Vitest
  suite (**252 passing** throughout) before committing.

## Fixes shipped (one commit each)

| # | Commit | Area | Impact |
|---|--------|------|--------|
| 1 | `perf(config)` optimizePackageImports | bundle | Tree-shake `motion` (web) + `@tiptap/*` (admin) barrels (not in Next's default list) |
| 2 | `perf(web)` batch symptom save in modals | client RTT | QuickSymptomModal + TodayCheckInModal: N sequential `toggleSymptom` calls → 1 `saveSymptoms` |
| 3 | `perf(web)` lazy-load xlsx | bundle | SheetJS (~400KB+) removed from Settings first-load; loaded on export click |
| 4 | `perf(web)` code-split modals | bundle | TodayCheckInModal + shell modals/tour/trial-lock via `next/dynamic` (zero `next/dynamic` existed before) |
| 5 | `perf(admin)` code-split recharts + tiptap | bundle | recharts (~100KB gz) + tiptap (~150KB) out of admin first-load via `next/dynamic` |
| 6 | `perf(shared)` parallelize reads | DB latency | `Promise.all` independent queries in `getDashboardData` + `getEngagementSummary` |
| 7 | `perf(db)` PeriodLog(profileId,startDate) index | DB | Composite index serves the profile+startDate sort/range used everywhere |
| 8 | `perf(render)` calendar memo + admin sidebar | render | Stable `onGhostTap` (DayCell memo holds); hoist admin `SidebarContent` out of render body |
| 9 | `perf(web)` stop per-navigation polling | client RTT | Shell no longer refetches auth/completion/logging on every nav — **3 round-trips per screen removed** |
| 10 | `perf(web)` default nav prefetch | bandwidth | 5 nav links: forced full-RSC prefetch → default (loading-skeleton) prefetch for dynamic routes |
| 11 | `perf(web)` trim content payload + lazy DOMPurify | payload/bundle | Content list ships short excerpts not full bodies; body fetched on open; DOMPurify lazy-loaded |

### Highlights

- **Per-navigation round-trips (biggest win).** The `(main)` shell was firing
  `/api/auth/status`, `/api/profile/completion`, and `/api/tracking/logging-status`
  on every `pathname` change. Auth status is now fetched once per session (tour
  gating split into a network-free effect using a captured `tourEligible` flag);
  completion + logging are fetched once on mount and refreshed via the existing
  `vesta:profile-updated` event (which mutations and profile switches already
  dispatch). Net: ~3 fewer client round-trips per screen.

- **Symptom save.** All three symptom-logging surfaces (SymptomsClient,
  QuickSymptomModal, TodayCheckInModal) now save in a single batched
  `$transaction` round-trip instead of one server action per symptom.

- **Bundle.** `next/dynamic` introduced (was used zero times): heavy
  interaction-only components (xlsx, recharts, tiptap, several modals/tour) are
  no longer in first-load JS of their hot routes.

## Deferred — lower-priority follow-ups (not yet done)

Ordered by value. None are user-perceptible blockers after the above; logged so
they aren't lost.

- **H2 — `getLoggingStatus` calls full `getDashboardData`** just to read the
  countdown (`tracking-service.ts`). Inline the countdown from `lastPeriod` +
  `prediction` to drop ~4 queries on that endpoint. (Lower priority now that the
  endpoint is hit once per session, not per nav.) Needs care to match the
  countdown calc exactly.
- **H3 — `/api/auth/status` re-queries the user** via `getUserById` though
  `withAuth` already injects `user`. Verify `AuthUser` carries the tour/trial
  fields the layout reads before returning the context user directly.
- **M6 — `getProfileCompletionStatus` uncached** and computed both server-side on
  the dashboard and via the API. Wrap in `unstable_cache` tagged `user:`/`profiles:`.
- **M7 — auth→profiles micro-waterfall** in `queries/profile-queries.ts`:
  `getAuthUser` then `listProfiles` are serial though `listProfiles` only needs
  `jwt.sub`. `Promise.all` off the verified JWT.
- **M8 — admin analytics full-table scans** (`getSymptomsByPhase`,
  `getPredictionAccuracyMae`) load entire tables into memory; retention loops do
  8 sequential `await`ed queries. Admin-only + cached, but push aggregation into
  SQL `groupBy`/`$queryRaw` before data grows.
- **Secondary indexes (L1):** `Feedback(userId)`, `Subscription(status)`,
  `SymptomLog(date)` for admin date-range scans.
- **Zustand selectors:** ~20 call sites use `useAppStore()` with object
  destructuring (whole-store subscription). Convert to selector form
  (`useAppStore((s) => s.language)` / `useShallow`) to cut broad re-renders.
- **Content excerpt column:** excerpts are currently derived server-side by
  stripping HTML at query time. A stored `excerpt` column (populated on
  create/update, backfilled by migration) would avoid reading Text columns for
  the list entirely.
- **OG image:** `apps/web/public/opengraph-image.png` is 1.2 MB (metadata only,
  no runtime cost) — recompress to <200 KB.

## Verification baseline

`tsc` clean for web + admin; shared shows only the 2 pre-existing
`src/server/simulator/checker.ts` errors (`cache` on `RequestInit`, unrelated).
Full web suite: **252 tests passing**.
