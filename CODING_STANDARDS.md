# Coding standards

Applied at review time: reviewers check changed code against this file.

Both apps share the same UI primitives (`Button`, `Input`, `Card`, etc.) and `globals.css`. When writing or modifying frontend code, follow these rules.

## Must-follow rules

- **No `transition-all`** — list specific properties (`transition-colors`, `transition-transform`)
- **`focus-visible:ring-*`** on every interactive element — never remove outline without visible replacement
- **`aria-hidden="true"`** on decorative icons (Lucide icons used as visual indicators)
- **`aria-label`** on icon-only buttons (icon + no visible text = needs label)
- **`<label htmlFor>`** linked to inputs via matching `id` — labels must be clickable
- **`aria-live="polite"`** on regions that update asynchronously (toasts, confirmations, errors)
- **`<Link>`** for navigation, `<button>` for actions — never `<div onClick>` for either
- **Sanitize HTML** before `dangerouslySetInnerHTML` (use DOMPurify or equivalent)
- **`role="dialog"` + `aria-modal` + ESC-to-close** on all modal/drawer overlays
- **`overscroll-behavior: contain`** inside modals and drawers

## Prefer

- `focus-visible:` over `focus:` (avoids focus ring on mouse click)
- `Intl.DateTimeFormat` / `Intl.NumberFormat` over hardcoded locale strings
- `font-variant-numeric: tabular-nums` on number columns and counters
- `@media (prefers-reduced-motion: reduce)` to disable/reduce animations
- `color-scheme: dark` on `<html>` when dark theme is active
- Semantic HTML (`<dialog>`, `<nav aria-label>`, `role="tablist"`) before custom ARIA
- Placeholders ending with `…` (ellipsis character, not three dots)
- `autocomplete` and `name` on all form inputs
- `spellCheck={false}` on emails, codes, usernames

## Review documents

Full file-by-file audits with line numbers are in `review/`:
- `review/WEB-UI-REVIEW.md` — web app audit (2026-05-30)
- `review/ADMIN-UI-REVIEW.md` — admin app audit (2026-05-30)
- `review/FIX-PLAN.md` — architecture migration plan (2026-05-29)

## E2E tests

Once the e2e package is on main, read `e2e/REVIEW.md` before writing or reviewing E2E tests.

- After submitting a dialog in E2E, wait for it to close before the next action that opens one. Use `submitDialog()` from `e2e/support/dialogs.ts`; the list row can render a moment before the dialog closes, and the next open would reuse the old dialog. (Reviewer judgement.)
