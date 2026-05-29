---
name: ui-review-playwright
description: Automated UI review skill for the Vesta project. Uses the Playwright MCP server to navigate pages, capture screenshots at desktop and mobile viewports, and run accessibility snapshots. Checks every page against the project's Web Interface Guidelines and writes a findings report to review/AUTO-UI-REVIEW-{date}.md. Trigger when the user asks to "run a UI review", "review the UI with Playwright", "take screenshots and audit the app", or any variant thereof.
---

# Automated UI Review — Playwright MCP

This skill drives the Playwright MCP server to take screenshots, capture accessibility trees, and cross-reference source files to produce a timestamped UI review report at `review/AUTO-UI-REVIEW-{YYYY-MM-DD}.md`.

---

## Step 0 — Clarify Scope (ask before doing anything)

Ask the user these three questions (can be answered in one reply):

1. **Which app?** `web` (port 3000), `admin` (port 3001), or `both`
2. **Viewport depth?** `full` (desktop + mobile for every page) or `desktop-only`
3. **Review depth?** `full` (all pages listed below) or `quick` (public + auth pages only)

Record the answers. Default if the user says "just run it": both apps, full viewports, full review.

---

## Step 1 — Pre-flight Checks

Run these two curl checks in parallel:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 --max-time 3
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 --max-time 3
```

- If web is needed and returns non-2xx / times out → tell the user to run `just w` and wait for it to be ready.
- If admin is needed and returns non-2xx / times out → tell the user to run `just a`.
- If both are needed → `just wa`.
- Do not proceed until the relevant servers respond.

Also ensure the screenshots output directory exists:

```bash
mkdir -p /Volumes/KingstonFURYRenegade/Github/React/cycle-circle/review/screenshots
```

---

## Step 2 — Review Public Pages (no auth required)

For each public page in scope, execute this four-step sequence:

### Four-step page review sequence

1. **Navigate** — `browser_navigate` to the URL
2. **Desktop screenshot** — `browser_screenshot` (label: `{page}-desktop`)
   - Set viewport to 1440 × 900 before capturing
3. **Mobile screenshot** — resize to 390 × 844, then `browser_screenshot` (label: `{page}-mobile`)
   - Skip if user chose `desktop-only`
4. **Accessibility snapshot** — `browser_snapshot` to get the full accessibility tree

After capturing, immediately:
- Visually analyze the screenshot for layout issues, color contrast problems, and responsiveness
- Scan the a11y tree for missing roles, labels, and interactive element issues
- Read the corresponding source file(s) to find exact line numbers

### Web public pages (port 3000)

| Page | URL |
|------|-----|
| Login | `http://localhost:3000/login` |
| Email login | `http://localhost:3000/email-login` |
| Privacy | `http://localhost:3000/privacy` |
| Terms | `http://localhost:3000/terms` |

### Admin public pages (port 3001)

| Page | URL |
|------|-----|
| Login | `http://localhost:3001/login` |

---

## Step 3 — Authenticate

### Web App (port 3000)

Use the dev-mode login endpoint to set auth cookies without OTP:

```bash
curl -s -X POST http://localhost:3000/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"phone": "01700000000"}' \
  -c /tmp/vesta-web-cookies.txt
```

If that endpoint returns a non-2xx status, fall back to Playwright interaction:
1. `browser_navigate` to `http://localhost:3000/login`
2. `browser_type` into the phone input: `01700000000`
3. `browser_click` the submit/send-OTP button
4. If a dev-mode OTP appears in the UI or console, type it; otherwise check that the app auto-advances in dev mode
5. Confirm landing on `/dashboard` or `/onboarding`

### Admin App (port 3001)

1. `browser_navigate` to `http://localhost:3001/login`
2. `browser_type` into the email field: `admin@vesta.health`
3. `browser_type` into the password field: `admin123`
4. `browser_click` the login / submit button
5. Wait for redirect — confirm landing on the admin dashboard
6. If redirect does not happen within 3 seconds, take a screenshot and log the failure, then skip all admin protected pages

---

## Step 4 — Review Protected Pages

Apply the same four-step page review sequence from Step 2 to every protected page in scope.

### Web protected pages (port 3000)

| Page | URL | Key elements to note |
|------|-----|----------------------|
| Dashboard | `/dashboard` | Data cards, cycle prediction, charts |
| Calendar | `/calendar` | Calendar grid, date cells |
| Symptoms | `/symptoms` | Symptom chips/buttons, logging form |
| Content | `/content` | Article cards, list |
| Profiles | `/profiles` | Profile switcher, avatar |
| Settings | `/settings` | Form inputs, toggles, language switch |
| Feedback | `/feedback` | Textarea, submit button |
| Subscription | `/subscription` | Plan cards, CTA buttons |
| Onboarding | `/onboarding` | Multi-step wizard, progress indicator |

### Admin protected pages (port 3001)

| Page | URL | Key elements to note |
|------|-----|----------------------|
| Dashboard | `/` | Stats cards, trend charts (Recharts) |
| Users | `/users` | DataTable, search input, filters |
| Subscriptions | `/subscriptions` | Subscription list |
| Content list | `/content` | Article list |
| New content | `/content/new` | Tiptap rich-text editor, EN/BN tabs |
| Analytics | `/analytics` | Recharts dashboard, period selectors |
| SMS | `/sms` | Broadcast list |
| Feedback | `/feedback` | Feedback table |

**If a page fails to load or redirects unexpectedly:** log `[LOAD FAILURE] {url} — {reason}` in the report and continue to the next page.

---

## Step 5 — Source File Analysis

After completing all screenshots and a11y snapshots, use code-review-graph MCP tools (or Grep/Read as fallback) to trace findings to exact source lines:

1. `semantic_search_nodes` to locate component files for each page visited
2. Read the relevant component files looking for the patterns in the checklist below
3. Record file path + line number for every issue found

Parallelize independent page analyses using subagents when reviewing both apps.

---

## Step 6 — Review Checklist

Apply this checklist to every page's source files. Classify each finding by severity.

### Critical (must fix)

| ID | Check | What to look for |
|----|-------|-----------------|
| C1 | `transition-all` | Any `transition-all` in className strings — replace with specific properties (`transition-colors`, `transition-transform`, etc.) |
| C2 | Missing `focus-visible:ring-*` | Interactive elements (`<button>`, `<a>`, `<input>`, `<select>`, `<textarea>`) without a `focus-visible:ring-*` class or equivalent visible focus style |
| C3 | Decorative icon missing `aria-hidden` | Lucide icons or inline SVGs used as decorators without `aria-hidden="true"` |
| C4 | Icon-only button missing `aria-label` | `<button>` containing only an icon with no visible text and no `aria-label` |
| C5 | `<label>` not linked to input | `<label>` without matching `htmlFor` + `id` pair |
| C6 | `<div onClick>` for navigation | `<div onClick>` or `<span onClick>` that navigates — must be `<Link>` |
| C7 | `<div onClick>` for actions | `<div onClick>` or `<span onClick>` that triggers an action — must be `<button>` |
| C8 | Unsanitized `dangerouslySetInnerHTML` | `dangerouslySetInnerHTML` without DOMPurify or equivalent sanitization |
| C9 | Missing `aria-live` on async regions | Toast messages, loading state changes, error banners, success confirmations — must have `aria-live="polite"` (or `"assertive"` for errors) |

### Important

| ID | Check | What to look for |
|----|-------|-----------------|
| I1 | `focus:` instead of `focus-visible:` | `focus:ring-*`, `focus:outline-*` — prefer `focus-visible:` to avoid ring on mouse clicks |
| I2 | Missing `autocomplete` / `name` on form inputs | `<input>` and `<textarea>` without `autocomplete` and `name` attributes |
| I3 | Placeholder not ending with `…` | Placeholder text ending with `...` (three dots) instead of `…` (Unicode ellipsis U+2026) |
| I4 | Missing `spellCheck={false}` | `<input type="email">`, OTP inputs, username fields, code fields — should have `spellCheck={false}` |
| I5 | Responsive overflow | Content overflowing its container on mobile (390 px wide) — check screenshots |
| I6 | Color contrast | Text on background with insufficient contrast — use the screenshot + a11y tree |
| I7 | Keyboard inaccessibility | Interactive elements missing `tabIndex`, `role`, or `onKeyDown` handler for Enter/Space |
| I8 | Missing `role="dialog"` on modals | Modal/drawer overlays without `role="dialog"`, `aria-modal="true"`, and ESC-to-close |
| I9 | Missing `overscroll-behavior: contain` | Modal and drawer scroll containers without `overscroll-behavior: contain` |

### Nice to have

| ID | Check | What to look for |
|----|-------|-----------------|
| N1 | No `prefers-reduced-motion` | Animated components / `globals.css` keyframes without `@media (prefers-reduced-motion: reduce)` override |
| N2 | Missing `color-scheme: dark` | Dark-mode html element without `color-scheme: dark` |
| N3 | Missing `font-variant-numeric: tabular-nums` | Number columns, counters, timestamps without `tabular-nums` |
| N4 | Non-semantic interactive elements | `<div role="tab">` / `<div role="button">` where a native element would work |

---

## Step 7 — Write the Report

Create or overwrite `review/AUTO-UI-REVIEW-{YYYY-MM-DD}.md` (use today's date in ISO format).

### Report format

```markdown
# Auto UI Review — {Web App / Admin App / Both Apps}

> Generated: {YYYY-MM-DD}
> Method: Playwright MCP automated review
> Scope: {apps reviewed}
> Pages reviewed: {N}
> Screenshots: review/screenshots/

---

## 1. Core UI Components

\```
## apps/{app}/src/components/ui/Button.tsx

Button.tsx:LINE — [C2] no focus-visible:ring-* on base variant
Button.tsx:LINE — [C1] transition-all → use transition-colors

## apps/{app}/src/components/ui/Input.tsx

Input.tsx:LINE — [C5] <label> not linked via htmlFor/id
Input.tsx:LINE — [C1] transition-all → list specific properties
\```

---

## 2. Auth Pages

\```
## apps/{app}/src/app/(auth)/login/page.tsx

login/page.tsx:LINE — [C3] decorative phone icon missing aria-hidden="true"
login/page.tsx:LINE — [I2] phone input missing name="phone" autocomplete="tel"
\```

---

## 3. Main App Pages (Web)

\```
## apps/web/src/app/(main)/dashboard/DashboardClient.tsx

DashboardClient.tsx:LINE — [I3] placeholder ends with ... not …
\```

---

## 4. Admin Pages

\```
## apps/admin/src/app/(admin)/users/UsersClient.tsx

UsersClient.tsx:LINE — [C7] <div onClick> used for row action → use <button>
\```

---

## 5. Layouts and Navigation

\```
## apps/{app}/src/app/(main)/layout.tsx

layout.tsx:LINE — description
\```

---

## 6. Global Styles

\```
## apps/{app}/src/app/globals.css

globals.css:LINE — [C1] transition: all in .glass-hover
globals.css — [N1] no @media (prefers-reduced-motion: reduce) for animations
\```

---

## Load Failures

| URL | Reason |
|-----|--------|
| (none) | — |

---

## Summary

| Metric | Count |
|--------|-------|
| Pages reviewed | {N} |
| Critical issues | {N} |
| Important issues | {N} |
| Nice-to-have issues | {N} |
| **Total issues** | **{N}** |

### Comparison with previous review

{If review/WEB-UI-REVIEW.md or review/ADMIN-UI-REVIEW.md exist, count their issues and note:
"Previous manual review (YYYY-MM-DD) found X issues. This automated review found Y issues.
Delta: +Z new / -W resolved."}
```

---

## Step 8 — Wrap Up

1. Print the full path of the generated report.
2. List the screenshots saved to `review/screenshots/`.
3. Give a one-paragraph summary of the top 3 most impactful findings.
4. Ask the user: "Would you like me to fix any of these issues now?" — if yes, apply fixes following the project's UI/Accessibility Guidelines in `CLAUDE.md`.

---

## Implementation Notes

### Parallelism

When reviewing both apps or multiple independent pages, deploy parallel subagents:
- Assign the web-app pages to one subagent and admin pages to another.
- Each subagent runs its own Playwright + source-analysis loop.
- Merge findings before writing the report.

### Viewport management

Before each desktop screenshot set viewport to 1440 × 900.
Before each mobile screenshot set viewport to 390 × 844.
Always reset back to 1440 × 900 before navigating to the next page.

### Source file lookup priority

1. Use `semantic_search_nodes` in code-review-graph to locate the component.
2. If graph returns a result, use `get_review_context` to read the relevant lines.
3. Fall back to `Read` tool with the absolute path if the graph doesn't have it.
4. Never guess line numbers — read the file to confirm.

### Screenshot naming convention

Save screenshots as:
```
review/screenshots/{app}-{page-slug}-{viewport}.png
```

Examples:
- `web-login-desktop.png`
- `web-dashboard-mobile.png`
- `admin-users-desktop.png`

### Handling dev-only pages

If any page returns a 404 (feature not yet built), log it as `[NOT FOUND]` in the report and skip.

### Session continuity

At the end of the session, append a one-line entry to `.planning/STATE.md`:
```
{YYYY-MM-DD} — Automated UI review run. Report at review/AUTO-UI-REVIEW-{YYYY-MM-DD}.md. {N} issues found.
```
