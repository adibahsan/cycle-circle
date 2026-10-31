# Admin portal feature audit (2026-10-31)

**Next action:** file the P0/P1 rows as GitHub issues, then `/triage` them.

- **Scope:** every `apps/admin` feature: does it work, does it meet the SRS, what needs upgrading. UI/visual polish is out of scope.
- **Base:** `main` @ `9e17dc7` (after PR #180).
- **Method:**
  - Ran the E2E suite for `admin-desktop`, `admin-phone` and `cross-app-desktop`, with the apps at `TZ=UTC`.
  - Ran `pnpm outdated` and `pnpm audit --prod`.
  - Four Sonnet agents read the code, one slice each.
  - Every finding marked ✓ was re-checked in the code by the orchestrator. Unmarked rows are agent-reported and not re-checked.
- **Previous audits:** `FEATURE-AUDIT-2026-05-30.md`, `ADMIN-UI-REVIEW.md`. All known admin E2E bugs (#134 #138 #144 #145 #152 #159) are closed.

## Verdict

**E2E: 95 passed, 2 skipped (intentional), 0 failed.** Every flow the suite covers works.

The problems are in paths E2E doesn't exercise:
- framework CVEs
- secrets in a payload
- concurrency on SMS sends
- provider error paths
- missing guards and audit rows

| Feature | Status | Why |
|---|---|---|
| Auth / login | Partial | Core JWT, blacklist and role gate are solid. No rate limit, no password change, auth events not audited. |
| Dashboard | Partial | Works. Some KPIs are miscounted, and the MAE trend from the SRS is missing. |
| Users list + detail | Partial | Works. Leaks `passwordHash`. No self/admin guard on suspend/delete. |
| Subscriptions | Partial | Works. A bad `?status=` crashes the page. |
| Content / CMS | Working | Sanitising, uploads and web revalidation are solid. Category slug collisions; errors swallowed. |
| Emails | Broken (2 paths) | Resend errors are logged as SENT. Refresh can downgrade DELIVERED to PENDING. |
| Analytics | Partial | Maths is sound. Unbounded reads; UTC day cut on panel ranges. |
| Engagement | Partial | Retention panel is wrong by construction; rate denominator is wrong. |
| Feedback | Working | Only gaps: unbounded `pageSize` and a 300 s cache. |
| SMS broadcasts | Partial | Duplicate-send risks, stuck `SENDING`, delivery counts dead in prod. |
| System (cron) | Working | A trigger failure is not audited. |
| Logs | Working | No traversal. Whole files are read into memory. |
| Audit logs | Partial | 300 s stale, never revalidated. Many actions never write a row. |
| API docs | Partial | Spec served without login; stale (says Vercel Cron). |

## P0: security, ship first

| # | ✓ | Finding | Where | Scenario |
|---|---|---|---|---|
| 1 | ✓ | **Next.js 16.2.6 in web + admin** has critical unauthenticated-RCE advisories. Two are in Image Optimization, one in `use cache`, one in `next/og`. Highs include a proxy bypass, SSRF and DoS in server actions. | `apps/*/package.json` | Public internet → RCE on the VPS. Fix: ≥ 16.4.1 (latest 16.4.3). |
| 2 | ✓ | **User detail sends every `User` column to the browser**, including `passwordHash`, `sessionsValidAfter` and `suspendedBy`. | `packages/shared/src/server/services/user-service.ts:553`, `users/[id]/page.tsx:20` | Open an admin's detail page → bcrypt hash in the RSC payload. Fix: an explicit `select`. |
| 3 | ✓ | **`/openapi.yaml` and `/swagger-ui/*` are public.** The proxy matcher skips any path with a dot, and the nginx admin vhost has no allowlist. | `apps/admin/src/proxy.ts:35`, `apps/admin/public/`, `ops/deploy/nginx/cycle-circle.conf:61` | Anonymous GET → full internal route map. Not probed against prod. |
| 4 | ✓ | **Re-running the seed resets the admin password to `admin123`.** The upsert's `update` writes `passwordHash`, the default is `admin123`, it is printed to stdout, and there is no prod guard. | `packages/shared/prisma/seed.ts:16,736,750`; the deploy doc runs `db seed` (`docs/ops/03-deployment.md:388`) | Seed on prod without `ADMIN_PASSWORD` → prod admin password becomes `admin123`. |
| 5 |  | **No login rate limit or lockout.** Unknown emails also return before bcrypt runs (timing oracle), and email is case-sensitive. | `apps/admin/src/app/api/auth/login/route.ts:6`, `packages/shared/src/server/auth.ts:186` | Unlimited password guesses against `admin@vesta.health`. |
| 6 |  | **No guard on suspending/deleting yourself or another admin.** | `user-service.ts` `suspendUser`/`softDeleteUser`, `UserDetailClient.tsx` | The only admin deletes themselves → locked out, nothing in the app can undo it. |

## P1: correctness bugs

| # | ✓ | Finding | Where | Scenario |
|---|---|---|---|---|
| 7 | ✓ | **SMS retries are nested:** 3 outer × 4 inner, with no timeout and no idempotency. | `sms-service.ts:155,322`, `adapters/bdapps.ts:48` | BDApps accepts a `tel:all` send but returns a 5xx → every subscriber gets up to 12 copies. |
| 8 | ✓ | **SMS send has no compare-and-set on status.** `update({status:'SENDING'})` has no `where status`. | `sms-service.ts:375,407` | A double-click, or a manual send racing the cron → the broadcast goes out twice. |
| 9 | ✓ | **A broadcast stuck in `SENDING` cannot be recovered.** Nothing resets it, and the UI disables edit/send/delete. | `sms-service.ts`, `SmsClient.tsx` | The process dies mid-send → the broadcast is frozen forever. |
| 10 |  | **A successful SMS send can be recorded as FAILED.** The post-send DB writes share the send's `try`. | `sms-service.ts` `performSend` | DB blip after the send → admin re-queues → sent twice. |
| 11 | ✓ | **Resend API errors are logged as SENT.** Only `data` is read; Resend v6 returns `{data, error}` without throwing. | `packages/shared/src/server/adapters/mail.ts:78` | Quota exhausted → logs show SENT, `wasEmailSentToday` blocks the retry, the user gets nothing. |
| 12 | ✓ | **Refresh downgrades delivery status.** `opened`/`clicked`/`failed` fall through to `PENDING`. | `apps/admin/src/app/actions/email-delivery-actions.ts:12,56` | A delivered email is opened → Refresh shows PENDING. |
| 13 |  | **Unvalidated URL params crash pages or run unbounded queries.** Affects `page`, `pageSize` and enum `status` on users, subscriptions, audit-logs, content, emails, sms and feedback. | the `page.tsx` files | `?page=-3` → 500. `?status=foo` → 500. `?pageSize=1e6` → full table scan. |
| 14 |  | **The audit log is never revalidated** (300 s cache), and neither are emails, SMS or feedback, which are written by web/cron. | `queries/audit-queries.ts:30`, `email-queries.ts` | Suspend a user → the audit row appears up to 5 min later. The SRS asks for ≤ 1 min. |
| 15 |  | **Engagement retention is wrong.** "Retained" means any log in the last 7 days from *now*, so the newest cohort is always 100%. | `analytics-service.ts` `getLoggingRetention` | The panel shows misleading curves. |
| 16 |  | **Category slugs collide.** `slugify` keeps only `a-z0-9`, so Bengali names become `""`. | `content-service.ts:215` | Create two Bengali-named categories → the second fails with a generic error. |
| 17 |  | **Server-action errors are swallowed.** Thrown messages are stripped in prod, and delete handlers have no `catch`. | `ContentClient.tsx:140-185`, `UsersClient.tsx` `handleExport` | Delete fails → the confirm modal hangs, no toast. |
| 18 |  | **`/users/<unknown-id>` hits the error boundary**, not `notFound()`. | `user-service.ts:574` | A bad link shows a crash page. |

## P2: missing requirements, audit gaps, upgrades

- **No audit row** for:
  - `updateArticle`
  - category create/update/delete
  - SMS create/bulk/CSV/delete. DEV_SRS.md:788 requires one for each broadcast action.
  - `uploadArticleImage`
  - login/logout and failed logins
  - cron triggers that throw

  Audit writes are also outside the mutation's transaction.
- **No admin password change or rotation.**
- **SMS delivery counts always show 0 in prod.** `deliveryStatusRequest=0` and `targetCount` stays 0. FR-SMS needs per-broadcast counts. At minimum, show "n/a".
- **The SMS scheduler offers a time of day, but dispatch is one broadcast per day at 08:00 UTC.**
- **Dashboard KPIs:**
  - "Total profiles" includes soft-deleted users' profiles.
  - "Logs today" ignores symptom logs.
  - The Pro count differs between pages.
  - The MAE trend (FR-ADMIN) is not shown, though `getPredictionMaeTrend` exists.
- **Analytics:**
  - Unbounded in-memory reads: `cyc=all`, MAE, retention, symptoms-by-phase. This risks the 3 s target.
  - Profile-based metrics count deleted users' profiles.
  - Panel ranges end at the UTC day (an ADR 0008 gap).
- **Email log preview rebuilds the email from fake params** and replaces the real subject. Consider storing rendered HTML or params on `EmailLog`.
- **Email templates interpolate `userName`/`profileName` unescaped.**
- **The Resend webhook accepts any request when `RESEND_WEBHOOK_SECRET` is unset.** It also has no timestamp tolerance and uses a non-constant-time compare.
- **`revalidate-web.ts` returns success when `APP_URL`/`CRON_SECRET` is missing**, which hides the FR-CMS "refresh failed" warning.
- **`getEmailPreviewHtml` has no `requireAdminAuth`**, and `/emails/preview` is not linked from anywhere.
- **The log reader reads and gunzips a whole day file synchronously** on each request.
- **Dead code:** `grantProAccess`/`revokeProAccess` actions; the `xlsx` dependency in admin (unused, unpatched advisories).
- **Search boxes filter only the current page** on SMS and Content.

## Dependencies

| Package | Now | Latest | Why |
|---|---|---|---|
| next | 16.2.6 | 16.4.3 | P0 #1 (both apps) |
| @tiptap/* | 3.23.6 | 3.32.2 | ProseMirror paste XSS, Tiptap ReDoS |
| sharp (transitive) | — | ≥ 0.35.5 | libvips/libheif/librsvg CVEs |
| postcss, nanoid, source-map-js (transitive) | — | patched | high advisories |
| nodemailer (shared) | — | ≥ 10.0.6 | high advisories |
| dompurify (web) | — | ≥ 3.4.17 | critical (SAFE_FOR_TEMPLATES bypass) |
| xlsx (admin) | 0.18.5 | none | remove from admin; unused |
| react / react-dom | 19.2.6 | 19.3.1 | routine |
| recharts, sanitize-html, jose, zustand, tailwind | minor | | routine |

`pnpm audit --prod` total: 6 critical, 25 high, 32 moderate, 7 low.

## E2E coverage gaps worth adding with the fixes

- SMS double-send / concurrent send, stuck `SENDING`, retry multiplicity
- A Resend error logged as FAILED; Refresh never downgrades the status
- User detail payload has no secrets; self/admin suspend is rejected
- Anonymous GET of `/openapi.yaml` → redirect
- Invalid `page`/`status` params → 404 or clamp, never a 500
- A non-admin POST to a server action is rejected
- Login rate limit
