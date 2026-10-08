# Modal / Dialog / Overlay audit (apps/web/src)

Scope: every overlay in `apps/web/src` (excluding `app/internal/**`). Read-only audit; every row/finding verified by reading the code. Paths are relative to `apps/web/src`.

Only **one** shared shell exists (`components/ui/Modal.tsx`). It is used by 6 consumers (CheckIn, QuickSymptom, Celebration, TrialCountdownPill, plus the unused LatePeriodPrompt). Another **9 overlays are hand-rolled**, each with a different subset of behaviour. `components/ui/DatePicker.tsx` is confirmed unused (no import anywhere in `src/`). `components/modals/LatePeriodPrompt.tsx` is unused too (only referenced by `__tests__/brand/screens-tokens.test.ts`).

Legend: Y = yes, N = no, P = partial (see notes), n/a = not applicable.

## Comparison table

| # | Overlay (file) | Shared Modal? | role | aria-modal | labelledby | ESC closes | Focus trap | Focus restore | Initial focus | Body scroll lock | overscroll contain | Backdrop click closes | Backdrop colour / blur | z | max-h + inner scroll | Phone layout / safe-area | Close btn aria-label | Enter/exit anim + reduced motion | Dark surface |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Modal base** `components/ui/Modal.tsx` | (is it) | dialog | Y | Y (titleId) or aria-label | Y (document listener, closes *every* open Modal) | N | N | panel div (tabIndex -1) or `initialFocusRef` | P (sets `body.overflow` unconditionally, resets to `''` on any close/mount) | Y | Y (opt-out `closeOnBackdrop`) | `bg-black/50 backdrop-blur-sm` | 50 | Y `85dvh`, whole panel scrolls (close btn scrolls with it) | bottom sheet, but `mx-4` floating (square bottom corners, 16px side gaps); no safe-area | Y but hardcoded `"Close"` (L160) | Y spring / tween exit, reduced-motion aware (`mounted && reduce`) | `--color-bg-card` + border |
| 2 | TodayCheckInModal `components/engagement/TodayCheckInModal.tsx:183` | Y | dialog | Y | Y (`useId`) | Y (Modal) | N | N | panel | P | Y | Y | navy vignette radial 40-82% + `backdrop-blur-sm` (L186-190) | 50 | Y (Modal) | sheet; `panelClassName="max-w-sm"` collides with `sm:max-w-md` | Y (Modal) | Y | card |
| 3 | QuickSymptomModal `components/modals/QuickSymptomModal.tsx:130` | Y | dialog | Y | Y | Y | N | N | panel | P | Y | **N** (`closeOnBackdrop={false}`, L136) | black/50 blur | 50 | Y, but Save btn + close scroll away | sheet | Y (hardcoded) | Y | card |
| 4 | CelebrationModal `components/modals/CelebrationModal.tsx:60` | Y | dialog | Y | Y | Y | N | N | panel | P | Y | Y | black/50 blur | 50 | Y | sheet | **no close btn** (`hideClose`), has "Done" button; auto-closes at 2.6s | Y; confetti loops infinitely (replaced by static dots when reduced) | card |
| 5 | TrialCountdownPill dialog `components/TrialCountdownPill.tsx:315` | Y | dialog | Y | Y | Y | N | N | panel | P | Y | Y | black/50 blur | 50 (**scoped to header/aside, see P0**) | Y | **broken** (rendered inside `.glass` ancestor) | Y | Y | card |
| 6 | LatePeriodPrompt `components/modals/LatePeriodPrompt.tsx:45` | Y | dialog | Y | Y | Y | N | N | panel | P | Y | Y | black/50 blur | 50 | Y | sheet | Y | Y | **unused (dead)** |
| 7 | PeriodLogModal `components/PeriodLogModal.tsx:101` | **N** | dialog (on panel, L110) | Y | **N** (`aria-label` only) | **P** (`onKeyDown` on wrapper L66/101; dead until focus is inside) | N | N | **none** | **N** | Y | **N** (by design, comment L102) | `bg-black/50`, no blur | 50 | Y `85dvh` | sheet, `max-w-md`, flush full width; no safe-area | Y but hardcoded `"Close"` (L138); no `focus-visible` ring | Y slide, reduced-motion aware, exit works (parents wrap in `AnimatePresence`) | card, no border; saved state uses hardcoded `dark:bg-green-900/30` (L218) |
| 8 | ProfileCompletionModal `components/ProfileCompletionModal.tsx:168` | **N** | dialog | Y | Y | Y (document listener) | N | N | first input | Y | Y | Y | black/50 blur | 50 | **N** | sheet, `mx-4`, **no max-h / no scroll** | `"Dismiss"` hardcoded (L223) | **none** (no enter/exit) | card |
| 9 | SubscriptionClient phone dialog `app/(main)/subscription/SubscriptionClient.tsx:521-612` | **N** | dialog | Y | Y (`phone-step-title`) | **P** (wrapper `onKeyDown`, dead without focus) | N | N | **none** | **N** | Y | Y (backdrop is a `role=button tabIndex=-1`) | navy/50 blur | 50 | N | floating card `pb-6`, `rounded-2xl` (not a sheet) | no X; Cancel btn; backdrop labelled `"Close dialog"` hardcoded | spring, **no reduced-motion**; `AnimatePresence` is inside the `&&` so exit never plays | card |
| 10 | SubscriptionClient BDAppsModal `...SubscriptionClient.tsx:70-250` | **N** | dialog | Y | **P** (`bdapps-modal-title` only exists in `confirm` step, L115) | **P** (wrapper only) | N | N | none | **N** | Y | Y only when `step==='confirm'` | navy/50 blur | 50 | N | floating card | no X; hardcoded `"Close dialog"` | spring, no reduced-motion; same `AnimatePresence` misuse | card |
| 11 | ProfilesClient EditProfileForm `app/(main)/profiles/ProfilesClient.tsx:578-790` | **N** | dialog | Y | Y | **P** (wrapper only) | N | N | none | **N** | Y | Y | navy/55 + inline `blur(4px)` | 50 | **N (`overflow-hidden`, no max-h)** | floating card `pb-8`, 5 field groups | Y (`t('common.cancel')`) | spring, no reduced-motion, exit works | card, goal-accent border |
| 12 | ProfilesClient DeleteDialog `...ProfilesClient.tsx:803-870` | **N** | dialog | Y | Y | **P** | N | N | none | **N** | Y | Y | navy/55 blur | 50 | n/a (short) | floating card `pb-8` | no X; Cancel btn. Title text hardcoded English `"Remove Profile"` (L832) | spring, no reduced-motion | card |
| 13 | Settings logout confirm `app/(main)/settings/SettingsClient.tsx:893-935` | **N** | dialog | Y | `aria-label="Confirm logout"` hardcoded (L900) | **P** (wrapper only) | N | N | none | **N** | N | Y | `bg-black/40 blur-sm` | 50 | n/a | **centered** card on phone (others are bottom) | no X | **none** | card |
| 14 | Onboarding AccountControl logout confirm `components/onboarding/AccountControl.tsx:77-123` | **N** | dialog | Y | `aria-label={t('settings.logout')}` | Y (document listener) | N | N | none | **N** | Y (on card only) | Y | `bg-black/40 blur-sm` | 50 | n/a | centered | no X | **none** | card |
| 15 | OnboardingTour `components/onboarding/OnboardingTour.tsx:347` | **N** | dialog | Y | Y | Y | **Y** (Tab wrap) | **Y** | Next btn | Y | Y (card only) | only in centered-fallback mode | spotlight = `box-shadow 0 0 0 9999px navy/60`; fallback `black/50 blur-sm` | 60 / card 61 | N (card ~240px; fine) | **bottom-pinned card, no safe-area; covers bottom nav (see P1)** | n/a (no X, Skip btn) | card fade/slide, reduced-motion aware; spotlight CSS transition disabled when reduced | `glass bg-card` |
| 16 | LatePeriodFullScreenAlert `components/modals/LatePeriodFullScreenAlert.tsx:106` | **N** | **alertdialog** | Y | Y | Y | N | N | CTA button | Y | Y | n/a (full-screen) | opaque `color-mix(accent 14%, bg-primary)` + blur(4px) | **60** | **N** (`min-h-screen`, no overflow) | full-screen centred | n/a (Later btn) | Y, reduced-motion aware | opaque token mix |
| 17 | TrialExpiredLock `components/TrialExpiredLock.tsx:44` | **N** | dialog | Y | Y | N (intentional lock) | **N** | N | **none** | **N** | Y | N | `bg-black/60 blur-sm` | **80** | N | centered card `px-4` | n/a | Y (instant when reduced) | `Card` |
| 18 | DatePicker `components/ui/DatePicker.tsx:213` | n/a | dialog (inline) | `false` | Y | Y | n/a | Y (returns focus to input) | n/a | n/a | n/a | outside-click | n/a | inline | n/a | **unused/dead** | Y | n/a | tokens |
| 19 | Calendar DayDetail `app/(main)/calendar/CalendarClient.tsx:241` | n/a | **not an overlay**: inline `Card` in right column | | | | | | | | | | | | | below the grid on phone; no scroll-into-view | Y (`onClose`) | opacity/y, `AnimatePresence mode="wait"` | card |
| 20 | Layout Toast `app/(main)/layout.tsx:78` / Settings toast `SettingsClient.tsx:169` / Profiles toast `ProfilesClient.tsx:1062` | n/a | status (`aria-live`) | | | | | | | | | | | 70 / 60 / 50 | | top-centre | | | inverted text/bg |

Mobile bottom nav `layout.tsx:581` is `z-40`; mobile header `layout.tsx:529` is `z-40`; sidebar `layout.tsx:412` is `z-40`. All modals (50+) correctly cover them **unless the modal is a DOM descendant of those elements** (see P0).

---

## Findings

### [P0] Trial "add number" dialog renders inside a `.glass` (backdrop-filter) ancestor, so `position: fixed` is re-anchored to the header/sidebar box
- **Location:** `components/TrialCountdownPill.tsx:315` (Modal), rendered from `app/(main)/layout.tsx:502` (inside `<aside class="... glass ... z-40">`, L412) and `app/(main)/layout.tsx:543` (inside `<header class="sticky top-0 z-40 glass ...">`, L529); `.glass` defined at `app/globals.css:148-154`.
- **Category:** Modal / Layout
- **Evidence:** `.glass { backdrop-filter: blur(16px); }` and `<TrialCountdownPill ... />` containing `<Modal className="fixed inset-0 z-50 ...">` (Modal.tsx:104). No `createPortal` exists anywhere in `src/`.
- **Impact:** A `backdrop-filter` element becomes the containing block for fixed-position descendants (Chrome, Safari, Firefox). The `fixed inset-0` overlay is therefore sized to the ~56px mobile header (or the 256px sidebar on desktop) instead of the viewport. The sheet is anchored to that tiny box, the page behind is not dimmed or blocked, and its `z-50` is trapped inside the header/aside `z-40` stacking context (sticky header/aside also form stacking contexts). Trial users (the group that must add a phone number) see a broken/clipped popup on phone and desktop, in light and dark. This matches the "issues with the pop-ups" complaint. (Verified in code; confirm visually in a browser.)
- **Fix:** Render every overlay through a portal to `document.body` (put the portal inside the shared shell, see recommendation). Interim: lift the dialog state/Modal out of `TrialCountdownPill` to a layout-level sibling of `<Toast>`, like `ProfileCompletionModal` already is.

### [P1] Only the base `Modal` has a shared contract; 9 overlays are hand-rolled and ESC is dead on 5 of them
- **Location:** `SubscriptionClient.tsx:73-79,521-527` (wrapper `onKeyDown`), `ProfilesClient.tsx:609,813`, `SettingsClient.tsx:897`, `PeriodLogModal.tsx:66,101`.
- **Category:** Accessibility / Modal
- **Evidence:** `onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}` on the wrapper `div`, with no element inside receiving focus on open.
- **Impact:** A keydown handler on a wrapper only fires if focus is inside it. Nothing moves focus into these dialogs on open, so focus stays on the (now covered) trigger, and Esc does nothing for keyboard/AT users until they happen to click inside. Screen reader users are not placed in the dialog at all (WCAG 2.4.3, 2.1.2).
- **Fix:** Use one shell with a document-level, top-of-stack-only ESC handler and initial-focus logic (see recommendation).

### [P1] No focus trap, no `inert` on the background, and no focus restore in the shared `Modal` (and all others except the tour)
- **Location:** `components/ui/Modal.tsx:48-80` (ESC, scroll lock, focus-on-open only). Compare `onboarding/OnboardingTour.tsx:163-221` (the only overlay that traps and restores focus). `TrialExpiredLock.tsx:44` has no focus handling at all.
- **Category:** Accessibility
- **Evidence:** Modal focus effect: `target?.focus()` only; no Tab handling; no `previousFocus.focus()` in cleanup.
- **Impact:** Tab walks out of the dialog into the covered page/nav (`aria-modal` is not enforced by every screen reader); on close focus drops to `<body>`, so keyboard users lose their place (e.g. after check-in, logout confirm, profile edit). In `TrialExpiredLock` the entire app behind the "lock" stays tabbable and readable, so the paywall can be operated blind by keyboard.
- **Fix:** In the shell: save `document.activeElement` on open and restore it on close; trap Tab inside the panel (or use native `<dialog>.showModal()`), and set `inert`/`aria-hidden` on the app root while open.

### [P1] Overlay stacking is decided by DOM order within the same `z-50`; several flows collide
- **Location:** `app/(main)/dashboard/DashboardClient.tsx:914-960` (PeriodLogModal L916, QuickSymptom L928, Celebration L940, CheckIn L950, all `z-50`); `engagement/TodayCheckInModal.tsx:331-364` (nested QuickSymptom and Celebration inside the check-in); `app/(main)/layout.tsx:620-648` (ProfileCompletion z-50, Tour z-60, LateAlert z-60, Lock z-80); `layout.tsx:241,266`, `DashboardClient.tsx:262-270`.
- **Category:** Modal
- **Evidence / Impact (each verified from the code):**
  1. **Check-in -> "More"**: `setShowQuick(true)` opens QuickSymptomModal while the check-in stays open. Both are `z-50`; Quick wins by DOM order. Esc fires both Modals' document listeners, so *both* close and the check-in is lost. When Quick closes it sets `body.overflow = ''` while the check-in is still open, so the page behind scrolls again.
  2. **Late-period alert -> "Log period"**: alert is `z-60` and the dashboard check-in auto-opens (`DashboardClient.tsx:262-270`; only gated on the tour, not on the alert). After "Log period" the `vesta:open-period-log` event opens `PeriodLogModal` (DOM L916) *underneath* the still-open check-in (DOM L950), same `z-50`: the user sees the check-in on top, and the log form hidden behind it.
  3. **Tour + Late alert** (both `z-[60]`; replay from Settings, or eligible user with a late period): later DOM node (alert) wins; both attach document Esc handlers and both write `body.overflow`, so Esc dismisses both, and closing one unlocks scroll under the other.
  4. **ProfileCompletion (60s timer, z-50) vs check-in/PeriodLog (z-50)**: the timer (`layout.tsx:347`) has no gating against the tour, check-in, or late alert; DOM order puts it above the check-in, below the tour/alert. Stacks arbitrarily.
  5. **Check-in "All good" -> Celebration**: `onClose()` and `setCelebrationOpen(true)` happen in the same tick, so the check-in exit animation (0.2s) overlaps the celebration enter animation, both with `backdrop-blur`, producing a double-dark flash.
  6. **TrialExpiredLock (z-80)** renders over everything but does not suspend the others (they keep timers and focus rAFs running behind it, e.g. check-in auto-open).
  7. **Toast z-70 (layout) vs Tour 60**: toast shows above the tour (fine). Settings toast is z-60, below nothing relevant. The Lock (z-80) *hides* layout toasts (z-70), e.g. "profile completed" confirmations.
- **Fix:** Single overlay manager (stack in context/zustand): one global ESC, one scroll-lock counter, `requestOpen(id, priority)` so lower-priority overlays queue (lock > late alert > tour > profile completion > check-in), and child dialogs (Quick from check-in) either replace the parent or stack with explicit z offsets (`z-[calc(50+depth)]`). Define a z-scale token set (`--z-nav:40`, `--z-overlay:50`, `--z-lock:80`, `--z-toast:90`).

### [P1] Body scroll lock is unreliable: unconditional writes clobber each other, and 7 overlays have none
- **Location:** `ui/Modal.tsx:60-69`, `ProfileCompletionModal.tsx:86-95`, `LatePeriodFullScreenAlert.tsx:52-62`, `OnboardingTour.tsx:224-234` all do `document.body.style.overflow = open ? 'hidden' : ''`. No lock at all in `PeriodLogModal`, `SubscriptionClient` (both dialogs), `ProfilesClient` (both dialogs), `SettingsClient` logout, `AccountControl` logout, `TrialExpiredLock`.
- **Category:** Modal
- **Evidence:** `else { document.body.style.overflow = ''; }` executes on **mount of every always-mounted `<Modal open={false}>`** (QuickSymptom, Celebration, the Trial pill Modal) and on any close.
- **Impact:** Navigating to `/dashboard` while another lock is active (tour, profile modal) mounts the Dashboard's three Modals and resets overflow to `''` => page scrolls under the open overlay; closing one of two stacked overlays unlocks the other. The 7 unlocked overlays let the page scroll behind them (on phones, a visibly "floating" page; `overscroll-contain` on the panel does not stop body scroll chaining from the backdrop). iOS also needs `position: fixed`/`overscroll-behavior` on the body, not just `overflow: hidden`.
- **Fix:** One ref-counted `useScrollLock(open)` in the shell (add on open, remove on close, never write on `open=false` mount), applied by every overlay.

### [P1] ProfileCompletionModal has no max-height and no internal scroll; the form is clipped on short phones
- **Location:** `components/ProfileCompletionModal.tsx:168-185` (container `fixed inset-0 ... items-end`; panel has only `overscroll-contain`), form at L264-.
- **Category:** Responsive / Modal
- **Evidence:** panel classes: `relative z-10 w-full sm:max-w-md mx-4 ... rounded-t-3xl ... overscroll-contain` (no `max-h`, no `overflow-y-auto`).
- **Impact:** With all three fields missing (name, phone, email: 3x (label + 48px input + error line)) plus handle, title, percent chip, 2-line description, info note, and 2 buttons, the sheet is roughly 600-680px tall. On a 667px viewport (iPhone SE / 8) the top (title/close) or the submit buttons fall outside the viewport and cannot be reached (bottom-anchored, nothing scrolls); with the on-screen keyboard open (first input is auto-focused at L67) it is unusable on any phone, including 844px. The submit buttons are the primary action.
- **Fix:** Shell: `max-h-[min(85dvh,calc(100dvh-2rem))]` + `overflow-y-auto` body with sticky footer for actions; do not autofocus text inputs on touch devices (focus the heading/panel instead).

### [P1] ProfilesClient edit dialog is `overflow-hidden` with no max-height; the five-section form is cut off on 667px (and tight on 844px)
- **Location:** `app/(main)/profiles/ProfilesClient.tsx:605-622` (container `fixed inset-0 ... items-end ... pb-8`; panel `overflow-hidden`), form sections L660-790 (name, 6 relation tiles in 2 rows, cycle+period box, 4-col goal grid, buttons).
- **Category:** Responsive / Modal
- **Evidence:** `className="w-full max-w-md rounded-2xl border overflow-hidden overscroll-contain"` with no `max-h`.
- **Impact:** Estimated dialog height about 640-720px plus 32px bottom padding. On a 667px phone the header/close button is pushed off the top and the Save button can't be scrolled to; with the keyboard open for the name field it is worse. The `overflow-hidden` means even a swipe cannot reveal it.
- **Fix:** Same shell fix (cap height, scroll the body, sticky footer). Replace `pb-8` floating card with a true bottom sheet on phones.

### [P1] On phones the onboarding tour card is pinned to the bottom and sits on top of the bottom-nav items it is spotlighting
- **Location:** `onboarding/OnboardingTour.tsx:307-313` (mobile: `position: fixed; bottom: VIEWPORT_MARGIN(16)`), tour steps `app/(main)/layout.tsx:116-119` (`nav-calendar`, `nav-insights` live in the fixed bottom nav, L581-600).
- **Category:** Responsive / Modal
- **Evidence:** `cardStyle = { position:'fixed', left:16, right:16, bottom:16, ... }` and the targets `[data-tour="nav-calendar"]`/`nav-insights` are in the `fixed bottom-0` nav.
- **Impact:** Steps 2 and 3 highlight a bottom-nav tab with the spotlight, and the ~240px tooltip card is drawn exactly over that spot (bottom 16px to about 256px), so the user can't see what is being pointed at. `isMobileViewport` uses `window.innerWidth <= 640` computed during render with no re-render source other than rect updates.
- **Fix:** On mobile, place the card at the top when the target rect is in the bottom half (reuse the above/below logic from the desktop branch with measured card height), and add `pb-[env(safe-area-inset-bottom)]`.

### [P1] TrialExpiredLock: invalid nested interactive markup and no containment of the underlying app
- **Location:** `components/TrialExpiredLock.tsx:88-96` and L44-48.
- **Category:** Accessibility
- **Evidence:** `<Link href="/subscription" className="block"><Button ...>` (an `<a>` containing a `<button>`); container has `role="dialog" aria-modal="true"` but no initial focus, trap or `inert`.
- **Impact:** `<a><button>` is invalid HTML; the button and link are two tab stops and AT announces a button-in-link. Keyboard/AT users start with focus behind the lock (nav links, forms), and can navigate the whole app despite the lock; Tab from the Upgrade button leaves the dialog.
- **Fix:** Render the CTA as a single `Link` styled as a button (or a `Button` with `asChild`/router.push), focus the heading or CTA on mount, and make the app root `inert` while locked.

### [P2] Close button scrolls away with the content; the primary action is not sticky in tall sheets
- **Location:** `ui/Modal.tsx:136-138,156-172` (panel is the scroller, `absolute top-4 right-4` close button inside it); consumers `modals/QuickSymptomModal.tsx:215-350` (Save at the end of the grid).
- **Category:** Responsive / Modal
- **Evidence:** `maxHeight: '85dvh', overflowY: 'auto'` on the same element that contains the absolutely positioned close button.
- **Impact:** On a 667px phone the 85dvh panel is 567px; QuickSymptom (header + 4-tab bar + up to 10 chips in 3 columns = 4 rows + Save) is about 600px, so it scrolls: the X scrolls out of view, and Save sits below the fold (user must scroll to find it). 844px is fine. Content height changes per tab (6 vs 10 chips) so the sheet jumps in height when switching categories.
- **Fix:** Shell with `header` (title + X, non-scrolling), scrollable `body`, and `footer` slot (sticky actions); reserve min-height for tabbed bodies.

### [P2] Inconsistent phone geometry: floating `mx-4` sheet vs flush sheet vs centred vs floating card; no safe-area handling
- **Location:** `ui/Modal.tsx:126` (`mx-4 sm:mx-auto`, `rounded-t-3xl`, border all around), `PeriodLogModal.tsx:113` (flush `w-full`, no margin), `SubscriptionClient.tsx:75,523` (`px-4 pb-6 md:pb-0`, `rounded-2xl`), `ProfilesClient.tsx:606,810` (`px-4 pb-8`), `SettingsClient.tsx:895` and `AccountControl.tsx:83` (centred on phones), `TrialExpiredLock.tsx:47` (centred). No `env(safe-area-inset-*)` and no `viewport-fit=cover` anywhere in `src/` (grep returns nothing).
- **Category:** Layout / Responsive
- **Evidence:** see locations.
- **Impact:** The same app shows three unrelated mobile treatments: a rounded-top card with 16px gutters that touches the screen bottom with square corners (Modal base), a full-width sheet (PeriodLog), and floating rounded cards 24-32px above the bottom (Subscription/Profiles). Feels sloppy and inconsistent. Bottom-sheet content can sit under the iOS home indicator in standalone/PWA mode.
- **Fix:** One phone pattern in the shell (full-width bottom sheet, `rounded-t-3xl`, `pb-[max(1.5rem,env(safe-area-inset-bottom))]`, centred card from `sm:`), and set `viewport-fit=cover` in the viewport metadata.

### [P2] Backdrop colour/blur varies across overlays (and is not theme-aware)
- **Location:** `Modal.tsx:112` `bg-black/50 backdrop-blur-sm`; `PeriodLogModal.tsx:104` `bg-black/50` (no blur); `Settings 895` and `AccountControl 83` `bg-black/40 blur-sm`; `Subscription 83,531` navy/50 blur; `Profiles 608,812` navy/55 + inline `blur(4px)`; `TodayCheckInModal.tsx:186-190` navy radial vignette 40-82%; `TrialExpiredLock.tsx:51` `black/60 blur`; `OnboardingTour.tsx:301` `box-shadow 0 0 0 9999px navy/60`; `LatePeriodFullScreenAlert.tsx:111-114` opaque accent tint.
- **Category:** Theming
- **Evidence:** at least seven distinct scrim treatments; all are fixed colours.
- **Impact:** Stacked/consecutive overlays flash different dimming levels; in dark mode a black or navy scrim over a near-black page gives much weaker separation than in light, while `backdrop-blur-sm` on 4 layers is costly on low-end phones. The check-in vignette (82% navy at the edges) makes the first popup users see look heavier than all the others.
- **Fix:** One `--scrim` token (light/dark variants) and one blur level in the shell; drop blur on mobile low-power or keep to a single layer.

### [P2] Hard-coded English labels and strings in dialogs (not translated for Bengali users)
- **Location:** `ui/Modal.tsx:160` `"Close"`; `PeriodLogModal.tsx:138` `"Close"`; `ProfileCompletionModal.tsx:159,223,249` (`'Something went wrong. Please try again.'`, `"Dismiss"`, `You're all set on contact info.`); `SubscriptionClient.tsx:87,535` `"Close dialog"`; `SettingsClient.tsx:900` `"Confirm logout"`; `ProfilesClient.tsx:832-837,840` (`Remove Profile`, `Remove <strong>…</strong>?`, `All symptom logs and data…`, `placeholder="e.g. Nusrat…"`).
- **Category:** Accessibility / Integrity
- **Evidence:** literals in JSX/aria attributes.
- **Impact:** In Bengali mode the delete-profile confirmation (a destructive action) and every close button's accessible name is English.
- **Fix:** Route through `t()`; make the shell's close label a prop defaulting to `t('common.close')`.

### [P2] BDApps dialog has a dangling `aria-labelledby` and wraps the whole dialog in a live region
- **Location:** `SubscriptionClient.tsx:94` (`aria-labelledby="bdapps-modal-title"`), the only `id="bdapps-modal-title"` is at L115 inside the `confirm` step; L106 `aria-live="polite" aria-atomic="true"` on the content wrapper.
- **Category:** Accessibility
- **Evidence:** `loading`, `success` and `error` steps render no element with that id.
- **Impact:** During loading/success/error the dialog has no accessible name. `aria-atomic` on the whole content makes screen readers re-read the entire dialog on each step change.
- **Fix:** Give the dialog a stable title element (or `aria-label` per step) and put `aria-live` only on a status line.

### [P2] Exit animations never play, and JS springs ignore reduced motion
- **Location:** `SubscriptionClient.tsx:521-523` and `:560` (`{upgradeStep === 'phone' && (<AnimatePresence>…` — the AnimatePresence is unmounted together with its child; same for BDAppsModal at L632); `ProfileCompletionModal.tsx:166` (`if (!open) return null`), `OnboardingTour.tsx:293`, `SettingsClient.tsx:893`, `AccountControl.tsx:77` (no motion at all). No `<MotionConfig reducedMotion="user">` in `src/` (grep). `Subscription` + `Profiles` dialogs animate `y: 80/40` with springs unconditionally; the global CSS reduced-motion rule (`globals.css:291-297`) does not affect motion's JS transforms.
- **Category:** Accessibility / Modal
- **Evidence:** `{cond && (<AnimatePresence> <motion.div exit=…>)}`; no `useReducedMotion` in those files.
- **Impact:** Some dialogs pop in/out instantly (abrupt, inconsistent), while the others slide even for users who asked for reduced motion.
- **Fix:** Put `AnimatePresence` *outside* the conditional, and put the animation inside the shell with reduced-motion handling (or wrap the app in `MotionConfig reducedMotion="user"`).

### [P2] CelebrationModal is a modal dialog that auto-dismisses after 2.6s
- **Location:** `modals/CelebrationModal.tsx:52-57,60-68`
- **Category:** Accessibility / Modal
- **Evidence:** `setTimeout(onClose, autoCloseMs)` on a `role="dialog" aria-modal` with focus moved to the panel; confetti animates infinitely.
- **Impact:** Violates WCAG 2.2.1 (timing adjustable) for a focus-stealing modal: keyboard/screen-reader users have focus yanked and then removed to `<body>` before the text is read. Meanwhile it sits on the same layer as the check-in exit (see stacking above).
- **Fix:** Make celebrations non-modal (`role="status"` toast/overlay without scroll lock or focus move) or remove auto-close and focus the "Done" button.

### [P2] LatePeriodFullScreenAlert uses `min-h-screen` in a non-scrollable fixed container
- **Location:** `modals/LatePeriodFullScreenAlert.tsx:106,128`
- **Category:** Responsive
- **Evidence:** `fixed inset-0 z-[60] overscroll-contain` containing `flex min-h-screen`; no `overflow-y-auto`.
- **Impact:** On iOS Safari `100vh` is taller than the visible area, so the centred content (and the "Later" button) can sit under the browser toolbar and cannot be scrolled to on a 667px screen with larger text/Bengali strings.
- **Fix:** `min-h-dvh` and `overflow-y-auto` on the container.

### [P2] PeriodLogModal drifts from the shared shell (focus ring, a11y name, theming)
- **Location:** `components/PeriodLogModal.tsx:101-143,218`
- **Category:** Accessibility / Theming
- **Evidence:** no `aria-labelledby` (uses `aria-label`), close button has no `focus-visible` styling (L136-140, violates the project must-follow rule), duplicate `aria-label` on inputs that already have `<label htmlFor>` (L153,170), saved state uses raw `bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400` (L218), panel has no border (`shadow-2xl` only), `setTimeout(onClose, 700)` after save.
- **Impact:** In dark mode the sheet has no visible edge against the scrim; the success chip uses non-token green. Keyboard users cannot see which control is focused on the X.
- **Fix:** Rebuild on the shared shell; use success tokens.

### [P2] "Today" in two modals is computed in UTC, not the user's local day (Bangladesh is UTC+6)
- **Location:** `modals/QuickSymptomModal.tsx:81`, `engagement/TodayCheckInModal.tsx:133`, `app/(main)/layout.tsx:356`, `DashboardClient.tsx:266`
- **Category:** Integrity
- **Evidence:** `new Date().toISOString().slice(0, 10)`
- **Impact:** Between 00:00 and 06:00 local time these logs are saved to *yesterday*, and the "once per day" check-in/late-alert flags use the wrong day key. (PeriodLogModal uses `format(new Date(), 'yyyy-MM-dd')`, which is local, so the app is inconsistent with itself.)
- **Fix:** One shared `localDateStr()` helper (date-fns `format(new Date(), 'yyyy-MM-dd')`) everywhere.

### [P2] Calendar day detail is an inline card, not a sheet; nothing brings it into view on phones
- **Location:** `app/(main)/calendar/CalendarClient.tsx:241-275,805-815` (no `scrollIntoView` in the file)
- **Category:** Responsive
- **Evidence:** `DayDetail` renders inside the right-column flex stack (`lg:sticky`), which stacks below the month grid on small screens.
- **Impact:** Tapping a day on a phone changes content below the fold; nothing visibly happens at the tap site. Desktop is fine (sticky side panel).
- **Fix:** On `< lg`, present DayDetail through the shared shell as a bottom sheet (or scroll it into view).

### [P3] Dead overlay code
- **Location:** `components/ui/DatePicker.tsx` (293 lines, no importers), `components/modals/LatePeriodPrompt.tsx` (only referenced by `__tests__/brand/screens-tokens.test.ts`).
- **Category:** Integrity
- **Impact:** Two extra, divergent patterns for future contributors to copy; DatePicker is probably the leftover of the native `<input type="date">` swap in PeriodLogModal.
- **Fix:** Delete both (and the test reference), or wire them in.

---

## Recommended shape of ONE shared modal shell

A single `components/ui/Dialog.tsx` (replace `Modal`), portalled, with composable parts:

```
<Dialog open onClose variant="sheet|alert|fullscreen" dismissible={true|false}
        initialFocusRef labelledBy|label describedBy accent priority>
  <Dialog.Header title description closeLabel? />   // non-scrolling, X lives here
  <Dialog.Body />                                   // overflow-y-auto, overscroll-contain, the only scroller
  <Dialog.Footer />                                 // sticky actions, safe-area padding
</Dialog>
```

Behaviour contract (everything in one place, none per-consumer):
1. **Portal to `document.body`** (fixes the `.glass` containing-block trap), plus a fixed z-scale tokens: `--z-nav 40`, `--z-overlay 50 (+stack depth)`, `--z-lock 80`, `--z-toast 90`.
2. **Overlay stack manager** (context or tiny store): top-of-stack only handles ESC and backdrop; ref-counted scroll lock (including iOS), `inert` on the app root, queue/priority so check-in/profile/tour/late-alert/lock cannot co-exist; `replace` semantics for check-in -> quick symptom.
3. **Focus**: save and restore the opener, trap Tab, default initial focus to the dialog heading (not an input on touch), `alertdialog` variant focuses the safe/primary button.
4. **Semantics**: `role=dialog|alertdialog`, `aria-modal`, always labelled (id derived with `useId` inside the shell, so a step change can't dangle), translated close label from `t('common.close')`.
5. **Geometry**: below `sm:` a full-width bottom sheet (`rounded-t-3xl`, handle, `max-h-[calc(100dvh-1rem)]`, safe-area bottom padding, drag-to-close optional); `sm:` and up a centred `max-w-md` card. Header and footer fixed, body scrolls. Set `viewport-fit=cover`.
6. **Visual**: one `--scrim` token with a dark variant, one blur level, `bg-card` + border + `shadow-xl` (border visible in dark), accent ring via `--goal-accent`.
7. **Motion**: owned by the shell with `AnimatePresence` outside any conditional, spring on phones and fade on `prefers-reduced-motion` (plus `MotionConfig reducedMotion="user"` at the root); `transition-*` property lists only.
8. **Non-modal variants split out**: celebrations and toasts as `role=status` (no focus move, no lock), the tour as a `spotlight` variant built on the same stack/focus/scroll hooks.
9. Migration order (biggest user impact first): TrialCountdownPill (P0), ProfileCompletion, ProfilesClient edit/delete, PeriodLogModal, Subscription dialogs, Settings/AccountControl logout (merge into one `ConfirmDialog`), TrialExpiredLock, Late alert; delete `DatePicker` and `LatePeriodPrompt`.

## Systemic patterns

- **No portal anywhere**: all overlays are `position: fixed` inside whatever DOM they were rendered in; any ancestor with `backdrop-filter`/`transform`/`filter`/stacking context (the `.glass` header/aside already hit this) breaks them. `.glass` is on many surfaces.
- **ESC/focus/scroll are re-implemented per component** (4 slightly different scroll-lock effects, 5 different ESC patterns, 1 focus trap), so behaviour differs by overlay and conflicts when two are open.
- **Same-`z-50` stacking resolved by DOM order**, with no coordination between independently timed triggers (60s profile prompt, tour, check-in auto-open, late alert, trial lock).
- **Height handling is ad hoc**: only 4 overlays cap height; the two form-heavy ones (profile completion, edit profile) do not and clip on <=667px screens.
- **Hard-coded strings and colours** inside dialogs (English aria-labels; green/black literals) escape i18n and theming.
- **Animation ownership is scattered** (AnimatePresence inside conditionals, springs without reduced-motion), leading to missing exits and unrespected `prefers-reduced-motion`.

## What's working

- `ui/Modal.tsx` has a good base: `role="dialog"`, `aria-modal`, labelled, `overscroll-behavior: contain`, `85dvh` cap with scroll, reduced-motion-aware enter/exit, backdrop click, ESC, tokenised card surface that follows the dark theme, handle bar.
- `OnboardingTour` is the best-behaved overlay: focus capture and restore, Tab wrap, ESC, reduced-motion handling, scroll lock, `aria-describedby`, resize/scroll re-measure; with a bottom-placement fix it would be a model for the shared shell.
- `TodayCheckInModal`/`QuickSymptomModal`/`CelebrationModal` consume the shared shell correctly (ids, accent var, reduced-motion handling for chips).
- Mobile nav and header (`z-40`) are correctly below the standard overlay layer (`z-50`), toasts sit above overlays (`z-70`), and the full-screen late alert/trial lock use appropriate higher tiers.
- DatePicker (although unused) shows good patterns (focus return to input, outside-click/ESC, `aria-haspopup`, `aria-expanded`).
- Form dialogs generally use proper `<label htmlFor>`, `autoComplete`, `inputMode`, `aria-live` error regions (ProfileCompletion, Subscription phone step).
