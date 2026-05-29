# Admin App — Web Interface Guidelines Review

> Generated: 2026-05-30
> Source: [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines)
> Scope: `apps/admin/src/` — all client components, UI primitives, layouts, login page

---

## Core UI Components (affect every page)

```
## src/components/ui/Button.tsx

Button.tsx:26 — transition-all → list specific properties
Button.tsx:26 — no focus-visible:ring-* visible focus style

## src/components/ui/Card.tsx

Card.tsx:19 — transition-all on hoverable variant
Card.tsx:19 — hoverable card is <div> with no keyboard handler; if clickable use <button>

## src/components/ui/Input.tsx

Input.tsx:31 — focus:outline-none with focus:ring-2 replacement (acceptable)
Input.tsx:32 — transition-all → list specific properties
Input.tsx:25 — no enforced autocomplete or name attributes

## src/components/ui/DataTable.tsx

DataTable.tsx:68 — sortable <th> uses onClick but not <button>, no onKeyDown/tabIndex
DataTable.tsx:68 — sortable <th> no visible focus style
DataTable.tsx:125-126 — clickable <tr> uses onClick but no role/tabIndex/onKeyDown

## src/components/ui/Pagination.tsx

Pagination.tsx:41 — <select> has no <label> or aria-label ("Rows per page:" not linked)
Pagination.tsx:44 — transition-all on <select>
Pagination.tsx:56-63 — prev-page button missing focus-visible:ring-*
Pagination.tsx:78-89 — page number buttons missing focus-visible:ring-*
Pagination.tsx:93-104 — next-page button missing focus-visible:ring-*

## src/components/ui/FilterBar.tsx

FilterBar.tsx:46 — search input missing aria-label or <label>
FilterBar.tsx:46 — search input missing name and autocomplete
FilterBar.tsx:51 — transition-all on search input
FilterBar.tsx:68 — transition-all on filter <select>

## src/components/ui/ConfirmModal.tsx

ConfirmModal.tsx:51-53 — modal overlay missing overscroll-behavior: contain
ConfirmModal.tsx:60 — backdrop <div onClick> not a <button>
ConfirmModal.tsx:69 — focus:outline-none on dialog card without focus replacement ring

## src/components/ui/StatCard.tsx

✓ pass (decorative icons have aria-hidden="true")

## src/components/ui/Badge.tsx

✓ pass

## src/components/ui/Shimmer.tsx

✓ pass

## src/components/ui/VestaLogo.tsx

✓ pass (aria-label and role="img" present)

## src/components/Providers.tsx

Providers.tsx:10 — sets .dark class but not color-scheme: dark on <html>

## src/app/globals.css

globals.css:134 — transition: all 0.3s in .glass-hover
globals.css:96-131 — animations missing @media (prefers-reduced-motion: reduce)
globals.css — no color-scheme: dark declaration
```

## Login Page

```
## src/app/login/page.tsx

login/page.tsx:70 — email input missing name attribute
login/page.tsx:70 — email input missing spellCheck={false}
login/page.tsx:78 — placeholder doesn't end with ...
login/page.tsx:80 — focus:outline-none without focus-visible: replacement
login/page.tsx:89 — password input missing name attribute
login/page.tsx:95 — placeholder doesn't end with ...
login/page.tsx:97 — focus:outline-none without focus-visible: replacement
login/page.tsx:102 — error container missing role="alert" or aria-live="polite"
login/page.tsx:109 — submit disabled when fields empty → keep enabled, validate on submit
login/page.tsx:110 — transition-all
```

## Layout

```
## src/app/layout.tsx

layout.tsx:19 — missing color-scheme: dark handling on <html>

## src/app/(admin)/layout.tsx

layout.tsx:72-73 — sidebar collapse toggle missing focus-visible:ring-*
layout.tsx:81 — <nav> missing aria-label
layout.tsx:95 — nav links missing focus-visible:ring-*
layout.tsx:122-128 — theme toggle icon-only when collapsed, uses title but no aria-label
layout.tsx:135-140 — logout button icon-only when collapsed, no aria-label
layout.tsx:153 — transition-all duration-300 on sidebar
layout.tsx:161-168 — mobile overlay <div onClick> → should be <button> or have keyboard handler
layout.tsx:172-175 — mobile drawer missing role="dialog" and aria-label
layout.tsx:186 — close menu button missing focus-visible:ring-*
layout.tsx:200 — mobile nav links missing focus-visible:ring-*
layout.tsx:237 — open menu button missing focus-visible:ring-*
layout.tsx:251 — mobile theme toggle missing focus-visible:ring-*
```

## Dashboard

```
## src/app/(admin)/DashboardClient.tsx

DashboardClient.tsx:38 — hardcoded 'en-US' locale in formatDate → use Intl with user locale
DashboardClient.tsx:116-117,128-129 — decorative icons missing aria-hidden="true"
DashboardClient.tsx:121,131,142 — number values missing font-variant-numeric: tabular-nums
```

## Users

```
## src/app/(admin)/users/UsersClient.tsx

UsersClient.tsx:55-62 — formatDate hardcoded 'en-US' locale
UsersClient.tsx:68,97,102,163 — decorative icons missing aria-hidden="true"
UsersClient.tsx:124,144-145,153-155 — number/date columns missing tabular-nums
UsersClient.tsx:248 — DataTable onRowClick keyboard accessibility unverified

## src/app/(admin)/users/[id]/UserDetailClient.tsx

UserDetailClient.tsx:114-121 — formatDate/formatDateTime hardcoded 'en-US' locale
UserDetailClient.tsx:151,197,267,353,384,401,530,535,541,545,550,626,635 — decorative icons missing aria-hidden="true" (13 instances)
UserDetailClient.tsx:502-508 — back button missing focus-visible:ring-*
UserDetailClient.tsx:625-629 — error banner missing aria-live/role="alert"
UserDetailClient.tsx:644,648,654 — numeric values missing tabular-nums
UserDetailClient.tsx:662-674 — tab buttons missing focus-visible:ring-*
UserDetailClient.tsx:665 — transition-all on tab buttons
UserDetailClient.tsx:447 — tab state not reflected in URL
```

## Subscriptions

```
## src/app/(admin)/subscriptions/SubscriptionsClient.tsx

SubscriptionsClient.tsx:71-78 — formatDate hardcoded 'en-US' locale
SubscriptionsClient.tsx:80-84 — formatAmount uses .toFixed(2) → use Intl.NumberFormat
SubscriptionsClient.tsx:212,219,250,288,342 — decorative icons missing aria-hidden="true"
SubscriptionsClient.tsx:236,247 — number columns missing tabular-nums
SubscriptionsClient.tsx:351-353 — FilterBar renders noop search input (does nothing)
```

## Content / CMS

```
## src/app/(admin)/content/ContentClient.tsx

ContentClient.tsx:202-212 — edit icon button has title but missing aria-label
ContentClient.tsx:213-221 — delete icon button has title but missing aria-label
ContentClient.tsx:224 — ChevronRight icon missing aria-hidden="true"
ContentClient.tsx:202-221 — icon buttons missing focus-visible:ring-*

## src/app/(admin)/content/new/ArticleEditorClient.tsx

ArticleEditorClient.tsx:125-131,133-144 — <label> not associated with <input> (missing htmlFor/id)
ArticleEditorClient.tsx:126-131,139-144 — inputs missing name and autocomplete
ArticleEditorClient.tsx:130,143,211,241,263 — transition-all (5 instances)
ArticleEditorClient.tsx:238-249 — <select> missing associated <label>
ArticleEditorClient.tsx:86-93 — "Back to Content" button navigates → should be <Link>
ArticleEditorClient.tsx:86-93,207-229,283-289 — buttons missing focus-visible:ring-*
ArticleEditorClient.tsx:106-109 — error message missing aria-live="polite"
ArticleEditorClient.tsx:82-308 — no unsaved-changes warning before navigation

## src/app/(admin)/content/[id]/EditArticleClient.tsx

EditArticleClient.tsx:146-154,158-168 — <label> not associated with <input>
EditArticleClient.tsx:149-154,163-168 — inputs missing name and autocomplete
EditArticleClient.tsx:154,167,235,265,287 — transition-all (5 instances)
EditArticleClient.tsx:262-273 — <select> missing associated <label>
EditArticleClient.tsx:103-109 — "Back to Content" navigates → should be <Link>
EditArticleClient.tsx:103-109,231-253,307-313 — buttons missing focus-visible:ring-*
EditArticleClient.tsx:130-133 — error message missing aria-live="polite"
EditArticleClient.tsx:113 — "Saved!" confirmation missing aria-live="polite"
EditArticleClient.tsx:99-357 — no unsaved-changes warning before navigation

## src/components/TiptapEditor.tsx

TiptapEditor.tsx:23-37 — toolbar buttons are icon-only, have title but missing aria-label
TiptapEditor.tsx:29 — transition-all on toolbar buttons
TiptapEditor.tsx:23-37 — toolbar buttons missing focus-visible:ring-*
TiptapEditor.tsx:74 — transition-all on container
TiptapEditor.tsx:76 — toolbar <div> should use role="toolbar" with aria-label
TiptapEditor.tsx:195-199 — EditorContent missing aria-label or aria-labelledby
```

## Analytics

```
## src/app/(admin)/analytics/AnalyticsClient.tsx

AnalyticsClient.tsx:370 — hardcoded 'en-US' locale in toLocaleDateString
AnalyticsClient.tsx:501,511-513 — retention rate numbers missing tabular-nums
```

## SMS

```
## src/app/(admin)/sms/SmsClient.tsx

SmsClient.tsx:62-69 — formatDate hardcoded 'en-US' locale
SmsClient.tsx:137 — modal overlay missing overscroll-behavior: contain
SmsClient.tsx:190 — transition-all on textarea
SmsClient.tsx:190 — textarea missing name attribute
SmsClient.tsx:218 — transition-all on datetime input
SmsClient.tsx:218 — datetime input missing name and autocomplete
SmsClient.tsx:365-369,375-377,384-386 — number columns missing tabular-nums
```

## Feedback

```
## src/app/(admin)/feedback/FeedbackClient.tsx

FeedbackClient.tsx:86-90 — formatDate hardcoded 'en-US' locale
FeedbackClient.tsx:111 — focus:outline-none with no focus replacement
FeedbackClient.tsx:194 — truncated email may need min-w-0 on flex parent
```

## Error / Loading

```
## src/app/(admin)/error.tsx

error.tsx:50 — "Try again" button missing focus-visible:ring-*
error.tsx:50 — transition-all
error.tsx:36 — <h2> with no <h1> on page (heading hierarchy)

## src/app/(admin)/loading.tsx

loading.tsx:5 — spinner missing role="status" and aria-label="Loading"
loading.tsx:6 — animate-pulse should honor prefers-reduced-motion
```

---

## Summary by Severity

| Priority | Issue | Count |
|----------|-------|-------|
| **High** | `transition-all` anti-pattern | ~25 |
| **High** | Missing `focus-visible:ring-*` on buttons | ~20 |
| **High** | Decorative icons missing `aria-hidden="true"` | ~25 |
| **High** | DataTable: sortable `<th>` + clickable `<tr>` not keyboard-accessible | 2 |
| **Medium** | Form inputs without linked `<label>` (htmlFor/id) | 8 |
| **Medium** | Missing `aria-live="polite"` for async updates | 5 |
| **Medium** | Hardcoded `'en-US'` date/number formats | ~8 |
| **Medium** | Missing `color-scheme: dark` | 2 |
| **Medium** | Missing `prefers-reduced-motion` handling | 2 |
| **Medium** | No unsaved-changes warning on CMS editor pages | 2 |
| **Medium** | Modal a11y: missing `role="dialog"`, `overscroll-behavior` | 3 |
| **Low** | Navigation buttons using `<button>` instead of `<Link>` | 3 |
| **Low** | Missing `tabular-nums` on number displays | ~12 |
| **Low** | Placeholders not ending with `...` | 3 |
| **Low** | Noop search input in SubscriptionsClient FilterBar | 1 |

### Highest-Impact Fixes

1. **Button.tsx** — add `focus-visible:ring-*`, replace `transition-all` → fixes ~20 focus + ~25 transition issues globally
2. **DataTable.tsx** — make sortable headers and clickable rows keyboard-accessible (`<button>` in `<th>`, `tabIndex`+`onKeyDown` on `<tr>`)
3. **Input.tsx** — add `id` prop, wire `htmlFor` in callers → fixes 8+ label association issues
4. **globals.css** — add `@media (prefers-reduced-motion: reduce)`, `color-scheme: dark`
5. **FilterBar.tsx/Pagination.tsx** — add `aria-label` to search input, link "Rows per page" `<label>`
6. **ArticleEditorClient + EditArticleClient** — add `beforeunload` unsaved-changes guard
7. **TiptapEditor.tsx** — add `role="toolbar"`, `aria-label` on toolbar, `aria-label` on each icon button
