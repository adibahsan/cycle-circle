# Theming and dark mode audit (apps/web/src)

Method: read globals.css and the brand contract, then grepped every web file outside `app/internal` for hex/rgb literals, Tailwind palette classes, undefined `var(--…)` tokens, `ring-offset`, `color-scheme` and theme plumbing. I computed WCAG ratios with a script (`/tmp/cr.py`) for each dark token pair.

Overall: component code is mostly tokenised. There are no stray `bg-white` or `text-gray-*` classes, and every `var(--…)` resolves except two template-built `on-*` names that do resolve. The dark problems come from three places. The theme is applied late. The surface and border tokens are too close together. Tailwind's default ring-offset colour is white.

How dark is applied: `Providers.tsx:11-12` toggles `.dark` on `<html>` and sets `style.colorScheme` inside a `useEffect`. Tailwind uses `@custom-variant dark (&:where(.dark, .dark *))` (globals.css:3). The theme is stored in zustand/localStorage, with a default of `'light'` (`lib/store.ts:37`). The `dark:` variant is barely used (4 occurrences), because the tokens do the work.

## Dark token contrast (computed)

Dark text on surfaces: all pass with large margins.

| Token | on bg #141A21 | on bg-secondary #1A222B | on card #1F2731 | on peach #2A2433 |
|---|---|---|---|---|
| text-primary #F7EEF0 | 15.4 | 14.1 | 13.2 | 13.2 |
| text-secondary #D6CBD0 | 11.1 | 10.2 | 9.6 | 9.5 |
| text-muted #B9B0BE | 8.4 | 7.7 | 7.2 | 7.2 |
| primary #FF7A99 | 7.1 | 6.5 | 6.1 | 6.1 |
| secondary #C9A3EC | 8.3 | 7.6 | 7.1 | 7.1 |
| gold-ink #E2C27A | 10.2 | 9.4 | 8.8 | 8.8 |
| error #E58A62 | 6.8 | 6.2 | 5.9 | 5.8 |
| menstrual #FF6B7F | 6.4 | 5.9 | 5.5 | 5.5 |

On-* fill pairs, dark (all dark text #1A232C):

| Fill | Ratio |
|---|---|
| action | 6.4 |
| menstrual | 5.8 |
| luteal | 7.5 |
| follicular | 9.5 |
| ovulation | 7.9 |
| fertile | 9.8 |
| goal-accent tracking | 6.4 |
| goal-accent conceive | 9.3 |
| goal-accent pregnancy | 7.5 |
| goal-accent perimenopause | 7.1 |

Light on-* pairs (white on fill) are all at least 4.7, so they pass. The on-* contract holds in both themes.

Dark surface separation (the weak spot):

| Pair | Ratio |
|---|---|
| card #1F2731 vs bg-primary #141A21 | 1.16 |
| bg-secondary vs bg-primary | 1.09 |
| card vs bg-secondary | 1.07 |
| border #2E3945 vs card | 1.28 |
| border vs bg-primary | 1.49 |
| Inside `.app-shell`, border vs card | 1.43 to 1.48 |
| Inside `.app-shell`, card vs bg | 1.20 to 1.23 |

---

### [P1] Theme is applied in a post-hydration effect, so dark users get a white flash on every load
- **Location:** `apps/web/src/components/Providers.tsx:10-13`, `apps/web/src/app/layout.tsx:56-62`, `apps/web/src/lib/store.ts:37`
- **Category:** Theming
- **Evidence:** `useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); … style.colorScheme = … }, [theme])`. The root layout has no inline script, no cookie, and `className` contains no `dark`. The store default is `theme: 'light'`.
- **Impact:** The server HTML is always light. A user who chose dark sees the light page (white `#FFFFFF` cards on `#FFF7F8`) until React hydrates and the effect runs, then the whole page flips. This repeats on every hard navigation and refresh, on phone and desktop. `suppressHydrationWarning` is already on `<html>`, which suggests a pre-paint script was intended. A first-time visitor whose OS is dark never gets dark either, because the default is hard-wired to light and `prefers-color-scheme` is not read.
- **Fix:** Add a small blocking inline script in `<head>` of `app/layout.tsx`. It reads the persisted store key (or a `theme` cookie) and sets `documentElement.classList` and `style.colorScheme` before first paint. Optionally fall back to `matchMedia('(prefers-color-scheme: dark)')` when nothing is stored. Mirror the choice into a cookie so the server can render `class="dark"` directly.

### [P1] Dark surfaces and borders are too close, so cards, inputs and nested panels barely separate
- **Location:** `apps/web/src/app/globals.css:85-93` (dark tokens) and `:118-123` (`.dark .app-shell`)
- **Category:** Theming
- **Evidence:** `--color-bg-primary:#141A21; --color-bg-secondary:#1A222B; --color-bg-card:#1F2731; --color-border:#2E3945`. Measured: card/bg 1.16, secondary/card 1.07, border/card 1.28.
- **Impact:** In dark mode, `Card` (`components/ui/Card.tsx:17`) is bg-card plus a 1.28:1 border plus `shadow-soft`. The shadow is an accent-tinted blur (globals.css:164) that is nearly invisible on a dark page. So the card reads as a flat, slightly lighter slab. Panels that use `bg-secondary border` inside a card (Settings 629/660/862, insights rows at InsightsClient:474, PeriodLogModal inputs, DatePicker field) are 1.07:1 from their parent and are held together only by the faint border. Modals (`Modal.tsx:128`) are bg-card on a black/50 scrim, so they separate from the scrim but not from the card beneath. This matches the "looks bad in dark mode" complaint. Light mode has the same border value (#F6DDE3 on white, 1.28), but a light page tolerates it better.
- **Fix:** Widen the steps in dark:
  - Page darker: `bg-primary #10151B`.
  - Card lighter: `#222C38`.
  - Secondary between them.
  - Border to about `#3A4756` (roughly 1.6 to 1.8 against card).
  Add a dark-only elevation in the shadow utilities, for example `.dark .shadow-soft { box-shadow: 0 0 0 1px rgb(255 255 255 / .04), 0 8px 24px -12px rgb(0 0 0 / .6) }`. Re-verify that text-muted still has at least 4.5 on the new card.

### [P1] Form-control boundaries and the switch "off" state fail 3:1 non-text contrast, worst in dark
- **Location:** `apps/web/src/components/ui/Input.tsx:26`, `apps/web/src/components/ui/DatePicker.tsx:171`, `apps/web/src/components/PeriodLogModal.tsx:158`, `apps/web/src/app/(main)/settings/SettingsClient.tsx:129-137`
- **Category:** Accessibility / Theming
- **Evidence:** `Input` is `border border-[var(--color-border)] bg-[var(--color-bg-card)]`, and it usually sits inside a `Card` that is also `bg-card`. The toggle is `checked ? 'gradient-primary' : 'bg-[var(--color-border)]'` with a `bg-[var(--color-bg-card)]` knob.
- **Impact:** In dark, the input has the same fill as its card and a 1.28:1 border, so the field outline is almost invisible. The off-state switch is track #2E3945 on card #1F2731 (1.28:1), and the knob (card colour, #1F2731) on the track is also 1.28:1. A user cannot tell where the switch is or which side the knob is on. The same ratios apply in light (#F6DDE3 on white). Text and placeholders are fine; only the control shape is lost. This fails WCAG 1.4.11 in both themes, and visibly in dark.
- **Fix:** Add a dedicated `--color-border-strong` (at least 3:1 against card, for example about `#6B7A8A` in dark and `#B9A3AB` in light) and use it for input, select, date and switch-track outlines. Keep the soft `--color-border` for card hairlines. Give the off knob a contrasting fill (`text-secondary`, or a white or near-white knob).

### [P1] `ring-offset-2` is used 69 times with no offset colour, so Tailwind v4 paints a white halo around focus rings in dark
- **Location:** `apps/web/src/components/ui/Button.tsx:16`; 69 matches across 32 files. Examples: `app/(marketing)/layout.tsx:18`, `components/ui/LanguageToggle.tsx:20`, `components/TrialCountdownPill.tsx:294`, `app/(main)/content/ContentClient.tsx:236`, `components/PeriodLogModal.tsx:158`. Only `CelebrationModal.tsx:174` and `TodayCheckInModal.tsx:317` override `--tw-ring-offset-color`.
- **Category:** Theming / Accessibility
- **Evidence:** `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]`. Tailwind 4.3's compiled default is `--tw-ring-offset-color: #fff` (confirmed in `node_modules/.pnpm/tailwindcss@4.3.0/.../dist/lib.js`).
- **Impact:** In dark, every keyboard-focused button, link, input and chip gets a 2px solid white gap between the element and its coloured ring. It looks like a glitchy white outline against the navy surfaces. Light mode is fine.
- **Fix:** Set a global default once in `@layer base`: `:root{--tw-ring-offset-color: var(--color-bg-card)}` (or bg-primary). A better option is to set `--tw-ring-offset-color` via `@property`/`:root` so it follows `.dark`. Do not edit all 69 sites.

### [P1] Phase strip on the dashboard builds a 8-digit hex from a CSS variable, so the tint is dropped and the label text is the raw phase colour
- **Location:** `apps/web/src/app/(main)/dashboard/DashboardClient.tsx:845-858`, `apps/web/src/app/(main)/content/ContentClient.tsx:336-339`
- **Category:** Theming / Accessibility
- **Evidence:** `const color = getPhaseColor(ph)` returns `'var(--color-follicular)'`. Then `backgroundColor: \`${color}20\``, `outline: \`2px solid ${color}\`` and `style={{ color }}`. In ContentClient: `backgroundColor: \`${getPhaseColor(...)}20\``, `color: getPhaseColor(...)` at `text-[9px]`.
- **Impact:** `var(--color-follicular)20` is invalid CSS, so the browser drops the declaration and the intended 12% tint never renders. The four phase tiles and the content phase chips are untinted. The text is then drawn in the raw phase colour at 11px (dashboard) and 9px (content). On the white card in light: follicular 2.15:1, ovulation 2.65:1, menstrual 4.96, luteal 4.73, so follicular and ovulation fail AA badly. Dark passes (at least 5.5), so this is mainly a light-mode failure. It also violates the brand contract, which says tints must use `color-mix(...)` instead of 8-digit hex.
- **Fix:** Use `backgroundColor: \`color-mix(in srgb, ${color} 14%, var(--color-bg-card))\``. Keep label text in `--color-text-primary`/`secondary` and show the phase colour with a dot or border. The outline at line 854 is valid and can stay.

### [P2] Theme selection does not apply before hydration, and the colour-scheme declaration disagrees with the app toggle
- **Location:** `apps/web/src/app/globals.css:327-329` (`:root{color-scheme: dark light}`), `apps/web/src/components/Providers.tsx:12`
- **Category:** Theming
- **Evidence:** CSS declares `color-scheme: dark light` (OS-driven) until the effect writes an inline `color-scheme`. The app theme is user-driven.
- **Impact:** Until JS runs, scrollbars, native date, select and autofill follow the OS rather than the app theme. After the effect they follow the app theme. A user whose OS is light but who picked dark gets light native widgets briefly. After hydration it works: `.style.colorScheme` is correctly set to `dark` or `light`, so native date pickers, scrollbars and selects do flip. There is no `<select>` in the web app, and the native `type="date"` inputs sit at `PeriodLogModal.tsx:152,169`, `ProfilesClient.tsx:478` and `OnboardingClient.tsx:484`. These render dark controls after hydration only.
- **Fix:** Solved by the inline pre-paint script above. Also change the CSS to `:root{color-scheme: light}` and `.dark{color-scheme: dark}` so the stylesheet alone is correct. Add `<meta name="theme-color">` per scheme via the Next `viewport` export, because none exists today and the mobile browser chrome stays light in dark mode.

### [P2] Recharts default cursor is a light `#ccc` shape, so chart hover looks wrong in dark
- **Location:** `apps/web/src/app/(main)/insights/InsightsClient.tsx:238` (line/area tooltip) and `:346` (bar tooltip)
- **Category:** Theming
- **Evidence:** `<Tooltip contentStyle={{ background:'var(--color-bg-card)', … }} … />` with no `cursor` prop. Recharts 3.8.1 `component/Cursor.js:99` defaults to `stroke:'#ccc'`.
- **Impact:** On hover or tap, a pale grey vertical line (line chart) or rectangle (bar chart) is drawn over the dark card. The tooltip box itself is tokenised and legible.
- **Fix:** Pass `cursor={{ stroke: 'var(--color-border)' }}` for the line chart. For the bar chart pass `cursor={{ fill: 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)' }}`. Everything else in the charts is already token-based and flips correctly: axes and grid use `--color-text-muted` and `--color-border`, series use `--goal-accent` and `--color-fertile`, and the gradient stops use `--goal-accent`. Dark gridlines (border at 1.28:1) are faint but decorative.

### [P2] Dark scrollbar thumb is nearly invisible and the dark override uses a dead token
- **Location:** `apps/web/src/app/globals.css:302-304,324-326`
- **Category:** Theming
- **Evidence:** `scrollbar-color: var(--color-border) transparent`; `.dark ::-webkit-scrollbar-thumb { background: var(--color-dark-border) }`
- **Impact:** The thumb is #2E3945 on #141A21 (1.49:1) and #2E3945 on card (1.28:1), so users cannot see where long modals and lists scroll. `--color-dark-border` (and the other `--color-dark-*` tokens at lines 57-62) is the only reference to the dark-prefixed tokens. They duplicate `.dark` values and will drift. `* { scrollbar-width: thin }` makes Chromium 121+ ignore the `::-webkit-scrollbar` rules, so the `.dark` rule is mostly dead anyway.
- **Fix:** Use `scrollbar-color: var(--color-text-muted) transparent` with reduced opacity, or the new strong-border token. Delete the `--color-dark-*` tokens and the dead `.dark ::-webkit-scrollbar-thumb` rules.

### [P2] Light-theme `--color-secondary` used as small link text misses AA on bg-primary and bg-secondary
- **Location:** `apps/web/src/app/(auth)/login/page.tsx:214-216` (11px legal links, bg-primary page); `apps/web/src/app/(main)/settings/SettingsClient.tsx:863` and `:872,:879` (these sit on bg-card, so 4.73 passes). Also `TrialCountdownPill.tsx:480` for primary text.
- **Category:** Accessibility / Theming
- **Evidence:** `text-[var(--color-secondary)]` (#8E5BC4) at `text-[11px]`. Computed: on white 4.73, on #FFF7F8 4.48, on #FFEEF1 4.22.
- **Impact:** The login legal links fail AA by a hair (4.48 < 4.5) at 11px in light. Dark passes (7.1 to 8.3). The brand contract's AA fallback rule covers primary and gold-ink only, not secondary, so secondary-as-text on bg-primary or bg-secondary is a real gap.
- **Fix:** Use `--color-text-primary` with an underline for legal links, or darken light-theme `--color-secondary` to about `#7F4DB8` (at least 5:1 on #FFEEF1). Extend the contract rule to cover secondary.

### [P2] Logo disc is a literal hex, shrinks the logo in dark, and is the only hard-coded colour in the shell
- **Location:** `apps/web/src/components/ui/BrandLogo.tsx:19`
- **Category:** Theming
- **Evidence:** `className="rounded-full dark:bg-[#FFF7F8] dark:p-2 …"`
- **Impact:** In dark the full logo sits on a bright #FFF7F8 disc, which is the highest-contrast object on the page and glares against the navy. `dark:p-2` plus an explicit `w-16` or `w-32` class adds 8px padding per side (box-sizing border-box), so the visible mark shrinks by about 25% at 64px (login, `login/page.tsx:93`) and layout rhythm differs between themes. The literal hex also breaks the "no raw hex in components" contract.
- **Fix:** Use `dark:bg-[var(--color-text-primary)]` or add a `--color-logo-disc` token. Keep the size stable by wrapping the image in a sized element with padding on the wrapper. Better, ship a dark-mode variant of the SVG with a light lettering fill.

### [P3] Leftover hard-coded palette colours and old-palette blobs
- **Location:**
  - `apps/web/src/app/(main)/calendar/CalendarClient.tsx:669,676`: `rgba(232,71,108,0.07)` and `rgba(123,197,174,0.06)`. These are old-palette values (pink and sage), not tokens. At 6 to 7% on dark they are invisible, and on light they tint off-brand.
  - `apps/web/src/app/(marketing)/terms/page.tsx:100`: `text-amber-500` icon. 2.1:1 on light bg-secondary, decorative with `aria-hidden`.
  - `apps/web/src/app/(auth)/login/page.tsx:149`: `text-emerald-500` check. 2.5:1 on light, decorative.
  - `apps/web/src/app/(marketing)/layout.tsx:18` and `terms/page.tsx:126`: `focus-visible:ring-rose-500`, which is not goal-accent.
  - `SubscriptionClient.tsx:356,367` and `PeriodLogModal.tsx:218`: amber and green with `dark:` variants. These do work in dark (amber-400 on amber-900/30 is about 8:1, green-400 about 7.6:1), but they bypass the token system.
- **Category:** Theming
- **Evidence:** snippets above.
- **Impact:** Low. Minor off-brand colours, and the light-mode success and warning icons are low contrast, though they are decorative.
- **Fix:** Use `--color-gold-ink`/`--color-error` or add `--color-success`/`--color-warning` tokens, and replace rgba blobs with `color-mix(in srgb, var(--color-primary) 8%, transparent)`.

---

## Systemic patterns

1. **Tokens are the right model, but the dark ramp is compressed.** Text contrast is excellent. Surface, border and shadow are not: card/bg is 1.16 and border/card is 1.28. Everything that depends on those borders for shape (inputs, switches, nested panels, scrollbars, chart grid) is weak in dark. One token change (stronger border, more spread surfaces, a dark elevation shadow) fixes most of the "bad in dark" impression.
2. **Theme state is client-only.** No pre-paint script, no cookie, and the default ignores `prefers-color-scheme`. The result is a flash and wrong native chrome for every dark user on every load.
3. **Tailwind v4 defaults that assume a light page.** Ring-offset white (69 uses) is the confirmed one. Recharts cursor `#ccc` is another. Both need a one-time global override.
4. **Colour string concatenation on `var()` tokens** (`${color}20`) silently produces invalid CSS. Two sites found; the contract's `color-mix` rule is the fix. Raw phase colours used as small text fail AA in light.
5. **The `.dark .app-shell` re-mix** gives goal-tinted surfaces only inside `(main)`. Auth, onboarding, marketing and get-started use the plain dark tokens, so the dark look differs slightly between areas. This is fine, but any token change must be applied in both places (globals.css:85-93 and :118-123).

## What's working

- No `bg-white`, `text-gray-*`, `bg-pink-*` or similar palette classes in components. Surfaces, text and borders go through the CSS variables, so most of the app flips correctly.
- All dark text tokens and all `on-*` fill pairs have comfortable contrast (5.5 to 15.4). The on-* contract is respected in components (`ContentClient`, `Feedback`, `Insights` badges, `Button`).
- Charts use tokens throughout (axis, grid, tooltip, series, gradients), so the insights page is legible in dark apart from the hover cursor.
- `color-scheme` is set on `<html>` after hydration, so native date pickers, scrollbars and form chrome do flip. `.dark .glass` has a proper dark variant. Decorative gradients and blobs in auth, get-started and onboarding use `color-mix` or token colours, so they flip with the theme.
- `Modal.tsx` uses a token-based panel, `overscroll-behavior: contain`, `role="dialog"` and `aria-modal`. Reduced-motion is handled globally. `attn-blink` has a reduced-motion fallback.
