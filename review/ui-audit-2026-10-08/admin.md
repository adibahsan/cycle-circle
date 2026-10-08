# Admin app UI audit (apps/admin/src)

Scope: theming and dark mode, layout consistency, responsive, modals, accessibility, integrity.
Method: static code reading, with contrast ratios computed by hand from the tokens in `apps/admin/src/app/globals.css`. Nothing was run in a browser.
Previous audit: `review/ADMIN-UI-REVIEW.md` (2026-05-30). Its status is at the end.

Token drift: the `@theme` and `.dark` blocks in `apps/admin/src/app/globals.css` match the web tokens I compared (lines 1-80). The drift is in components, not in the tokens.

---

## Findings

### [P1] Dark mode is applied after hydration, with no pre-paint script (flash of light theme on every load)
- **Location:** `apps/admin/src/components/Providers.tsx:9-12`, `apps/admin/src/lib/store.ts:11-20`, `apps/admin/src/app/layout.tsx:31`
- **Category:** Theming
- **Evidence:** `useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark') ... }, [theme])`. The theme is a zustand `persist` store defaulting to `'light'`, and `<html>` has no `dark` class or inline bootstrap script.
- **Impact:** Every full load for a dark-mode admin paints the light theme first (white page, then a flip to dark). `<html suppressHydrationWarning>` hides the mismatch. The theme also ignores `prefers-color-scheme` on first visit. This is a likely source of "looks bad in dark mode".
- **Fix:** Inject a blocking inline script in `<head>` that reads `localStorage['vesta-admin-store']` (and falls back to `matchMedia`) and sets `class="dark"` and `style.colorScheme` before first paint. Keep the effect only for runtime toggles.

### [P1] Email preview page is a light-only island: hard-coded white and gray cards with theme text on top
- **Location:** `apps/admin/src/app/(admin)/emails/preview/EmailPreviewClient.tsx:36,49,81,92-93,106,115-116,120,132`
- **Category:** Theming
- **Evidence:** `className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-100"`, `border-gray-200 bg-gray-50`, `bg-white text-[var(--color-text-primary)]`, `text-gray-500/400`
- **Impact:** In dark mode the control and preview cards are bright white. The labels use `--color-text-secondary` (#D6CBD0) and the active toggle uses `--color-text-primary` (#F7EEF0) on `bg-white`, so they are effectively invisible (about 1.4:1). The card shape (`rounded-lg`, `ring-gray-100`, no `glass`) also differs from every other admin card (`rounded-2xl`, `border-[var(--color-border)]`). Gray text on white fails AA in light too (`gray-400` is about 2.5:1).
- **Fix:** Use the standard card recipe (`glass rounded-2xl border border-[var(--color-border)] shadow-soft` or `<Card>`). Replace `gray-*` with `--color-text-*` and `--color-bg-secondary/border`. Only the iframe stage, which shows the email, may stay white.

### [P1] Modals and drawer: no focus trap, no scroll lock, no focus return, and an unusable hidden drawer
- **Location:** `apps/admin/src/components/ui/ConfirmModal.tsx:31-57`, `apps/admin/src/app/(admin)/sms/SmsClient.tsx:119-142,195-201`, `apps/admin/src/app/(admin)/content/ContentClient.tsx:445-451`, `apps/admin/src/app/(admin)/layout.tsx:206-226`
- **Category:** Modal
- **Evidence:** ConfirmModal comment says "Trap focus when open", but the code only calls `dialogRef.current?.focus()` and restores focus on close. There is no Tab containment. A grep for `body.style|inert|overflow-hidden` finds no scroll lock anywhere in admin. The mobile drawer is always rendered (`role="dialog" aria-modal="true"`, hidden only by `-translate-x-full`).
- **Impact:**
  - Tab escapes into the page behind every dialog.
  - The page behind scrolls under the backdrop (wheel and touch).
  - The closed mobile drawer stays in the accessibility tree and tab order. Its 12 off-screen links and buttons are focusable, and it is announced as a modal dialog.
  - The drawer has no Escape-to-close, no focus move on open, and no focus return.
  - The SMS modal and category manager restore no focus on close. SMS focuses the textarea via a 50 ms `setTimeout`.
- **Fix:**
  - Build one shared `Modal` primitive (native `<dialog>.showModal()` or a focus-trap hook) with initial focus, Tab trap, focus return, Escape, and a body scroll lock. Use it for ConfirmModal, CreateBroadcastModal, and the category manager.
  - For the drawer, render only while open, or add `inert` and `aria-hidden` plus `visibility:hidden` when closed. Add Escape handling and focus management.

### [P1] Escape in the date picker also closes the whole SMS modal; picker popover is clipped by the modal
- **Location:** `apps/admin/src/components/ui/DateTimePicker.tsx:94-109,225-231` and `apps/admin/src/app/(admin)/sms/SmsClient.tsx:135-142,210,325,385`
- **Category:** Modal
- **Evidence:** Both the picker and the modal add `document.addEventListener('keydown', ...)` for Escape, with no `stopPropagation`. The picker popover is `absolute z-50 w-[20rem]` inside the modal card `max-h-[90vh] overflow-y-auto`.
- **Impact:** Pressing Escape to dismiss the calendar closes the broadcast modal and discards the typed message. The popover is also clipped or forces inner scrolling at the card edge, worse on short phone viewports.
- **Fix:** In the picker's Escape handler call `e.stopPropagation()` (or `stopImmediatePropagation`) and `preventDefault`. Better, have the modal ignore Escape when `e.defaultPrevented`. Render the popover in a portal, or use a bottom-sheet pattern on phones.

### [P1] Category-manager dialog has no Escape handling at all
- **Location:** `apps/admin/src/app/(admin)/content/ContentClient.tsx:445-478`
- **Category:** Modal / Accessibility
- **Evidence:** The `role="dialog" aria-modal="true"` wrapper has no keydown handler. The only `Escape` in the file (line 544) cancels an inline rename.
- **Impact:** The only dismissals are the X and Close buttons (both disabled while saving). It breaks the CLAUDE.md rule "ESC-to-close on all modal/drawer overlays". It also has no initial focus and no focus return.
- **Fix:** Use the shared modal primitive from the finding above.

### [P1] `focus-visible:ring-offset-2` paints a white gap in dark mode (47 uses)
- **Location:** `apps/admin/src/components/ui/Button.tsx:26`, `apps/admin/src/app/(admin)/layout.tsx:88,110,141,155,236,250,287,301`, `apps/admin/src/components/ui/Pagination.tsx:125,172,196,226`, `apps/admin/src/app/login/page.tsx`, `apps/admin/src/components/TiptapEditor.tsx:29`, plus 11 more files (47 occurrences in 16 files)
- **Category:** Theming
- **Evidence:** `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]`. A grep for `ring-offset-color` finds no override in admin, so Tailwind v4's default `--tw-ring-offset-color` (#fff) applies.
- **Impact:** In dark mode, keyboard focus on buttons, nav links, pagination and similar controls shows a 2px bright white halo between the control and the pink ring. It looks like a rendering bug on the dark navy surface.
- **Fix:** Set the offset color once, e.g. `* { --tw-ring-offset-color: var(--color-bg-primary) }` in `@layer base`, or drop the offsets. Do not fix it per element.

### [P1] Semantic status colors use raw Tailwind palette steps, failing AA in dark (red/emerald) and light (emerald/amber/orange)
- **Location:** `apps/admin/src/app/(admin)/DashboardClient.tsx:120,132,139`; `apps/admin/src/components/ui/StatCard.tsx:34-35`; `apps/admin/src/app/(admin)/sms/SmsClient.tsx:290,398,571,580,619`; `apps/admin/src/app/(admin)/emails/[id]/EmailDetailClient.tsx:176,187`; `apps/admin/src/app/(admin)/content/ContentClient.tsx:556,582`; `apps/admin/src/components/ui/Select.tsx:175,251`; `apps/admin/src/app/(admin)/subscriptions/SubscriptionsClient.tsx:281`; `apps/admin/src/app/(admin)/users/[id]/UserDetailClient.tsx:525`; `apps/admin/src/app/(admin)/content/new/ArticleEditorClient.tsx:35-36,205`; `apps/admin/src/app/(admin)/content/[id]/EditArticleClient.tsx:49-50,209`
- **Category:** Theming / Accessibility
- **Evidence:** `text-red-500` and `text-red-600` with no `dark:` variant (Dashboard, EmailDetail, Content, Select); `text-emerald-600` with no `dark:` variant (Dashboard, Sms); `text-amber-600` (light); `text-orange-600`.
- **Impact:** Computed contrast on #1F2731 (dark card): red-600 about 3.0:1, red-500 and emerald-600 about 4.0:1. Those are text-sm or text-xs error and growth text, so they fail 4.5:1. On white (light): emerald-600 is about 3.8:1 (growth %, delivered count, "Published" pill), amber-600 about 3.2:1 (grace-period text, "Admin Override", the character-count warning), and orange-600 about 3.6:1 (Ovulation label). The Dashboard growth tile has no dark variant at all. The rebrand contract says "never introduce raw colors, use `--color-error`".
- **Fix:** Define status tokens (e.g. `--color-success`, `--color-warning-ink`, and reuse `--color-error`) with light and dark values, and use them instead of palette steps. Always pair them with an icon or text. As a quick fix use `text-emerald-700 dark:text-emerald-400`, `text-amber-700 dark:text-amber-400`, and `text-red-700 dark:text-red-400`.

### [P2] Active nav item and "primary text on a primary tint" fall below 4.5:1 in light
- **Location:** `apps/admin/src/app/(admin)/layout.tsx:114,252`; `apps/admin/src/components/ui/Select.tsx:232`; `apps/admin/src/components/TiptapEditor.tsx:31`; `apps/admin/src/app/login/page.tsx:128`
- **Category:** Theming / Accessibility
- **Evidence:** `bg-[var(--color-primary)]/10 text-[var(--color-primary)]` (also `/15`, and `/8` on the login error). This is text-sm semibold, not large text.
- **Impact:** #D02F58 on the 10% tint (about #FAEAEE) is about 4.2:1. The brand contract only allows primary text on `bg-card` and `bg-primary`. The active sidebar item, the hovered or active Select option, the active toolbar button and the login error all fail AA in light. They are fine in dark.
- **Fix:** Put the active label in `--color-text-primary` and mark the state with the tint, a left border, and a heavier icon stroke. The login error should use `--color-error` with an icon.

### [P2] Mobile drawer lacks focus-visible rings, an `aria-label`, and clear dark-mode separation
- **Location:** `apps/admin/src/app/(admin)/layout.tsx:242,263-276,207-215,219-226`
- **Category:** Accessibility / Modal
- **Evidence:**
  - The drawer `<nav className="flex-1 ...">` has no `aria-label`, while the desktop one does (line 96).
  - The theme and sign-out buttons (lines 265, 270) have no `focus-visible:` classes.
  - The drawer uses `.glass`, which is `rgba(20,26,33,.88)` in dark (`globals.css:151-154`).
- **Impact:** Keyboard users get no focus indicator on the two footer buttons. In dark mode the drawer is almost the same color as the page, so the backdrop scrim is the only separation.
- **Fix:** Reuse `SidebarContent` for the drawer instead of a second hand-copied nav. That removes the drift and fixes all three at once.

### [P2] Collapsed desktop sidebar header overflows its 64px rail
- **Location:** `apps/admin/src/app/(admin)/layout.tsx:72-93,190-192`
- **Category:** Layout / Responsive
- **Evidence:** The header class is `px-4 ... ${collapsed ? 'justify-center px-3' : ''}`, so both `px-4` and `px-3` apply and Tailwind emits `px-4` later. The rail is `md:w-16` (64px). It holds the 28px logo, a `gap-3` (12px), and a 28px toggle button.
- **Impact:** About 31-39px of content width is available for 68px of content. The collapse toggle spills out of the rail over the border and into the main content area, or crowds the logo. The collapsed state looks broken.
- **Fix:** When collapsed, stack the logo and toggle vertically (`flex-col`), or hide the logo. Use one conditional padding class, not two.

### [P2] Duplicate `<h1>` on every desktop admin page
- **Location:** `apps/admin/src/app/(admin)/layout.tsx:80` plus `apps/admin/src/components/ui/AdminPageHeader.tsx:16`
- **Category:** Accessibility
- **Evidence:** The sidebar renders `<h1>Cycle Circle Admin</h1>` on desktop; the page renders its own `<h1>`. On mobile the logo text is a `<span>`, so only the page h1 exists.
- **Impact:** Two h1s on every page. Screen-reader heading navigation lists the brand first.
- **Fix:** Make the sidebar brand a `<p>` or `<span>`.

### [P2] Three competing card surface recipes; in dark mode the `glass` panels disappear into the page
- **Location:** `apps/admin/src/components/ui/Card.tsx:12-26` (used in only 4 files). There are 32 hand-written `glass rounded-2xl` blocks, e.g. `apps/admin/src/app/(admin)/DashboardClient.tsx:91,106,121`, plus 6 or more `rounded-2xl bg-[var(--color-bg-card)] p-5` blocks in `apps/admin/src/app/(admin)/users/[id]/UserDetailClient.tsx:263,404,500,543,620`
- **Category:** Layout / Integrity
- **Evidence:** `.dark .glass` is `color-mix(... 3%, rgba(20,26,33,.88))`, which is almost exactly `--color-bg-primary` (#141A21). `Card` and `StatCard` use opaque `--color-bg-card` (#1F2731).
- **Impact:** On the dashboard, the four `StatCard`s are lifted navy, while the three tiles directly below (glass) are nearly the page color. They look like different components, and DataTables (also glass) have no elevation in dark. In light all three recipes look similar, so it only shows in dark.
- **Fix:** Pick one surface (opaque `bg-card` plus border plus `shadow-soft`) and use `<Card>` everywhere. Reserve `.glass` for floating chrome (sidebar, popovers, tooltips).

### [P2] Page spacing, container and heading rhythm differ page to page
- **Location:** see the table below.
- **Category:** Layout
- **Evidence:** `main` is `p-6 md:p-8` with no `max-w` (`apps/admin/src/app/(admin)/layout.tsx:308`), so every page is full-width and wide tables stretch on large monitors. Per-page root wrappers:

| Page | Root wrapper | Heading |
|---|---|---|
| Dashboard `DashboardClient.tsx:73`, Analytics `AnalyticsClient.tsx:188`, Engagement `EngagementClient.tsx:94` | `space-y-8 page-enter` | AdminPageHeader (h1 `text-2xl font-bold`) |
| Users `UsersClient.tsx:322`, Subscriptions `SubscriptionsClient.tsx:362`, Content `ContentClient.tsx:325`, SMS `SmsClient.tsx:632`, Emails `EmailsClient.tsx:283`, Audit `AuditLogClient.tsx:217`, Feedback `FeedbackClient.tsx:277` | `flex flex-1 flex-col gap-6 page-enter` | AdminPageHeader |
| System `SystemClient.tsx:192` | `space-y-6 page-enter` | AdminPageHeader |
| Content editors `ArticleEditorClient.tsx:102`, `EditArticleClient.tsx:117` | `space-y-6` (no `page-enter`) | header comes from `page.tsx`, with a separate back bar |
| API Docs `api-docs/page.tsx:31` | `flex flex-col gap-4` | custom `<header>` with its own h1 (`:36`) |
| User detail `UserDetailClient.tsx:738` | n/a | h1 `text-xl font-bold`, not `text-2xl` |
| Login `login/page.tsx:65` | n/a | h1 `text-2xl font-extrabold` |
| `error.tsx:36` | n/a | h1 `text-lg font-semibold` |

- **Impact:** Vertical rhythm jumps between 16, 24 and 32px, and h1 size and weight vary. The sticky pagination only works on the `flex-1 flex-col` pages. The back-link treatment varies (gray-500 in EmailPreview, muted in the content editors).
- **Fix:** Add a single `<PageShell>` (`flex flex-1 flex-col gap-6 page-enter`, optional `max-w-[1600px]`) and make `AdminPageHeader` the only h1 style. Give API Docs and UserDetail the same header.

### [P2] DataTable: clickable rows use `role="button"` on `<tr>`; sort state is not exposed; no phone-width strategy
- **Location:** `apps/admin/src/components/ui/DataTable.tsx:80-81,88-114,144-155`
- **Category:** Accessibility / Responsive
- **Evidence:** `<tr onClick ... tabIndex={0} role="button">`. The sort button has no `aria-sort` on the `<th>`. The wrapper is `overflow-auto` and the table is only `w-full min-w-full`, with no `min-w` or `whitespace-nowrap`.
- **Impact:**
  - `role="button"` on a row removes the row semantics, so screen readers cannot navigate it as a table row. Rows containing links or buttons (e.g. the Feedback expand button) nest interactive controls inside a button role.
  - Sorted columns are not announced.
  - On a phone, the 6-7 column tables (Users, Subscriptions, Content, SMS, Feedback, Emails, Audit) are squeezed to min-content with wrapped words, or scroll sideways with no cue. The sticky `th` (`top-0`) does not stick to the viewport, because the nearest scroll container is the table wrapper itself.
- **Fix:** Keep the row as a plain `<tr>` and put a real `<Link>` or button in the primary cell (stretched link). Set `aria-sort` on `th`. Give the table a sensible `min-w-[720px]` with a visible scroll shadow, or render a stacked card list below `md`.

### [P2] Focus indicators drawn at 30% alpha on form controls
- **Location:** `apps/admin/src/components/ui/Input.tsx:31`, `apps/admin/src/components/ui/Select.tsx:164`, `apps/admin/src/components/ui/FilterBar.tsx:59`, `apps/admin/src/components/ui/DateTimePicker.tsx:200-210`, `apps/admin/src/app/(admin)/sms/SmsClient.tsx:286,312,359`, `apps/admin/src/components/TiptapEditor.tsx:75`
- **Category:** Accessibility
- **Evidence:** `focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:border-[var(--color-primary)]`
- **Impact:** A 30% pink ring against a white or navy card is well under the 3:1 non-text contrast minimum. The 1px border color change is the only real cue. Keyboard focus on inputs is faint, in dark especially. FilterBar still uses `focus:` rather than `focus-visible:` (minor).
- **Fix:** Use a solid ring (`ring-[var(--color-primary)]`), or `ring-2 ring-primary/60` plus the border change.

### [P2] Toggle switches' off-state track and thumb have insufficient contrast, and the toggle is duplicated at two sizes
- **Location:** `apps/admin/src/app/(admin)/users/[id]/UserDetailClient.tsx:209-231` (h-5 w-9) and `apps/admin/src/app/(admin)/system/SystemClient.tsx:74-98` (h-6 w-11)
- **Category:** Accessibility / Integrity
- **Evidence:** Off state is `bg-[var(--color-border)]`: #F6DDE3 on white in light, #2E3945 on #1F2731 in dark. The thumb is hard-coded `bg-white`.
- **Impact:** The off-state track is about 1.2-1.3:1 against the card (1.4.11 requires 3:1). In dark, a white thumb on the pastel #FF7A99 "on" track is about 2.3:1. The two toggles also differ in size.
- **Fix:** Extract one `Switch` primitive. Off track `--color-text-muted`, a visible border, and a thumb that uses `--color-bg-card`.

### [P2] Skeleton shimmer is nearly invisible in dark mode, and the loader has no accessible status
- **Location:** `apps/admin/src/components/ui/Shimmer.tsx:4`
- **Category:** Theming
- **Evidence:** `bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent animate-shimmer opacity-50`. Dark `--color-border` is #2E3945 on #1F2731 or #141A21, at 50% opacity.
- **Impact:** Every `loading.tsx` skeleton renders as a faint smear in dark, so pages look empty while loading. It does respect `prefers-reduced-motion` via the global rule.
- **Fix:** Use `bg-[var(--color-bg-secondary)]` as the base with a lighter highlight band, and make it opaque enough to read on `bg-card` in both themes.

### [P2] Admin does not load a Bengali font, though the CMS and SMS edit Bengali content
- **Location:** `apps/admin/src/app/layout.tsx:1-10` (Manrope only), `apps/admin/src/app/globals.css:67-68` (`--font-bengali: "Noto Sans Bengali"` is declared but never loaded). Compare `apps/web/src/app/layout.tsx:2,14`, which imports `Noto_Sans_Bengali`.
- **Category:** Integrity / Theming
- **Evidence:** There is no `Noto_Sans_Bengali` import and no `<link>` in admin.
- **Impact:** The EN/BN side-by-side article editor, the BN SMS textarea and the BN titles render in whatever system fallback exists (Bengali glyphs missing on many machines). They look different from what users see in the web app.
- **Fix:** Import `Noto_Sans_Bengali` in the admin root layout with the same variable name as web.

### [P2] Hard-coded light surfaces in EmailDetail
- **Location:** `apps/admin/src/app/(admin)/emails/[id]/EmailDetailClient.tsx:141,222`
- **Category:** Theming
- **Evidence:** `border-amber-200 bg-amber-50 ... text-amber-900` has no `dark:` variants. The placeholder box is `bg-white text-[var(--color-text-muted)]`.
- **Impact:** In dark mode the "Approximate preview" notice is a bright cream block, and the preview placeholder is a white box with light-gray text (invisible).
- **Fix:** Add dark variants or tokenised tints, and use `--color-bg-card` for the placeholder (white is only correct for the iframe itself).

### [P2] Inputs and textareas in editors and modals bypass the shared `Input`
- **Location:** `apps/admin/src/app/(admin)/sms/SmsClient.tsx:286,312,359`, `apps/admin/src/app/(admin)/content/new/ArticleEditorClient.tsx:152,168`, `apps/admin/src/app/(admin)/content/[id]/EditArticleClient.tsx:156,172`, `apps/admin/src/app/login/page.tsx:80,97`, `apps/admin/src/app/(admin)/emails/preview/EmailPreviewClient.tsx:63`
- **Category:** Integrity / Layout
- **Evidence:** Each re-implements `w-full rounded-xl border ... bg-[var(--color-bg-card|bg-primary|bg-secondary)] px-... py-...` with different backgrounds (card, primary, secondary), paddings (`px-4 py-3` vs `px-3.5 py-2.5`), radii (`rounded-md` in EmailPreview), and focus ring styles.
- **Impact:** Field height, fill and focus look differ between pages; the editor fields sit on a different fill than modal fields.
- **Fix:** Add `Textarea`/`Field` siblings to `Input` and use them everywhere.

### [P2] `transition-colors transition-shadow` and `transition-shadow transition-transform` override each other
- **Location:** `apps/admin/src/components/ui/Input.tsx:32`, `apps/admin/src/components/ui/Select.tsx:165`, `apps/admin/src/components/ui/FilterBar.tsx:59`, `apps/admin/src/components/ui/Card.tsx:19`, `apps/admin/src/components/TiptapEditor.tsx:29,75`
- **Category:** Performance / Layout
- **Evidence:** In Tailwind v4 each `transition-*` utility sets `transition-property`, so the later one wins and the earlier is dropped (the old `transition-all` bans in CLAUDE.md prompted this swap).
- **Impact:** Focus rings and borders snap instead of easing (small visual roughness). The hover Card (`Card.tsx:19`) is also `cursor-pointer` on a non-interactive `<div>`, which is the old finding about hoverable cards.
- **Fix:** Use one arbitrary class: `transition-[color,background-color,border-color,box-shadow]`.

### [P2] Chart status colors are hard-coded hex, and charts first render in light colors in dark mode
- **Location:** `apps/admin/src/lib/chart-palette.ts:38-39,44-45`; `useChartColors` at `apps/admin/src/lib/chart-palette.ts:61-70`
- **Category:** Theming
- **Evidence:** `good: '#059669', mid: '#D97706'`. `useChartColors` renders the light fallbacks first, then re-resolves in an effect.
- **Impact:** Emerald and amber do not adapt to dark. They are fine as graphics at about 4:1 and 5:1, but off-token. Dark-mode users see a one-frame flash of the light palette on each chart mount. Series, grid and axis colors do use tokens correctly.
- **Fix:** Add `--color-success` / `--color-warning` tokens and reference them. Resolve colors synchronously from `getComputedStyle` in a layout effect.

### [P3] Login: submit disabled until both fields are filled; spinner is white-only
- **Location:** `apps/admin/src/app/login/page.tsx:134,141`
- **Category:** Accessibility
- **Evidence:** `disabled={state === 'loading' || !email.trim() || !password}`, `border-white/40 border-t-white`
- **Impact:** A disabled primary button gives no feedback on why it will not submit (still open from the 2026-05-30 review). In dark the action fill is pink with navy text, but the spinner is white.
- **Fix:** Keep the button enabled and validate on submit. Use `border-current` for the spinner.

### [P3] Misc polish
- **Location:** `apps/admin/src/app/(admin)/DashboardClient.tsx:77`, `apps/admin/src/components/ui/StatCard.tsx:27`, `apps/admin/src/components/ui/Pagination.tsx:~226`
- **Category:** Layout
- **Evidence:**
  - Dashboard description hard-codes "last updated just now".
  - The StatCard value (`text-3xl font-bold`) has no `tabular-nums`.
  - Pagination page buttons are `h-8 w-8` (32px touch targets).
- **Impact:** Misleading static freshness text, jittering digits, and small touch targets.
- **Fix:** Show a real timestamp, add `tabular-nums`, and use at least `h-10 w-10` on `max-md`.

---

## Previous audit (review/ADMIN-UI-REVIEW.md) status

Fixed since 2026-05-30:
- `transition-all` removed from admin source, and the `.glass-hover` rule now lists properties.
- `prefers-reduced-motion` and `color-scheme` added.
- Focus-visible rings added on Button, Card links, Pagination, FilterBar and layout buttons.
- Pagination `<select>` replaced with a labelled custom listbox.
- DataTable sortable headers are now `<button>`s, and clickable rows have keyboard handling.
- Search `aria-label`, `name` and `autoComplete` added.
- `role="dialog"`, `aria-modal`, `aria-labelledby` and `overscroll-contain` on ConfirmModal, though it is on a non-scrolling wrapper, so containment is mostly cosmetic (see the modal finding).
- Mobile drawer has dialog semantics.
- Content editor labels, `htmlFor`, `aria-live` and unsaved-changes handling.
- `loading.tsx` has `role="status"`.
- Dates use `toLocaleDateString(undefined, ...)` and decorative icons carry `aria-hidden` (lucide 0.546 adds it by default).
- Login placeholders end with an ellipsis, with `name` and `spellCheck`.

Still open:
- Login submit disabled when empty (`login/page.tsx:134`).
- `tabular-nums` missing on StatCard values.
- `FilterBar` search uses `focus:` rather than `focus-visible:`.
- ConfirmModal "backdrop" closes only by click (acceptable), but there is no real focus trap or scroll lock.
- Sticky `th` is not sticky relative to the page.

Not in the old review (new): theme flash, white ring offset, the email preview island, the drawer in the DOM when closed, the date-picker Escape bug, status-color contrast, the collapsed sidebar overflow, and the card-surface divergence.

---

## Systemic patterns

1. **No shared modal primitive.** Five dialogs (ConfirmModal, CreateBroadcastModal, category manager, mobile drawer, and the DateTimePicker popover) each hand-roll Escape and focus. None trap focus or lock scroll, and two have no Escape at all. This is the most likely source of the "issues with the pop-ups" complaint.
2. **Dark mode is bolted on per element.** Palette steps (`red-500`, `emerald-600`, `gray-*`, `bg-white`) are used instead of tokens, with some `dark:` variants and some missing. The result is white islands and failing contrast in dark (Email preview, EmailDetail, Dashboard growth tile).
3. **White ring offset.** A single missing `--tw-ring-offset-color` override affects 47 usages.
4. **Primitives duplicated instead of used.** `Card` has 4 users against about 38 hand-rolled equivalents, toggles are copied twice, and inputs are re-styled in 8 places. Surfaces and field heights drift, especially in dark where glass and card diverge.
5. **No page shell.** Each page chooses its own wrapper spacing (8, 6, 4), heading size and back-link style, and `main` has no max width.
6. **The brand AA rule is not enforced.** Primary text on tints and on `bg-secondary` is used in the nav, selects, toolbar and login.

## What's working

- Tokens are correctly mirrored from web (light and dark values, on-* pairs, `color-scheme` per theme), and the brand surface and ring tokens are used in most components.
- Charts resolve CSS variables at runtime and re-resolve on theme toggle. Series, grid and ticks use tokens. Tooltips use glass.
- `ConfirmModal` has `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape (blocked while loading) and focus return.
- `Select` (listbox/combobox keyboard support), Pagination's page-size listbox and the date picker have good arrow, Home, End and Escape support and `overscroll-contain`.
- Navigation is semantic: `<nav aria-label>`, `<Link>` for navigation, `aria-label` on collapsed icon buttons, `aria-current` on pagination, and `role="switch"` with `aria-checked`.
- `Badge` has dark variants, and the global `prefers-reduced-motion` rule exists.
- Login form is well labelled (`htmlFor`, `autoComplete`, `role="alert"`, show/hide password with `aria-label`).
- Icon-only buttons almost everywhere have `aria-label`.
