# Web App — Web Interface Guidelines Review

> Generated: 2026-05-30
> Source: [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines)
> Scope: `apps/web/src/` — all client components, UI primitives, layouts, auth pages

---

## Core UI Components (affect every page)

```
## src/components/ui/Button.tsx

Button.tsx:16 — transition-all → list specific properties
Button.tsx:16 — no focus-visible:ring-* visible focus style

## src/components/ui/Input.tsx

Input.tsx:15 — <label> not linked to input (missing htmlFor/id)
Input.tsx:23 — focus:outline-none → use focus-visible: instead of focus:
Input.tsx:24 — transition-all → list specific properties

## src/components/ui/Card.tsx

Card.tsx:20 — transition-all on hover variant
Card.tsx:20 — hover variant makes <div> look interactive without role/tabIndex/keyboard

## src/components/ui/LanguageToggle.tsx

LanguageToggle.tsx:17 — missing aria-label on button
LanguageToggle.tsx:19 — no focus-visible:ring-*

## src/components/ui/Shimmer.tsx

Shimmer.tsx:4 — decorative element missing aria-hidden="true"

## src/components/ui/VestaLogo.tsx

VestaLogo.tsx:103-110 — animated logo doesn't honor prefers-reduced-motion

## src/components/Providers.tsx

Providers.tsx:11 — sets .dark class but not color-scheme: dark on <html>

## src/app/globals.css

globals.css:135 — transition: all 0.3s in .glass-hover
globals.css — missing @media (prefers-reduced-motion: reduce) for all animations
globals.css — no color-scheme: dark declaration
```

## Auth Pages

```
## src/app/(auth)/login/page.tsx

login/page.tsx:156 — phone input missing name and autocomplete="tel"
login/page.tsx:159 — placeholder doesn't end with ...
login/page.tsx:163 — transition-all
login/page.tsx:169 — decorative SVG missing aria-hidden="true"
login/page.tsx:173 — error region missing aria-live="polite"
login/page.tsx:185 — spinner SVG missing aria-hidden="true"
login/page.tsx:193 — decorative icon missing aria-hidden="true"
login/page.tsx:208-214 — button with onClick navigates → should be <Link>
login/page.tsx:232-233 — "Privacy Policy"/"Terms" are <span> → should be <Link>

## src/app/(auth)/email-login/page.tsx

email-login/page.tsx:74-84 — motion.button for navigation back → should be <Link>
email-login/page.tsx:82 — ArrowLeft icon missing aria-hidden="true"
email-login/page.tsx:148 — label not associated with input via htmlFor
email-login/page.tsx:162 — spinner SVG missing aria-hidden="true"
email-login/page.tsx:170 — Sparkles icon missing aria-hidden="true"
email-login/page.tsx:276 — button missing focus-visible:ring-*
email-login/page.tsx:297-302 — button for navigation → should be <Link>

## src/app/(auth)/verify-otp/page.tsx

verify-otp/page.tsx:167-177 — back button missing focus-visible:ring-*
verify-otp/page.tsx:175 — ArrowLeft icon missing aria-hidden="true"
verify-otp/page.tsx:230-244 — OTP inputs missing name and autocomplete="one-time-code"
verify-otp/page.tsx:240 — transition-all
verify-otp/page.tsx:303 — spinner SVG missing aria-hidden="true"
verify-otp/page.tsx:338 — spinner SVG missing aria-hidden="true"
verify-otp/page.tsx:350 — RefreshCw icon missing aria-hidden="true"

## src/app/(auth)/layout.tsx

layout.tsx:19 — transition-all on theme toggle
```

## Main Layout

```
## src/app/(main)/layout.tsx

layout.tsx:48 — sidebar <aside> missing aria-label
layout.tsx:67 — desktop nav missing aria-label
layout.tsx:116-122 — theme toggle button missing aria-label
layout.tsx:161 — mobile bottom nav missing aria-label

## src/app/layout.tsx

layout.tsx:26 — <html> missing color-scheme for dark mode
```

## Dashboard

```
## src/app/(main)/dashboard/DashboardClient.tsx

DashboardClient.tsx:267 — modal backdrop is <div onClick> → use <dialog> or role="dialog"
DashboardClient.tsx:289-294 — close button (X icon) missing aria-label
DashboardClient.tsx:302-308 — date input missing name, label not linked via htmlFor
DashboardClient.tsx:307 — focus:outline-none without full focus replacement
DashboardClient.tsx:315-323 — end date input same issues
DashboardClient.tsx:336 — transition-all on flow buttons
DashboardClient.tsx:363-364 — "Saved" confirmation missing aria-live="polite"
DashboardClient.tsx:498-499 — blob animations don't honor prefers-reduced-motion
DashboardClient.tsx:557,598,689 — decorative icons missing aria-hidden="true"
DashboardClient.tsx:582,605 — hardcoded date format → use Intl.DateTimeFormat
DashboardClient.tsx:564 — countdown number missing tabular-nums
DashboardClient.tsx:686 — <Link> wrapping <button> (nested interactive)
```

## Calendar

```
## src/app/(main)/calendar/CalendarClient.tsx

CalendarClient.tsx:127 — transition-all on day cells
CalendarClient.tsx:224-228 — close button (X) missing aria-label
CalendarClient.tsx:389-393 — prev-month button missing aria-label
CalendarClient.tsx:406-410 — next-month button missing aria-label
CalendarClient.tsx:393,409,228 — decorative icons missing aria-hidden="true"
CalendarClient.tsx:164,217,403,501,511 — hardcoded date formats → Intl.DateTimeFormat
CalendarClient.tsx:370-378 — blob animations don't honor prefers-reduced-motion
CalendarClient.tsx:147 — pulse animation doesn't honor prefers-reduced-motion
```

## Content

```
## src/app/(main)/content/ContentClient.tsx

ContentClient.tsx:109-111 — dangerouslySetInnerHTML XSS risk (article body)
ContentClient.tsx:139 — transition-all on filter tabs
ContentClient.tsx:161-162 — BookOpen icon missing aria-hidden="true"
ContentClient.tsx:209 — ChevronRight icon missing aria-hidden="true"
ContentClient.tsx:79,139,174 — buttons missing focus-visible:ring-*
```

## Feedback

```
## src/app/(main)/feedback/FeedbackClient.tsx

FeedbackClient.tsx:109 — focus:outline-none on star buttons without focus-visible replacement
FeedbackClient.tsx:143-150 — Star icons missing aria-hidden="true"
FeedbackClient.tsx:276,335 — decorative icons missing aria-hidden="true"
FeedbackClient.tsx:303,377 — transition-all
FeedbackClient.tsx:371 — textarea uses <p> as label → needs <label> or aria-label
FeedbackClient.tsx:408 — spinner missing aria-hidden="true" and aria-live
```

## Symptoms

```
## src/app/(main)/symptoms/SymptomsClient.tsx

SymptomsClient.tsx:143 — transition-all on symptom chips
SymptomsClient.tsx:167,414 — decorative checkmark SVGs missing aria-hidden="true"
SymptomsClient.tsx:278-279 — date strip no keyboard navigation
SymptomsClient.tsx:302-344 — category tabs missing role="tablist"/role="tab"/aria-selected
SymptomsClient.tsx:388-469 — summary bar updates missing aria-live="polite"
SymptomsClient.tsx:87,122,321 — buttons missing focus-visible:ring-*
```

## Profiles

```
## src/app/(main)/profiles/ProfilesClient.tsx

ProfilesClient.tsx:68,84,122,330,435,596 — transition-all (6 instances)
ProfilesClient.tsx:69,85,122,202,294,327,433,596 — buttons missing focus-visible:ring-*
ProfilesClient.tsx:306 — placeholder doesn't end with ...
ProfilesClient.tsx:398-443 — delete dialog missing role="dialog", aria-modal, ESC-to-close
ProfilesClient.tsx:544-560 — toast missing aria-live="polite"
```

## Settings

```
## src/app/(main)/settings/SettingsClient.tsx

SettingsClient.tsx:81 — transition-all on segmented control
SettingsClient.tsx:78-96 — segmented buttons missing focus-visible:ring-* and role="radio"
SettingsClient.tsx:112 — toggle aria-label uses internal key ("periodAlert") not human-readable
SettingsClient.tsx:148-163 — toast stack missing aria-live="polite"
SettingsClient.tsx:169-170 — decorative icon missing aria-hidden="true"
SettingsClient.tsx:407,417 — transition-all on export buttons
```

## Subscription

```
## src/app/(main)/subscription/SubscriptionClient.tsx

SubscriptionClient.tsx:77-221 — modal missing role="dialog", aria-modal, ESC-to-close
SubscriptionClient.tsx:88 — backdrop <div onClick> needs keyboard alternative
SubscriptionClient.tsx:92 — modal missing overscroll-behavior: contain
SubscriptionClient.tsx:149-215 — loading/success/error states missing aria-live
SubscriptionClient.tsx:382-387 — transition-all on upgrade button
SubscriptionClient.tsx:431-445 — check/X icons missing aria-hidden="true"
```

## Onboarding

```
## src/app/onboarding/page.tsx

onboarding/page.tsx:109,124,253,431 — transition-all (4 instances)
onboarding/page.tsx:448 — input label not linked via htmlFor
onboarding/page.tsx:521 — toLocaleDateString hydration mismatch risk
onboarding/page.tsx:776 — error region missing aria-live="polite"
onboarding/page.tsx:850 — back button missing aria-label
```

---

## Summary by Severity

| Priority | Issue | Count |
|----------|-------|-------|
| **Critical** | `dangerouslySetInnerHTML` XSS risk | 1 |
| **High** | `transition-all` anti-pattern | ~30 |
| **High** | Missing `focus-visible:ring-*` on buttons | ~25 |
| **High** | Decorative icons missing `aria-hidden="true"` | ~20 |
| **Medium** | Modals missing `role="dialog"` + ESC-to-close | 4 |
| **Medium** | Form inputs without linked `<label>` | 5 |
| **Medium** | Missing `aria-live="polite"` for async updates | 7 |
| **Medium** | Hardcoded date formats (should use `Intl.*`) | ~10 |
| **Medium** | Missing `color-scheme: dark` | 2 |
| **Medium** | Missing `prefers-reduced-motion` handling | 5 |
| **Low** | Navigation buttons using `<button>` instead of `<Link>` | 4 |
| **Low** | Missing `tabular-nums` on number displays | 3 |
| **Low** | Placeholders not ending with `...` | 3 |

### Highest-Impact Fixes

1. **Button.tsx** — add `focus-visible:ring-*`, replace `transition-all` → fixes ~25 focus + ~30 transition issues globally
2. **Input.tsx** — link `<label>` via `htmlFor`/`id` → fixes 5+ form association issues
3. **globals.css** — add `@media (prefers-reduced-motion: reduce)`, `color-scheme: dark`
4. **ContentClient.tsx** — sanitize HTML before `dangerouslySetInnerHTML` (use DOMPurify)
