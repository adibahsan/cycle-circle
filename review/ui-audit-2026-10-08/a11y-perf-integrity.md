# Audit: Accessibility (non-modal), Performance, Implementation Integrity (apps/web/src)

Scope: apps/web/src excluding app/internal/**. Modals covered by another auditor. Findings verified by reading code (line numbers current at branch feat/cycle-circle-rebrand).

### [P1] Keyboard focus styling missing on many links and buttons (no focus-visible ring, no global fallback)
- **Location:** `apps/web/src/app/(main)/layout.tsx:421,446,482,514,533,554,588`; `app/(auth)/login/page.tsx:189,214,216`; `app/(auth)/email-login/page.tsx:80,299`; `app/(auth)/verify-otp/page.tsx:322`; `app/(main)/calendar/CalendarClient.tsx:694,712`; `app/(main)/profiles/ProfilesClient.tsx:343,643`; `app/(main)/settings/SettingsClient.tsx:227,694,701,715,742,749,763,870,877`; `app/error.tsx:25,31`; `app/(main)/error.tsx:25,31`; `app/not-found.tsx:9`; `app/onboarding/OnboardingClient.tsx:501`; `components/PeriodLogModal.tsx:136`; `components/TrialExpiredLock.tsx:88`; `components/engagement/ConsistencyGrid.tsx:87`; `components/legal/ContactBlock.tsx:37,46`
- **Category:** Accessibility
- **Evidence:** `<button onClick={prevMonth} aria-label="Previous month" className="p-2 rounded-xl hover:bg-[...] transition-colors">` (CalendarClient.tsx:694); `<Link href="/profiles" className="flex items-center ... transition-colors">` (layout.tsx:421). `globals.css` has no `:focus-visible` rule (grep confirms none).
- **Impact:** ~37 interactive elements rely on the UA default outline. It is not removed, so not a total fail, but it is inconsistent with the rest of the app's themed ring and is low-contrast on dark glass/primary surfaces. The primary navigation (sidebar and bottom tabs, layout.tsx:446/482/533/588), the profile link, and the theme toggle are the most visible offenders.
- **Fix:** Add one global rule in globals.css (`:where(a,button,[role=button],summary):focus-visible { outline: 2px solid var(--goal-accent); outline-offset: 2px }`) so every interactive element has a token-based ring, then optionally delete per-element ring strings. Also add `focus-visible:ring-*` to the Button-less raw buttons listed.

### [P1] Settings contact inputs have no label or aria-label (placeholder only)
- **Location:** `apps/web/src/app/(main)/settings/SettingsClient.tsx:684-691` (email), `:732-739` (phone)
- **Category:** Accessibility
- **Evidence:** `<input type="email" name="email" autoComplete="email" placeholder={t('settings.emailInputPlaceholder')} .../>` with no `id`, `aria-label`, or `<label>`; phone is the same.
- **Impact:** Screen readers announce an unnamed edit field; placeholder disappears on input. Violates the `<label htmlFor>` must-follow rule.
- **Fix:** Add `aria-label={t('settings.email')}` / phone equivalent, or a visible/sr-only `<label htmlFor>` plus `id`. Also wire `aria-describedby` to the existing `role="alert"` error `<p>` (lines 708, 756).

### [P1] Hardcoded English in aria-labels, error messages and UI chrome bypasses i18n (Bengali users get English)
- **Location:** `apps/web/src/app/(auth)/layout.tsx:72-90` (desktop brand panel: "Smart cycle tracking with predictive insights...", "Period Tracking", "Predictions", "Insights"); `app/(auth)/login/page.tsx:65,71,120` ("Failed to send OTP...", "Dev mode...", "Enter your phone number to receive a one-time code"); `app/error.tsx:22-34` and `app/(main)/error.tsx:22-34` ("Something went wrong", "Try again"); `app/not-found.tsx:7,12`; `app/(main)/layout.tsx:426,538,516,557` ('Profile' fallback; "Switch to light/dark mode" aria-label while the visible text next to it is translated); `app/(main)/calendar/CalendarClient.tsx:230,277,419,451,463,696,714` (aria-labels "Previous month", "Close", "Previous page of period logs", "Add log for ..."); `app/(main)/symptoms/SymptomsClient.tsx:111,121,566,608`; `app/(main)/profiles/ProfilesClient.tsx:87,103,226,508-509,832,358,658`; `app/onboarding/OnboardingClient.tsx:105,163,177,497,499,592,606,1031`; `app/(main)/feedback/FeedbackClient.tsx:99,240`; `app/(main)/subscription/SubscriptionClient.tsx:87,417,535` ("Close dialog", "Go Pro"); `components/ui/LanguageToggle.tsx:19`; `components/PeriodLogModal.tsx:138`; `components/ProfileCompletionModal.tsx:159,223`; `components/TrialCountdownPill.tsx:427`; `app/(marketing)/layout.tsx:19` and `app/(auth)/layout.tsx:21` ("Toggle theme"); `app/(auth)/login/page.tsx:214-216` ("Privacy Policy", "Terms of Service"); `app/(main)/settings/SettingsClient.tsx:900`.
- **Category:** Accessibility
- **Evidence:** `aria-label="Previous month"` (CalendarClient.tsx:696); `<span ...>Period Tracking</span>` (auth/layout.tsx:82); `setError('Failed to send OTP. Please try again.')` (login/page.tsx:71).
- **Impact:** A BN-language user hears English from screen readers, sees English error text on the login screen, error boundary, and 404, and sees an English-only marketing panel on the desktop auth screen. This is the user's own bilingual-product promise.
- **Fix:** Move strings to `packages/shared/src/utils/i18n.ts` keys and use `t()`. Group by surface: auth layout, error boundaries, aria-label set (nav/close/prev/next/theme/language), validation errors.

### [P2] Two `<h1>` "Cycle Circle" wordmarks in main layout; page headings then compete, and auth sub-pages have no h1
- **Location:** `apps/web/src/app/(main)/layout.tsx:416,532`; every `*Client.tsx` that also renders `<h1>` (Calendar, Insights, Settings, Symptoms, Profiles, Content, Feedback, Subscription); `app/(auth)/email-login/page.tsx:105` and `app/(auth)/verify-otp/page.tsx:193` (only `<h2>`); `app/(main)/dashboard/DashboardClient.tsx:468` (h2, h3 only); `app/(auth)/login/page.tsx:96,114`
- **Category:** Accessibility
- **Evidence:** `<h1 className="text-xl font-extrabold ...">Cycle Circle</h1>` inside sidebar header and mobile header, rendered on every page.
- **Impact:** Pages that have their own h1 (e.g. Calendar) expose two h1s (the layout one is `display:none` on the other breakpoint, so one is always live); Dashboard has only the brand h1 and its page content starts at h2 (reasonable by accident); email-login and verify-otp have no h1 at all. Heading navigation is noisy/misleading. CalendarClient headings appear in order h3,h3,h1,h3 in source (day/detail panel h3 before the page h1 in the DOM).
- **Fix:** Make the layout wordmark a `<p>`/`<span>` (or `<div role="img">` via the logo's aria-label), keep exactly one page-level h1 per route (give Dashboard a sr-only/visible h1), promote email-login/verify-otp titles to h1, and keep h2→h3 order.

### [P2] Emoji used as functional icons, inconsistently with Lucide, often without aria-hidden
- **Location:** `apps/web/src/app/(main)/calendar/CalendarClient.tsx:291,299,307`; `app/(main)/dashboard/DashboardClient.tsx:543,572,720,792` (616 is aria-hidden, others are not); `app/(main)/content/ContentClient.tsx:35-39`; `app/(main)/settings/SettingsClient.tsx:524-525`; `app/(main)/profiles/ProfilesClient.tsx:36-41,527,1099,1153`; `app/onboarding/OnboardingClient.tsx:516,683`; `components/PeriodLogModal.tsx:202`; `app/(auth)/layout.tsx:81-89`; `app/(auth)/email-login/page.tsx:216`; `app/(auth)/login/page.tsx:131,154`; `app/(auth)/verify-otp/page.tsx:266`; `lib/symptoms-data.ts:13+`
- **Category:** Integrity
- **Evidence:** `🩸 {t('dashboard.logPeriod')}` (Dashboard:572); `<span>⚠</span>{error}` (login/page.tsx:154, verify-otp:266 — vs `<span aria-hidden="true">⚠</span>` in ProfileCompletionModal:303).
- **Impact:** Emoji render differently per OS (Android vs iOS vs Windows), do not take theme tokens (dark mode glyphs on tinted pills look off), vary in size/baseline alignment against Lucide icons used next to them, and read aloud ("drop of blood") before the real label. Error glyph ⚠ is sometimes aria-hidden and sometimes not.
- **Fix:** Decide a rule: Lucide for UI chrome and status (Droplet, Flower2, Sprout, Moon, Sun, AlertTriangle, Lock), emoji only for user-chosen content such as symptom/mood data. At minimum add `aria-hidden="true"` to every decorative emoji and ⚠ glyph.

### [P2] Framer-motion not globally reduced-motion aware; some JS animations ungated
- **Location:** `apps/web/src/app/(auth)/login/page.tsx:88-92` (infinite logo bob, no `useReducedMotion`); `app/(main)/subscription/SubscriptionClient.tsx:151-158` (infinite 360° spin, no gating); plus entrance variants without gating in `app/(main)/layout.tsx`, `app/(auth)/layout.tsx:66-70`, `login/page.tsx`, `email-login/page.tsx`, `verify-otp/page.tsx`; `components/Providers.tsx` (no `MotionConfig`)
- **Category:** Accessibility
- **Evidence:** `animate={{ y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity ... }}` (login:89-90). `grep MotionConfig|reducedMotion` returns nothing.
- **Impact:** The CSS `prefers-reduced-motion` block (globals.css:266) neutralizes CSS animations only; JS-driven transform animations keep running for users who asked for reduced motion. Most other infinite loops (Dashboard, Calendar, CenteredShell, Onboarding, Streak etc.) are properly gated, so this is a consistency gap rather than systemic.
- **Fix:** Wrap the app in `<MotionConfig reducedMotion="user">` in Providers.tsx (fixes all current and future cases in one line), then drop per-file gating where redundant.

### [P2] Off-token raw Tailwind palette colors (green, amber, emerald, rose) in user-facing UI; amber text may fail AA
- **Location:** `apps/web/src/app/(main)/subscription/SubscriptionClient.tsx:356` (`text-amber-600 text-xs` on card), `:367` (`bg-amber-100 ... text-amber-700`); `components/PeriodLogModal.tsx:218` (`bg-green-100 text-green-700 dark:...`); `app/(auth)/login/page.tsx:149` (`text-emerald-500`); `app/(marketing)/terms/page.tsx:100` (`text-amber-500`); `app/(marketing)/layout.tsx:18` and `app/(auth)/layout.tsx` toggle (`focus-visible:ring-rose-500`); `components/ui/BrandLogo.tsx:19` (`dark:bg-[#FFF7F8]`); `app/(main)/calendar/CalendarClient.tsx:669,676` (`rgba(232,71,108,0.07)` and `rgba(123,197,174,0.06)` = pre-rebrand colors, not the current `--color-primary #D02F58`)
- **Category:** Theming
- **Evidence:** `<p className="text-xs text-amber-600 dark:text-amber-400 font-semibold">` on `bg-card`
- **Impact:** `text-amber-600` (#D97706) on white is ~3.2:1 at 12px, which fails WCAG AA (4.5:1) in light mode. Others bypass the brand token set and will not follow future palette changes.
- **Fix:** Use existing semantic tokens (`--color-warning`/`--color-success`/`--color-fertile` + `on-*` pairs) or add them; replace the rgba values with `color-mix(in srgb, var(--color-primary) 7%, transparent)`.

### [P2] Dead components and a dead 293-line DatePicker
- **Location:** `apps/web/src/components/GoalBadge.tsx`, `components/ui/DatePicker.tsx`, `components/modals/LatePeriodPrompt.tsx` (no importers anywhere in apps/web, verified by grep). `LatePeriodFullScreenAlert` is the live sibling (imported in `(main)/layout.tsx:28`).
- **Category:** Integrity
- **Evidence:** `grep -rn "GoalBadge\|ui/DatePicker\|LatePeriodPrompt" src` returns only the files' own definitions.
- **Impact:** ~450 lines of unmaintained UI; LatePeriodPrompt duplicates LatePeriodFullScreenAlert (same infinite-pulse pattern) and will drift from the brand tokens; DatePicker is a hand-built date input whilst PeriodLogModal and ProfilesClient use native `<input type="date">`.
- **Fix:** Delete the three files (or document why each is kept). Consolidate on one late-period alert.

### [P2] Hand-rolled buttons, cards and pills diverge from `components/ui` primitives
- **Location:** Raw `<button>` counts: `ProfilesClient.tsx` (14), `SettingsClient.tsx` (11), `CalendarClient.tsx` (7), `OnboardingClient.tsx` (5), `SymptomsClient.tsx` (5), `ContentClient.tsx` (3), `ProfileCompletionTracker.tsx` (3). Hand-built card surface (`rounded-2xl bg-[var(--color-bg-card)] border ...`): `SettingsClient.tsx`, `SubscriptionClient.tsx` (x2), `GetStartedClient.tsx`, `components/onboarding/AccountControl.tsx`, `OnboardingTour.tsx`, five `loading.tsx` skeletons. Input primitive used only in Profiles/email-login/Onboarding/TrialCountdownPill; raw `<input>` with duplicated ~200-char class strings in `ProfileCompletionModal.tsx:288,336,399`, `SettingsClient.tsx:684,732`, `FeedbackClient.tsx:375`, `login/page.tsx:134`, `SubscriptionClient.tsx:578`. Only 5 of ~10 overlays use `ui/Modal` (`Settings` logout `:895`, `AccountControl:83`, `SubscriptionClient:83,531`, `TrialExpiredLock:51`, `ProfileCompletionModal:177`, `OnboardingTour:365`, `PeriodLogModal:104` roll their own overlay).
- **Category:** Integrity
- **Evidence:** `className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--color-on-accent)] bg-[var(--goal-accent)] disabled:opacity-50 transition-opacity"` (SettingsClient:696,744) — a Button `sm` variant without the shared ring, active scale, or radius (`rounded-lg` vs Button's `rounded-full`).
- **Impact:** Radius (full vs lg vs xl), padding and states differ between screens, which is one cause of the "sloppy / misaligned" look. Fixes to the primitives (focus ring, dark-mode) do not propagate. Overlay variants have different z-index, blur, and focus handling (see modal auditor).
- **Fix:** Extract Button variants `soft`/`chip`/`icon`, add an `IconButton` (required `aria-label`) and a `Pill`/`Chip`; use `Input`/`Textarea` primitive with `leftAdornment` for the phone prefix; route all overlays through `ui/Modal`.

### [P2] Page heavy `framer-motion` import surface: `motion/react` loaded in ~35 client files and layout; whole-page `'use client'` for static legal pages
- **Location:** `apps/web/src/app/(marketing)/terms/page.tsx:1`, `privacy/page.tsx` (entire page `'use client'` only for `useTranslation`); `app/(main)/layout.tsx` imports `motion/react` and 960-line clients: `ProfilesClient.tsx` (1193 lines), `OnboardingClient.tsx` (1104), `DashboardClient.tsx` (963), `SettingsClient.tsx` (935), `CalendarClient.tsx` (928); `InsightsClient.tsx:6-21` imports recharts statically (no `next/dynamic`)
- **Category:** Performance
- **Evidence:** `'use client'; import { useTranslation } from 'react-i18next'` (terms/page.tsx:1-4); `} from 'recharts'` (InsightsClient.tsx:21); `grep next/dynamic` finds only layout and Dashboard (4 and 1 uses).
- **Impact:** Recharts (~100 kB gz) ships in the Insights route bundle before charts are visible; legal pages hydrate a large tree for static text; mega-clients inflate route JS on low-end Android phones (target market).
- **Fix:** `dynamic(() => import('./InsightsCharts'), { ssr:false, loading: <Shimmer/> })` for the recharts blocks; split big clients into server shell plus small client islands; keep legal pages server components with a small `T` client wrapper or static i18n.

### [P2] Layout-property animation on progress bars and accordion
- **Location:** `apps/web/src/app/(main)/dashboard/DashboardClient.tsx:679-680,758-759`; `app/(auth)/verify-otp/page.tsx:251`; `components/ProfileCompletionTracker.tsx:569-571` (`height: 0 -> 'auto'`); CSS `transition-[width]` at `app/onboarding/OnboardingClient.tsx:450,473`, `components/onboarding/OnboardingTour.tsx:427`; `components/engagement` infinite `box-shadow` keyframes in `globals.css:249-261` (`attn-blink`)
- **Category:** Performance
- **Evidence:** `initial={{ width: 0 }} animate={{ width: `${...}%` }}`
- **Impact:** Triggers layout every frame; small elements so mostly a P2 on low-end phones, but `attn-blink` animates `box-shadow` (repaint) infinitely on dashboard buttons and CTAs.
- **Fix:** Use `scaleX` with `transform-origin:left` for bars; use `grid-template-rows: 0fr -> 1fr` or `AnimatePresence` + `layout` for the accordion; limit `attn-blink` to `opacity` on a pseudo-element ring.

### [P2] Heavy blur: `backdrop-filter: blur(16px)` on three fixed full-width chrome pieces plus `blur-3xl` orbs
- **Location:** `apps/web/src/app/globals.css:148-151` (`.glass`), used on `app/(main)/layout.tsx:412` (sidebar), `:529` (sticky mobile header), `:581` (fixed bottom nav); `components/onboarding/CenteredShell.tsx:16,30,44` (`blur-3xl` on 480px orbs, animated infinitely); `components/legal/LegalPageShell.tsx:29` (`backdrop-blur-md`); 7 overlays using `backdrop-blur-sm` on 100% viewport
- **Category:** Performance
- **Evidence:** `.glass { background: rgba(255,255,255,.8); backdrop-filter: blur(16px) ... }`
- **Impact:** Two always-on 16px blurs over scrolling content (header + bottom nav on mobile) are costly on mid/low-range Android GPUs and cause scroll jank; animated large `blur-3xl` layers repaint every frame.
- **Fix:** Because background is already 80-88% opaque, drop to `blur(8px)` or remove blur on mobile (`@media (max-width: 767px)`), and render orbs as static pre-blurred radial gradients (they already use a radial gradient) without `filter: blur`.

### [P3] Unoptimized `<img>` for logo with dark-mode disc hardcoded
- **Location:** `apps/web/src/components/ui/BrandLogo.tsx:14-20`
- **Category:** Performance
- **Evidence:** `<img src="/brand/cycle-circle-logo.svg" ... className="rounded-full dark:bg-[#FFF7F8] dark:p-2 ..." />` with `eslint-disable @next/next/no-img-element`
- **Impact:** SVG so `next/image` gains little; hardcoded hex bypasses tokens; `width/height` set so no CLS. Also two logo systems coexist: `BrandLogo` (auth, onboarding, hero) vs `VestaLogo` SVG (main layout, footer, legal), visually different marks in the same product.
- **Fix:** Keep `<img>` but replace hex with a token (e.g. `dark:bg-[var(--color-on-dark-disc)]`) and standardize on one logo component.

### [P3] Placeholder and form-attribute polish
- **Location:** `apps/web/src/app/(main)/settings/SettingsClient.tsx:736` (`01XXXXXXXXX` no ellipsis); `login/page.tsx:140` and `ProfileCompletionModal.tsx:332` (`01XXXXXXXXX…` — ellipsis on a format mask is odd); `ProfilesClient.tsx:358,658` ("e.g. Nusrat…" English, not translated); `OnboardingClient.tsx:592` ("Your name" no ellipsis, English); `SettingsClient.tsx:699,747` (`'...'` three dots for saving state); `components/ui/Input.tsx:21` (no default `name`/`autoComplete`; callers must pass); `ProfilesClient.tsx:476` date input lacks `name`; `login/page.tsx:154` `⚠` error not role=alert (has `aria-live` only, rendered conditionally, so it is not announced reliably); `verify-otp/page.tsx:259` and `FeedbackClient.tsx:399` error paragraphs have no `role="alert"`/`aria-live`
- **Category:** Accessibility
- **Evidence:** `{error && <p aria-live="polite" ...>` (login:154) — live regions inserted together with content are frequently not announced; the `Input` primitive correctly keeps an always-mounted `role="alert"` container.
- **Impact:** Minor inconsistency; error announcements on OTP/feedback/login are unreliable for screen readers.
- **Fix:** Use `…` consistently; keep an always-mounted `aria-live` wrapper and toggle its text; translate the placeholders; pass `name`/`autoComplete` through `Input` defaults by `type`.

### [P3] Decorative Lucide icons missing aria-hidden (27 occurrences)
- **Location:** `apps/web/src/app/(auth)/verify-otp/page.tsx:288`; `app/(main)/feedback/FeedbackClient.tsx:114`; `app/(main)/profiles/ProfilesClient.tsx:89,105,209,212,337,349,637,829,1067,1125`; `app/(main)/settings/SettingsClient.tsx:240,841,863`; `app/(main)/subscription/SubscriptionClient.tsx:109,157,178,384,394`; `app/onboarding/OnboardingClient.tsx:291,299,307,315,378,622,748`
- **Category:** Accessibility
- **Evidence:** `<X size={14} className="text-[var(--color-text-muted)]" />` inside a button that already has `aria-label` (ProfilesClient:349).
- **Impact:** Lucide SVGs are `aria-hidden` by default only from newer lucide-react versions when no title; the repo rule requires explicit marking; low real impact.
- **Fix:** Add `aria-hidden="true"` (ESLint rule or a thin `Icon` wrapper would stop recurrence).

### [P3] Very small text (`text-[10px]`/`[11px]`) in 48 places
- **Location:** `apps/web/src/app/(main)/content/ContentClient.tsx:141,155` (+4), `components/engagement/ConsistencyGrid.tsx:135,172` (+3), `SymptomsClient.tsx`, `ProfilesClient.tsx`, `FeedbackClient.tsx`, `DashboardClient.tsx` (3 each)
- **Category:** Accessibility
- **Evidence:** `text-[10px] font-bold uppercase tracking-wider`
- **Impact:** Hard to read on phones, especially Bengali glyphs, which have taller ascenders and need larger sizes; uppercase on Bengali is a no-op.
- **Fix:** Floor at 12px (`text-xs`); drop `uppercase` for BN text.

## Systemic patterns
1. **Primitives exist but are bypassed.** `Button`/`Card`/`Input` are used for primary CTAs, but secondary actions, chips, inputs and overlays are re-implemented inline with long duplicated class strings (radius/padding/focus drift). Fixing the primitives does not fix the app.
2. **No global baseline.** No global `:focus-visible`, no `MotionConfig reducedMotion="user"`, no ESLint guard for `aria-hidden`/`aria-label` literals. Each rule is applied per-element, so coverage is patchy (focus rings and aria-hidden are about 80% present, which makes the gaps hard to notice).
3. **i18n applied to visible copy but not to chrome.** aria-labels, error fallbacks, the auth marketing panel, error boundaries and placeholders are English-only.
4. **Token drift.** Most inline styles are tokenized (good), but a handful of raw palette colors, hex values and pre-rebrand rgba literals survive, and emoji are used as icons in about 20 places.
5. **Heavy-visual defaults on mobile.** Full-width 16px backdrop blur on two fixed bars, animated blur-3xl orbs, and many infinite JS loops make low-end Android the weakest target.

## What's working
- Landmarks and nav labels are solid: `<aside aria-label>`, two labelled `<nav>`s, `<main>`, `<header>`; icon-only buttons almost universally have aria-labels; `<html lang>` is updated on language change (Providers.tsx:16).
- `Input` primitive has proper label/id pairing, `aria-invalid`, `aria-describedby` and an always-mounted `role="alert"` region.
- No `transition-all` outside app/internal; no `<div onClick>`; no `<img>` other than BrandLogo; `dangerouslySetInnerHTML` is used once, with DOMPurify-sanitized HTML (ContentClient.tsx:202, sanitizedBody* upstream).
- Most infinite framer-motion loops and decorative orbs are gated by `useReducedMotion`, and the CSS animation classes plus the attn-blink halo have reduced-motion fallbacks (globals.css:266-275, 291).
- Heavy modules are code-split where it counts (OnboardingTour, TrialExpiredLock, ProfileCompletionModal, TodayCheckInModal dynamic; `xlsx` is dynamically imported in Settings; fonts via `next/font`).
- Inline `style={{}}` objects are almost entirely token-based (`var(--color-*)`, `color-mix`), with only a handful of raw hex values in the whole web app.
- Phone/email inputs on login, settings and subscription carry `autoComplete`, `inputMode`, and `spellCheck={false}`.
