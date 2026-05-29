# Remaining Work — Prioritized Gap Analysis

> Generated: 2026-05-30
> Branch: adib/backend-integration
> Source: DEV_SRS.md (rev 2), review/WEB-UI-REVIEW.md, review/ADMIN-UI-REVIEW.md

---

## P0 — Blockers

| Item | What's needed | Req |
|------|---------------|-----|
| **FR-ENC: Field-level encryption** | Install `prisma-field-encryption`, add `@encrypted` to `symptom_logs.value`, configure `PRISMA_FIELD_ENCRYPTION_KEY` env var, CI round-trip test. **DoD security gate blocker.** | FR-ENC |
| **DB migration** | Schema changes (passwordHash, admin models, new enums/indexes) not yet applied. Run `just db-migrate` + `just db-seed`. | All |
| **ProfileCompletionModal wiring** | Modal collects fullName/phone/DOB but doesn't call `completeProfile` Server Action. One-line fix. | FR-AUTH |

## P0 — Should fix before ship

| Item | What's needed | Req |
|------|---------------|-----|
| **HTML sanitization (XSS)** | `ContentClient.tsx:109` uses `dangerouslySetInnerHTML` without DOMPurify — article body from DB rendered as raw HTML | FR-CONTENT |
| **OTP resend server-side cooldown** | 60s cooldown enforced in UI only, not validated server-side | FR-AUTH |
| **Profile completion re-prompt** | `profileCompleted` not checked on subsequent logins to re-prompt modal | FR-AUTH |

## P1 — Important gaps

| Item | What's needed | Req |
|------|---------------|-----|
| **QStash for notifications** | Daily cron calls `sendPeriodAlert` synchronously — will timeout on Vercel with large user base | FR-NOTIF |
| **User-facing data export** | Settings page CSV/Excel buttons are UI stubs — no `/api/export` route, no file generation | FR-EXPORT |
| **SMS bulk broadcast** | `tel:all` not triggered from admin; sends are per-user. No CSV upload for content batches | FR-SMS |
| **Bengali email templates** | Content needs verification for BN language branch | FR-I18N / FR-NOTIF |
| **Language sync to DB** | Language pref in Zustand/localStorage only, not synced to `User.language` column | FR-I18N |
| **Failed Resend delivery logging** | No admin visibility into failed email deliveries | FR-NOTIF |

## P2 — Nice to have / deferred

| Item | What's needed | Req |
|------|---------------|-----|
| **Admin test suite** | Typecheck passes but zero automated tests | FR-ADMIN |
| **Tiptap image uploads** | Drag-and-drop stub exists, Supabase storage upload not wired | FR-CMS |
| **HTML sanitization unit tests** | Server-side sanitization exists but no test coverage | FR-CMS |
| **Nightly MAE report job** | Analytics computed on-demand only, no scheduled aggregation | FR-ANALYTICS |
| **Onboarding state persistence** | Refresh mid-onboarding loses progress (no server-side tracking) | FR-ONBOARD |
| **Prediction "updating" UI** | No loading state while recalculation job runs | FR-PRED |
| **Profile count TOCTOU** | No DB-level constraint preventing >6 profiles on concurrent requests | FR-PROFILE |
| **Webhook broadcast status** | SMS delivery reports don't propagate to admin broadcast view | FR-WEBHOOK |
| **Admin feedback replies** | Read-only view; no reply or resolve capability | FR-FEEDBACK |
| **Grace-period UI** | Countdown, warnings, auto-disable — all deferred to v2 per SRS | FR-BILL |

## UI/Accessibility (cross-cutting)

~190 findings across both apps — full file-by-file audits in `review/WEB-UI-REVIEW.md` and `review/ADMIN-UI-REVIEW.md`.

### Highest-leverage fixes

| Fix | Impact |
|-----|--------|
| **Button.tsx** — `focus-visible:ring-*` + remove `transition-all` | Fixes ~50 instances across both apps |
| **Input.tsx** — wire `htmlFor`/`id` | Fixes ~13 form label issues |
| **globals.css** — `prefers-reduced-motion` + `color-scheme: dark` | Fixes ~7 issues per app |
| **DataTable.tsx** (admin) — keyboard-accessible rows | Sortable headers + clickable rows unreachable via keyboard |
| **ContentClient.tsx** — DOMPurify sanitization | XSS risk (overlaps with P0 above) |

### Issue counts by category

| Priority | Issue | Count |
|----------|-------|-------|
| **High** | `transition-all` anti-pattern | ~55 |
| **High** | Missing `focus-visible:ring-*` on buttons | ~45 |
| **High** | Decorative icons missing `aria-hidden="true"` | ~45 |
| **Medium** | Form inputs without linked `<label>` | ~13 |
| **Medium** | Missing `aria-live="polite"` for async updates | ~12 |
| **Medium** | Hardcoded date/number formats (should use `Intl.*`) | ~18 |
| **Medium** | Modals missing `role="dialog"` + ESC-to-close | ~7 |
| **Medium** | Missing `color-scheme: dark` | 4 |
| **Medium** | Missing `prefers-reduced-motion` handling | ~7 |
| **Low** | Navigation buttons using `<button>` instead of `<Link>` | ~7 |
| **Low** | Missing `tabular-nums` on number displays | ~15 |
| **Low** | Placeholders not ending with `...` | ~6 |

---

## Shortest path to shippable

1. FR-ENC (field-level encryption) — P0 security blocker
2. DB migration + seed — unblocks admin login and all new models
3. ProfileCompletionModal wiring — one-line fix
4. DOMPurify on ContentClient — XSS fix
5. Button.tsx + Input.tsx a11y fixes — cascading impact across both apps
