# Email-trial live countdown + OTP-verified phone to keep access

_Plan — 2026-06-29_

## Context

Email-only login grants a **24-hour trial** (`User.authMethod='EMAIL'` + `subscriptionStatus='FREE'`
+ `emailTrialExpiresAt` set once, 24h out). When it expires, the full-screen
`TrialExpiredLock` blocks the whole app (except `/subscription`). Today there is
**no live countdown** during the active trial (only a static "Xh remaining" on the
subscription page), and **adding a phone number does nothing to the trial** — only
upgrading to PRO removes the lock.

**Goal (from the user):** while the email trial is active, show a **live per-second
countdown** in a **compact header pill** on every page, prompting the user to add
their mobile number. Tapping it opens an **inline phone-entry → SMS OTP verify**
flow; on success the phone is saved and the trial is cleared so the account is
kept.

### Decisions (confirmed with the user)
| Question | Answer |
|---|---|
| Placement | **Compact header pill**, every page (top nav) |
| Interaction | **Inline** phone entry (popover/modal), not a navigation |
| Effect of adding phone | **Keeps access** (clears the trial) |
| Verification | **OTP flow required** (SMS code) |
| Resulting tier | **Default: keep FREE, clear trial** — see "Tier decision" below |

### Tier decision (confirmed: PRO)
On a successful OTP verification the account is **upgraded to PRO**:
`emailTrialExpiresAt = null` **and** `subscriptionStatus = 'PRO'` (consistent with
OTP sign-ups, which are auto-PRO). The pill/lock both disappear because the trial
no longer applies (`getTrialStatus` returns `'none'` once status ≠ `FREE`).

---

## Part 1 — Backend: authenticated "add + OTP-verify phone" flow

Two new **authenticated** routes (`withAuth`), reusing existing helpers. We do NOT
reuse the login verify route because its `completeOtpAuth` upserts an OTP/PRO user
and issues a new JWT — wrong for an already-logged-in email user.

**`POST /api/user/phone/request`** (`apps/web/src/app/api/user/phone/request/route.ts`)
- `withAuth` (allow active trial; this runs during the trial).
- Body `{ phone }` (Zod). `validateMsisdn(phone)` → normalized `+880…`.
- **Pre-check uniqueness** (better UX than wasting an SMS): `prisma.user.findUnique({ where: { phone } })`; if found and `id !== user.id` → `ApiError(409, …, 'PHONE_TAKEN')`.
- Reuse `getOtpResendCooldownRemaining(phone)` (60s, 429 `OTP_COOLDOWN`) and
  `checkRateLimit('otp:'+phone, 3, 60)` (429 `RATE_LIMITED`).
- DEV (`isDevModeEnabled()`): `referenceNo = 'dev-'+crypto.randomUUID()`, no SMS.
  PROD: `requestOtp(phone)` → BDApps → `referenceNo`.
- `createOtpChallenge(phone, referenceNo, new Date(Date.now()+5*60*1000))`.
- Return `{ referenceNo }`.

**`POST /api/user/phone/verify`** (`apps/web/src/app/api/user/phone/verify/route.ts`)
- `withAuth`. Body `{ referenceNo, otp }` (Zod).
- `checkRateLimit('otp:verify:'+referenceNo, 5, 300)`.
- `findOtpChallenge(referenceNo)` → guards: 404 `CHALLENGE_NOT_FOUND`, 400
  `ALREADY_VERIFIED`, 400 `CHALLENGE_EXPIRED` (mirror the login verify route).
- DEV: `DEV_OTP_CODES.includes(otp)`; PROD: `verifyOtp(referenceNo, otp)`.
- `prisma.otpChallenge.update({ where: { id }, data: { verified: true, userId: user.id } })`.
- Persist via new shared service (Part 2). Catch Prisma `P2002` → `ApiError(409, …, 'PHONE_TAKEN')`.
- **Do NOT** call `completeOtpAuth` / `issueJwt` / `setAuthCookie`.
- Return `{ ok: true }`.

Both routes return the standard `{ error: { message, code } }` envelope via `handleApiError`.

## Part 2 — Shared: persist + trial helper

`packages/shared/src/server/services/user-service.ts` — new function:
```ts
// Save a verified phone and upgrade the account to PRO (clears the email trial).
export async function keepAccountWithVerifiedPhone(userId: string, phone: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { phone, emailTrialExpiresAt: null, subscriptionStatus: 'PRO' },
  })
}
```
Export it from the services barrel.

`packages/shared/src/utils/trial.ts` — add a millisecond-precision helper for the
per-second countdown (keep existing `getTrialStatus`/`getTrialHoursLeft`):
```ts
export function getTrialMsLeft(u: TrialUser): number | null {
  if (getTrialStatus(u) !== 'active' || !u.emailTrialExpiresAt) return null
  return Math.max(0, new Date(u.emailTrialExpiresAt).getTime() - Date.now())
}
```

## Part 3 — Client: header countdown pill + inline OTP

**New component** `apps/web/src/components/TrialCountdownPill.tsx` (`'use client'`):
- Props: `{ trialUser, onPhoneAdded }`. Renders only when `getTrialStatus(trialUser) === 'active'`.
- **Live countdown:** `setInterval(…, 1000)` computing `HH:MM:SS` from
  `getTrialMsLeft`; `clearInterval` on unmount; `tabular-nums`; an `⏳` icon
  (`aria-hidden`). When it reaches 0, stop and let the layout's existing
  `TrialExpiredLock` take over (no extra logic — the pill stops rendering once
  status flips to `expired`). The pill itself is a `<button>` (it opens the dialog).
- **Inline OTP dialog** (reuse the `Modal` primitive — `role="dialog"`, `aria-modal`,
  ESC-to-close, focus ring, `overscroll-behavior:contain` per project UI rules):
  - Step 1 — phone input (`type=tel`, `inputMode=numeric`, `01XXXXXXXXX`,
    `autocomplete=tel`) → `POST /api/user/phone/request` → stores `referenceNo`.
  - Step 2 — 6-box code entry mirroring `verify-otp/page.tsx` (auto-advance, paste,
    backspace), a **60s resend countdown** (reuse that page's `setTimeout` pattern),
    and a `POST /api/user/phone/verify`. In dev, show a hint that `420420` works.
  - On success: toast (`aria-live="polite"`), call `onPhoneAdded()`, close dialog.
- Errors surfaced from the route codes: `OTP_COOLDOWN`, `RATE_LIMITED`,
  `PHONE_TAKEN` (409), invalid/expired code → mapped to i18n strings.

**Wire into the layout** `apps/web/src/app/(main)/layout.tsx`:
- Render `<TrialCountdownPill trialUser={trialUser} onPhoneAdded={…} />` in the top
  header/nav area (next to the existing controls), guarded by `authStatusLoaded`.
- `onPhoneAdded` updates the existing `trialUser` state:
  `setTrialUser(prev => prev ? { ...prev, emailTrialExpiresAt: null } : prev)` →
  status becomes `'none'` → pill hides, no lock. (Optionally `router.refresh()`.)

## Part 4 — i18n (EN + BN)

Add a `trial` namespace block to **both** `en.translation` and `bn.translation` in
`packages/shared/src/utils/i18n.ts` (inline objects), e.g.:
`trial.countdownLabel` ("Trial ends in"), `trial.addNumberCta` ("Add number"),
`trial.dialogTitle`, `trial.dialogBody` ("Add & verify your mobile number to keep
your account."), `trial.phonePlaceholder`, `trial.sendCode`, `trial.enterCode`,
`trial.verify`, `trial.resend` / `trial.resendIn`, `trial.success`,
and errors `trial.err.cooldown` / `.rateLimited` / `.phoneTaken` / `.invalidCode`.

## Part 5 — Tests

- Unit-test `getTrialMsLeft` (active → positive ms; expired/none → null) alongside
  the existing `apps/web/__tests__/utils/trial.test.ts`.
- Keep the suite green (currently **252**). The new routes are integration-style;
  if a lightweight service test fits the existing mock harness, add one for
  `keepAccountWithVerifiedPhone` (clears `emailTrialExpiresAt`).

## Out of scope
- No Prisma schema change (reuses `OtpChallenge`, `User.phone`, `emailTrialExpiresAt`).
- The Settings / Subscription unverified add-phone paths are left as-is (could be
  upgraded to OTP later; not required here).
- No change to `TrialExpiredLock` or the post-expiry behavior.

## Verification
1. `pnpm --filter @vesta/web exec tsc --noEmit`, `pnpm --filter @vesta/shared exec tsc --noEmit -p tsconfig.json`
   (only the 2 pre-existing `simulator/checker.ts` errors), `pnpm --filter @vesta/web exec vitest run`.
2. Manual (dev, Mailpit up): magic-link login as a fresh email → land in app with the
   **pill ticking down every second**. Tap → enter a new phone → request (dev: no SMS)
   → enter `420420` → verify → pill disappears, toast shown; DB shows `phone` set and
   `emailTrialExpiresAt = NULL`; no `TrialExpiredLock`. Re-check: using an existing
   user's phone (e.g. `+8801712345678`) → `PHONE_TAKEN` (409). Rapid re-request →
   `OTP_COOLDOWN` / `RATE_LIMITED`.

## Commits (one task each)
1. `feat(web): authenticated add+OTP-verify phone routes (keep account, clear trial)`
2. `feat(web): live email-trial countdown pill with inline OTP add-number flow`
3. `chore(i18n): trial countdown + verify strings (EN/BN)`
