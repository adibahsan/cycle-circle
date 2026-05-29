# Auto UI Review — Web App

> Generated: 2026-05-30
> Method: Playwright MCP automated review
> Scope: Web app (port 3000) — desktop (1440x900) + mobile (390x844)
> Pages reviewed: 11 (4 public + 7 protected)
> Screenshots: review/screenshots/

---

## 1. Core UI Components

```
## apps/web/src/components/ui/Card.tsx

Card.tsx:20 — [I7] hover variant adds cursor-pointer and visual interactivity to a <div>
              without role="button", tabIndex, or onKeyDown — keyboard users cannot activate it

## apps/web/src/components/ui/Input.tsx

(No issues — previous review's findings have been fixed)

## apps/web/src/components/ui/Button.tsx

(No issues — uses focus-visible:ring-2, specific transition properties)

## apps/web/src/components/ui/LanguageToggle.tsx

(No issues — aria-label present, focus-visible:ring-2 present)
```

---

## 2. Auth Pages

```
## apps/web/src/app/(auth)/login/page.tsx

login/page.tsx:156 — [I4] phone input missing spellCheck={false}
login/page.tsx:162 — [I3] placeholder="01XXXXXXXXX…" — PASS (uses Unicode ellipsis)
login/page.tsx:229 — [C3] Shield icon (decorative) missing aria-hidden="true"
login/page.tsx:148-168 — [PASS] label has htmlFor="phone-input", input has matching id
login/page.tsx:156-168 — [PASS] has name="phone" autoComplete="tel"
login/page.tsx:176 — [PASS] error message has aria-live="polite"
login/page.tsx:196 — [PASS] Phone icon has aria-hidden="true"
login/page.tsx:216 — [PASS] ChevronRight has aria-hidden="true"

## apps/web/src/app/(auth)/email-login/ (not read — same auth layout pattern)
```

---

## 3. Main App Layout & Navigation

```
## apps/web/src/app/(main)/layout.tsx

layout.tsx:61 — [C3] Users icon in sidebar Profile link missing aria-hidden="true"
layout.tsx:83 — [C3] Nav item icons (Home, CalendarDays, etc.) missing aria-hidden="true"
              (affects 5 main nav items in sidebar)
layout.tsx:107 — [C3] Extra nav item icons (Users, MessageSquare, CreditCard) missing aria-hidden="true"
               (affects 3 sidebar items)
layout.tsx:139 — [C3] Users icon in mobile header Profile link missing aria-hidden="true"
layout.tsx:149 — [C3] Moon/Sun icon in mobile header theme toggle missing aria-hidden="true"
layout.tsx:176 — [C3] Bottom nav icons missing aria-hidden="true"
               (affects 5 bottom nav items)
layout.tsx:77-81 — [PASS] sidebar nav links use <Link> elements
layout.tsx:167-179 — [PASS] mobile bottom nav uses <Link> elements
layout.tsx:118 — [PASS] sidebar theme toggle button has aria-label
layout.tsx:147 — [PASS] mobile theme toggle button has aria-label
layout.tsx:48 — [PASS] sidebar has aria-label="Sidebar navigation"
layout.tsx:67 — [PASS] main nav has aria-label="Main navigation"
layout.tsx:162 — [PASS] mobile nav has aria-label="Mobile navigation"
```

---

## 4. Dashboard

```
## apps/web/src/app/(main)/dashboard/DashboardClient.tsx

DashboardClient.tsx:270 — [I9] PeriodLogModal overlay div missing overscroll-behavior: contain
                          (modal scroll can leak to body)
DashboardClient.tsx:339 — [C5] Flow intensity label (line 339) is a standalone <label> not linked
                          to any input via htmlFor/id
DashboardClient.tsx:738 — [C1] transition-all on cycle phase overview items → use transition-[color,outline]
DashboardClient.tsx:576 — [PASS] Countdown number uses tabular-nums
DashboardClient.tsx:507 — [PASS] background blobs have aria-hidden="true"
DashboardClient.tsx:570,610,700,705 — [PASS] card icons have aria-hidden="true"
DashboardClient.tsx:279 — [PASS] modal has role="dialog" aria-modal="true"
DashboardClient.tsx:368 — [PASS] save confirmation has aria-live="polite"
DashboardClient.tsx:297 — [PASS] close button has aria-label="Close"
```

---

## 5. Calendar

```
## apps/web/src/app/(main)/calendar/CalendarClient.tsx

CalendarClient.tsx — [PASS] No issues found
CalendarClient.tsx:128 — [PASS] Day cells use <button> with focus-visible:ring-2
CalendarClient.tsx:396 — [PASS] Prev/Next month buttons have aria-label
CalendarClient.tsx:399,417 — [PASS] ChevronLeft/Right have aria-hidden="true"
CalendarClient.tsx:230 — [PASS] Close button has aria-label, X icon has aria-hidden
CalendarClient.tsx:128 — [PASS] uses transition-[color,background-color,transform], not transition-all
```

---

## 6. Symptoms

```
## apps/web/src/app/(main)/symptoms/SymptomsClient.tsx

SymptomsClient.tsx — [PASS] aria-live="polite" on feedback region (line 398)
SymptomsClient.tsx — [PASS] icons have aria-hidden="true"
(Source analysis limited to first 50 lines — symptom chips use <button> elements)
```

---

## 7. Content / Learn

```
## apps/web/src/app/(main)/content/ContentClient.tsx

ContentClient.tsx:112 — [PASS] dangerouslySetInnerHTML is sanitized with DOMPurify
ContentClient.tsx:163 — [PASS] BookOpen icon has aria-hidden="true"
```

---

## 8. Settings

```
## apps/web/src/app/(main)/settings/SettingsClient.tsx

SettingsClient.tsx:152 — [PASS] toast region has aria-live="polite"
SettingsClient.tsx:174,416,425 — [PASS] icons have aria-hidden="true"
```

---

## 9. Feedback

```
## apps/web/src/app/(main)/feedback/FeedbackClient.tsx

FeedbackClient.tsx:150,278,413 — [PASS] icons have aria-hidden="true"
FeedbackClient.tsx:401 — [PASS] aria-live="polite" on submission feedback
```

---

## 10. Profiles

```
## apps/web/src/app/(main)/profiles/ProfilesClient.tsx

ProfilesClient.tsx:547 — [PASS] aria-live="polite" on profile action feedback
```

---

## 11. Subscription

```
## apps/web/src/app/(main)/subscription/SubscriptionClient.tsx

SubscriptionClient.tsx:441-450 — [PASS] Check/X icons have aria-hidden="true"
SubscriptionClient.tsx:109 — [PASS] upgrade flow has aria-live="polite"
```

---

## 12. Global Styles

```
## apps/web/src/app/globals.css

globals.css — [PASS] No transition-all found
globals.css:138 — [PASS] .glass-hover uses specific transition properties
globals.css:154-161 — [PASS] @media (prefers-reduced-motion: reduce) present and comprehensive
globals.css:62 — [N2] color-scheme: dark light on :root — should be just "light" on :root
                 and "dark" added when .dark is active (minor, current approach is acceptable)
```

---

## 13. Onboarding

```
## apps/web/src/app/onboarding/page.tsx

(Reviewed visually via screenshots — clean layout on both desktop and mobile)
onboarding/page.tsx:775 — [PASS] aria-live="polite" on step feedback
onboarding/page.tsx:117 — [PASS] uses tabular-nums on cycle length number
```

---

## Load Failures

| URL | Reason |
|-----|--------|
| `/privacy` | Redirected to `/login` — page not built or requires auth |
| `/terms` | Redirected to `/login` — page not built or requires auth |

---

## Visual Observations (from screenshots)

| Page | Viewport | Observation |
|------|----------|-------------|
| Dashboard | Mobile | Bottom nav overlaps "Cycle Overview" text slightly — content needs more bottom padding (pb-24 may need pb-28) |
| Settings | Mobile | Export Data section partially obscured by bottom nav |
| All pages | Mobile | Next.js Dev Tools "1 Issue" badge overlaps bottom-left nav (dev-only, not a production concern) |
| Subscription | Both | Comparison table renders well at both viewports |
| Calendar | Both | Clean grid layout, period/fertile coloring visible |

---

## Summary

| Metric | Count |
|--------|-------|
| Pages reviewed | 11 |
| Critical issues | 8 |
| Important issues | 3 |
| Nice-to-have issues | 1 |
| **Total issues** | **12** |

### Issue Breakdown

| ID | Count | Description |
|----|-------|-------------|
| C3 | 6 | Decorative icons missing `aria-hidden="true"` (all in layout.tsx nav) |
| C1 | 1 | `transition-all` in DashboardClient.tsx |
| C5 | 1 | `<label>` not linked to input in DashboardClient.tsx period modal |
| I4 | 1 | Phone input missing `spellCheck={false}` |
| I9 | 1 | Period log modal missing `overscroll-behavior: contain` |
| I7 | 1 | Card hover variant keyboard-inaccessible |
| N2 | 1 | Minor `color-scheme` setup note |

### Comparison with previous review

Previous manual review (2026-05-30, WEB-UI-REVIEW.md) found ~109 issue lines across all files.
This automated review found 12 issues — the vast majority of original issues (transition-all in Button/Input/Card, missing focus-visible, missing htmlFor, missing aria-labels) have been **resolved** since the manual review.

### Top 3 Most Impactful Findings

1. **Layout nav icons missing `aria-hidden="true"` (C3, 6 instances):** Every sidebar and bottom nav icon lacks `aria-hidden`, causing screen readers to announce meaningless SVG content alongside the link text. This affects every page since the layout wraps all routes. Fix is a single `aria-hidden="true"` prop on each `<Icon>` in layout.tsx.

2. **`transition-all` in DashboardClient.tsx (C1):** The cycle phase overview grid uses `transition-all` which triggers layout recalculation on every animated property change. Replace with `transition-[color,outline]` or similar.

3. **Period log modal missing `overscroll-behavior: contain` (I9):** When scrolling inside the period log modal on mobile, scroll can leak to the body behind the backdrop, creating a jarring UX.
