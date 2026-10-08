# Layout, alignment, spacing and responsive audit (apps/web)

Scope: `apps/web/src/app/(main)/**`, `(auth)`, `(marketing)`, `onboarding`, `get-started`, `error`/`not-found`, and the app shell in `(main)/layout.tsx`. Static code reading only, no browser run. Widths quoted as "~Npx" are my arithmetic from the Tailwind classes, not measurements.

Root cause of "missing alignments": the container is NOT inconsistent. All `(main)` pages share one `<main>` (`px-4`, `md:max-w-4xl md:px-8`). What differs per page is the vertical rhythm, the heading treatment, and the fact that every `md:` and `lg:` multi-column layout breaks at the wrong width because the 256px sidebar is not counted. Details follow.

---

## Findings

### [P1] Mobile bottom nav has 6 items with `px-3` each and cannot fit 360-390px (worse in Bengali)
- **Location:** `apps/web/src/app/(main)/layout.tsx:122-129` (6 NAV_ITEMS), `:582` (container), `:593` (link `px-3`), `:611` (label `text-[11px]`)
- **Category:** Responsive
- **Evidence:** `<div className="flex items-center justify-around py-2 max-w-md mx-auto">` then `className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full ..."`
- **Impact:** Each link's min-content width is its single-word label plus 24px of padding. English: Dashboard ~76, Calendar ~70, Symptoms ~72, Insights ~64, Learn ~50, Settings ~62, about 394px in total, over a 360px viewport and tight even at 390px. Bengali labels (ক্যালেন্ডার, ড্যাশবোর্ড, ইনসাইটস, সেটিংস) are wider still. Labels cannot wrap, so flex cannot shrink them. The last item (Settings) is pushed off the right edge or the items are squeezed against each other, and the active pill clips. Light and dark are the same.
- **Fix:** Make links `flex-1 min-w-0 px-1`, with `text-[11px] leading-tight truncate` or `text-center` on the label. Or cut the bar to 5 items and move Settings into the header or a "More" entry (an `nav.more` key already exists). Drop `max-w-md` on small screens so it spans the full viewport.

### [P1] Mobile header cannot fit its content at 360-390px
- **Location:** `apps/web/src/app/(main)/layout.tsx:529-562`
- **Category:** Responsive
- **Evidence:** `<header className="... px-4 py-3 flex items-center justify-between md:hidden">` holds a left group (logo 24 + `text-xl font-extrabold` "Cycle Circle" + profile pill) and a right group (TrialCountdownPill + completion ring + theme button + EN/BN toggle). Neither group has `min-w-0`, `flex-wrap` or `shrink`.
- **Impact:** Left group is ~255px or more, right group ~190px or more, against 328px available. The `truncate` on the profile-name span (`:537`) does nothing because its flex parent cannot shrink. Content overflows the viewport or collides with the right-hand controls on phones, most visibly when the trial pill or the completion ring is present.
- **Fix:** On mobile hide the wordmark, or make it `hidden min-[400px]:block`. Give the left group `min-w-0 flex-1` and the profile pill `min-w-0 max-w-[40vw] truncate`. Move the theme toggle into Settings on mobile, as the sidebar already does. Add `shrink-0` to the right group.

### [P1] Two-column layouts use `md:` and `lg:` against the viewport but sit next to a 256px sidebar, so columns get 200-300px
- **Location:**
  - `apps/web/src/app/(main)/settings/SettingsClient.tsx:482` (`md:grid md:grid-cols-2 md:gap-6`)
  - `apps/web/src/app/(main)/feedback/FeedbackClient.tsx:257` (`md:grid-cols-2`) and `:297` (`grid-cols-2 md:grid-cols-4` nested inside half a column)
  - `apps/web/src/app/(main)/subscription/SubscriptionClient.tsx:328`
  - `apps/web/src/app/(main)/profiles/ProfilesClient.tsx:1029`
  - `apps/web/src/app/(main)/dashboard/DashboardClient.tsx:585` (hero `md:flex-row md:gap-8` around a fixed 220px ring, `:149`), `:642` (`md:grid-cols-4`) and `:824` (`md:grid-cols-2`)
  - `apps/web/src/app/(main)/calendar/CalendarClient.tsx:690` and `apps/web/src/app/(main)/symptoms/SymptomsClient.tsx:401` (`lg:w-[480px] lg:shrink-0`, next to a `flex-1` column)
  - Shell constants: `layout.tsx:412` (`md:w-64`) and `:566` (`md:px-8`, `md:max-w-4xl`)
- **Category:** Layout
- **Evidence:** `<main className="flex-1 px-4 pb-24 pt-2 md:pb-8 md:max-w-4xl md:mx-auto md:w-full md:px-8">` next to `<aside className="hidden md:flex md:flex-col md:w-64 ...">`
- **Impact:** At 768px (tablet portrait, small laptop window) the content area is 768-256-64 = 448px. A 2-column grid then gives ~212px per column. The Feedback category picker becomes 4 tiles in ~212px (~45px each). The dashboard hero gets a 220px ring, a 32px gap and a ~148px right column, which squeezes the check-in strip and phase text. At 1024px (`lg`), Calendar and Symptoms give the calendar 480px of a 704px area, leaving the right pane ~208px. At 1280px it is still only ~336px. The user sees cramped, wrapping, misaligned cards on any window between 768 and about 1200px.
- **Fix:** Shift the breakpoints by the sidebar width. Use `lg:` for the 2-col grids (Settings, Feedback, Subscription, Profiles, Dashboard hero and stats) and `xl:` for the 480px calendar split. Or make the shell a container-query host (`@container` on `<main>`, `@2xl:grid-cols-2`). Change the Feedback category grid to `grid-cols-2 xl:grid-cols-4`. Change the Calendar and Symptoms fixed `480px` to `lg:w-[clamp(340px,42%,480px)]`.

### [P1] Symptoms save bar is hard-coded to `bottom-[60px]`, but the bottom nav is ~67px tall, and nothing handles safe-area insets
- **Location:** `apps/web/src/app/(main)/symptoms/SymptomsClient.tsx:596`. Also `apps/web/src/app/(main)/layout.tsx:581-582`, and `apps/web/src/app/layout.tsx` (no `viewport` export, no `viewport-fit=cover`). A grep of `apps/web/src` for `safe-area|env(` finds nothing.
- **Category:** Layout / Responsive
- **Evidence:** `className="fixed bottom-[60px] md:bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-30 lg:hidden"` against the nav `py-2` + link `py-1.5` + 20px icon + 11px label + 1px border, about 67px.
- **Impact:** The "Save N changes" bar is `z-30` under the `z-40` nav and overlaps it by about 7px. Its bottom edge and shadow are hidden under the glass nav, so it looks glued on or clipped, and the offset is wrong as soon as Bengali line-height makes the nav taller. The `md:bottom-4` branch is dead, because the bar is `lg:hidden` and `md` to `lg` gets a bar floating over the main column. In PWA or standalone mode on notched iPhones the nav has no `pb-[env(safe-area-inset-bottom)]`, so the home indicator overlaps the nav items.
- **Fix:** Export `viewport = { viewportFit: 'cover', ... }` and add `pb-[env(safe-area-inset-bottom)]` to the nav. Define `--bottom-nav-h` once, for example 4.25rem plus the inset. Use `bottom-[calc(var(--bottom-nav-h)+0.75rem)]` for the bar and `pb-[calc(var(--bottom-nav-h)+1.5rem)]` on `<main>`. Remove the `md:bottom-4` branch or align it with the real breakpoint.

### [P1] Page title treatment differs on every page (size, weight, margin, tag, even presence)
- **Location:** Table below
- **Category:** Layout
- **Evidence:** See table. Dashboard has no page `h1`, and Content's list view titles itself with an `h2`.
- **Impact:** Moving between tabs, the title jumps between 20px and 30px, bold and extrabold, and the gap to the first card changes. It reads as unaligned and unfinished. Mobile uses `text-xl` on Calendar, Symptoms, Profiles and Content but `text-2xl` on Insights, Settings, Subscription and Feedback.
- **Fix:** One `<PageHeader title subtitle icon? />` component with `h1 text-2xl md:text-3xl font-bold tracking-tight` and subtitle `text-sm text-[var(--color-text-muted)] mt-0.5`, wrapped in `mb-5`. Use it on every page. On the dashboard use it for the greeting, or add an `sr-only` h1.

| Page | File:line | Element and classes | Subtitle | Wrapper margin |
|---|---|---|---|---|
| Dashboard | `DashboardClient.tsx` | none (only `h2` in pregnancy panel `:468`) | none | n/a |
| Calendar | `CalendarClient.tsx:650` | `h1 text-xl font-bold` | `text-sm mt-0.5` | none (parent `gap-4`) |
| Symptoms | `SymptomsClient.tsx:404` | `h1 text-xl font-bold` | `text-sm mt-0.5` | none |
| Insights | `InsightsClient.tsx:571` | `h1 text-2xl font-extrabold` + 20px icon, wrapper `pt-2` | `text-sm` | `gap-1 pt-2` |
| Content | `ContentClient.tsx:213` | `h2 text-xl md:text-2xl font-bold` (detail view `:146` is `h1 text-xl mb-2`) | `text-xs mt-0.5` | `mb-5` |
| Profiles | `ProfilesClient.tsx:1020` | `h1 text-xl md:text-2xl font-bold` | `text-sm mt-0.5` | `pt-3 pb-4` |
| Settings | `SettingsClient.tsx:477` | `h1 text-2xl md:text-3xl font-bold` | none | parent `space-y-6` |
| Subscription | `SubscriptionClient.tsx:319` | `h1 text-2xl md:text-3xl font-bold` | `text-sm mt-0.5` | parent `space-y-6` |
| Feedback | `FeedbackClient.tsx:250` | `h1 text-2xl md:text-3xl font-bold` | `text-sm mt-0.5` | `mb-6` |
| Auth login | `login/page.tsx:96,114` | `h1 text-3xl font-extrabold` brand, then `h2 text-xl` | | |
| Auth email / OTP | `email-login/page.tsx:105`, `verify-otp/page.tsx:193` | `h2 text-2xl font-bold mb-1` (no h1 on the page) | | |
| Legal | `LegalPageShell.tsx:51` | `h1 text-fluid-xl font-bold` | `text-sm mt-1.5` | |
| Onboarding / Get-started | `OnboardingClient.tsx:224` etc. | `text-fluid-xl` / `text-fluid-lg` | | |
| 404 / error | `not-found.tsx:7`, `error.tsx:40` | `h2 text-2xl` / `h2 text-lg font-semibold` | | |

### [P2] Vertical rhythm differs per page: top padding, section gap and bottom padding are all different
- **Location:** Page roots in `DashboardClient.tsx:425`, `CalendarClient.tsx:642`, `SymptomsClient.tsx:396`, `InsightsClient.tsx:561`, `ContentClient.tsx:211`, `ProfilesClient.tsx:1012`, `SettingsClient.tsx:470`, `SubscriptionClient.tsx:312`, `FeedbackClient.tsx:247`. Matching `loading.tsx` skeletons.
- **Category:** Layout
- **Evidence:** See the table.
- **Impact:** First-card offset from the header varies by 8-16px (20px, 24px or 28px including the shell's `pt-2`). Section gaps are 16, 20 or 24px. Symptoms stacks `pb-24` on top of the shell's `pb-24`, giving ~192px of dead scroll space (`SymptomsClient.tsx:396`). Dashboard `loading.tsx:5` uses `max-w-4xl mx-auto p-4` inside the already padded `<main>`, so it shifts 16px inward on mobile and swaps layout (`md:grid-cols-3` against the real 4-up stats grid) when the real page paints. Insights has no `loading.tsx`.
- **Fix:** Adopt the scale at the end of this file. Put a `PageShell` (`flex flex-col gap-5 py-4`) around each client. Remove the extra `pb-24` in Symptoms (`:396`) and the `max-w-4xl mx-auto p-4` in the dashboard skeleton. Mirror the real classes in every skeleton.

| Page | Root classes | Gap between sections | Bottom pad |
|---|---|---|---|
| Dashboard | `flex flex-col gap-5 py-3` | 20 | shell 96 |
| Calendar | `flex flex-col gap-4 py-3` | 16 | shell 96 |
| Symptoms | `flex flex-col gap-4 py-3 pb-24` | 16 | 96 + 96 |
| Insights | `flex flex-col gap-5 py-3` (+ header `pt-2`) | 20 | shell 96 |
| Content | `py-4` + `mb-5` | 20 | shell 96 |
| Profiles | `flex flex-col min-h-[calc(100dvh-8rem)] pb-6`, header `pt-3 pb-4` | 12-16 | 24 + 96 |
| Settings | `py-4 space-y-6` | 24 | shell 96 |
| Subscription | `py-4 space-y-6` (inner `space-y-5`) | 24/20 | shell 96 |
| Feedback | `py-4`, `mb-6` on each block | 24 | shell 96 |

### [P2] Card padding and radius have a clear de-facto scale but many outliers
- **Location:** `components/ui/Card.tsx:12-18` (`rounded-2xl`, `p-3` / `p-5` / `p-7`). Outliers:
  - `DashboardClient.tsx:446` (`py-8 px-6 rounded-2xl` override), `:585` (`rounded-3xl ... p-5 md:p-6`)
  - `ProfilesClient.tsx:823` (modal `p-5`), `ProfilesClient.tsx` rows `p-4`
  - `SettingsClient.tsx:903` (`rounded-2xl p-6`)
  - `SubscriptionClient.tsx` (`rounded-3xl` x3, `p-6`)
  - `login/page.tsx:112` (`rounded-3xl ... p-6`), `CTASection.tsx:15` (`p-10 md:p-14`), `LegalSection.tsx:20` (`p-5 sm:p-6`)
  - `rounded-[10px]` in `CalendarClient.tsx` and `SettingsClient.tsx`
- **Category:** Layout
- **Evidence:** Most-used card is `<Card padding="md">` (p-5, rounded-2xl): 9x on Dashboard, 5x Calendar, 5x Settings, 4x Insights. Hero and promo surfaces use `rounded-3xl`. Row items use `rounded-xl`. Pills use `rounded-full`.
- **Impact:** Cards sitting side by side (Dashboard hero `rounded-3xl p-5/6` against the stats cards `rounded-2xl p-5`, Subscription `rounded-3xl` against the Settings `rounded-2xl`) have visibly different corner radii and inner gutters. Padding is also often layered `padding="md"` plus a `className` override (`py-8`), which `twMerge` accepts but which hides the intent.
- **Fix:** Pin the scale (see the end of the file). Reserve `rounded-3xl` for hero and promo panels only. Replace `rounded-[10px]` with `rounded-xl` or `rounded-lg`. Add `Card` variants `hero` and `compact` instead of one-off overrides.

### [P2] Touch targets below 44px (icon buttons, chips, OTP boxes, theme toggles)
- **Location:**
  - `CalendarClient.tsx:278` (day-detail close: `p-1.5` + 14px icon, ~26px)
  - `CalendarClient.tsx:697`, `:715` (month prev/next: `p-2` + 20px, 36px)
  - `layout.tsx:535` (profile pill `py-1` + `text-xs`, ~26px)
  - `layout.tsx:541-545` (theme button `p-2` + 16px icon, 34px)
  - `(marketing)/layout.tsx:17` and `(auth)/layout.tsx:19` (theme `p-2.5` + 18px, 38px)
  - `LanguageToggle.tsx:17` (`py-1.5 text-sm`, ~32px)
  - `Button` size `sm` (`Button.tsx`, `py-1.5 text-sm` ~32px)
  - `verify-otp/page.tsx:212-235` (6 OTP boxes: ~38px square at 360px)
  - `LandingFooter.tsx:28-52` (text links, no vertical padding, ~20px tall)
- **Category:** Accessibility / Layout
- **Evidence:** e.g. `className="p-1.5 rounded-full ..."` around a `size={14}` icon.
- **Impact:** Hard to tap on phones. The calendar day cells are about 41px (286/7 at 360px), also slightly under. Month navigation and close buttons are the most noticeable.
- **Fix:** Add a shared `min-h-11 min-w-11` (44px) to icon-only buttons (the visual icon can stay small). Raise `Button size="sm"` to `min-h-11`, or use it only on desktop. Give footer links `py-2.5 inline-block`. Let the OTP boxes use `min-w-0` with `aspect-[4/5]` and `gap-2`.

### [P2] Hero CTAs wrap a `<Button>` inside a `<Link>` (invalid nesting, double focus ring, misaligned heights)
- **Location:** `apps/web/src/app/(marketing)/welcome/sections/HeroSection.tsx:78-88`
- **Category:** Accessibility / Layout
- **Evidence:** `<Link href="/get-started"><Button variant="primary" size="lg" className="font-bold min-w-[160px]">` beside a bare `Link` with `px-7 py-3.5 text-lg ... min-w-[160px]`.
- **Impact:** A `<button>` inside an `<a>` is invalid HTML and creates two tab stops. The primary CTA and the secondary link only line up by accident because both use `py-3.5`. A long Bengali CTA label does not wrap because of `min-w-[160px]` with `px-7`, so on 360px it can run wider than the `flex-col` container.
- **Fix:** Add an `asChild` or `href` variant to `Button`, or a `buttonVariants()` class helper, and apply it to the `Link` directly. Give both CTAs the same `w-full sm:w-auto`.

### [P2] Marketing and auth floating controls overlap content at small widths
- **Location:** `apps/web/src/app/(marketing)/layout.tsx:14`, `apps/web/src/app/(auth)/layout.tsx:16`, `LegalPageShell.tsx:30`
- **Category:** Layout
- **Evidence:** `<div className="fixed top-4 right-4 z-50 flex items-center gap-2">` with the toggles, over page content with its own `px-4`.
- **Impact:** On the legal pages, the controls float above the sticky header bar but are not part of its layout (header has `py-3`, content `max-w-3xl`). At 360px they sit over the header's empty right side, which is fine, but they cover the page title or form on short viewports or when the on-screen keyboard shrinks the layout (auth). On the landing page they sit over the hero. Hover and focus ring styles differ between the two layouts (`focus-visible:ring-rose-500` hard-coded at `(marketing)/layout.tsx:19`, `--color-primary` in auth).
- **Fix:** Make the controls part of the header row on legal pages. On auth, keep them in flow (`absolute` inside the form panel, not `fixed`). Use `--goal-accent` for the focus ring.

### [P2] Fixed `100vh` shells (`min-h-screen`, `h-screen`) on mobile
- **Location:** `layout.tsx:403`, `:412` (`md:h-screen`); `(auth)/layout.tsx:14`, `:97`; `app/layout.tsx:73`; `error.tsx:20`; `not-found.tsx:5`; `LatePeriodFullScreenAlert.tsx:126`
- **Category:** Responsive
- **Evidence:** `className="min-h-screen ..."`. The marketing layout and CenteredShell already use `min-h-dvh`.
- **Impact:** On iOS and Android browsers with a collapsing URL bar the shell is taller than the visible area, so centred content (404, error, auth card) sits low and a pointless scroll appears.
- **Fix:** Use `min-h-dvh` everywhere. Use `md:h-dvh` on the sidebar.

### [P2] Tiny text and wide letter-spacing on Bengali strings
- **Location:** 30 occurrences of `text-[9px]`, `text-[10px]` and `text-[11px]`. Examples: `layout.tsx:438,476,611`, `InsightsClient.tsx:591,609`, `ContentClient.tsx:141,155,303,309,317,335` (`uppercase tracking-wider` on category pills), `CalendarClient.tsx:270,750`, `FeedbackClient.tsx:167,189`, `DashboardClient.tsx:540,717,765`, `SymptomsClient.tsx:432,509` (`text-[9px]` badge).
- **Category:** Accessibility / Responsive
- **Evidence:** `text-[10px] font-bold uppercase tracking-wider`, and `text-[11px] ... uppercase tracking-widest`.
- **Impact:** Bengali has no case, so `uppercase` does nothing, but positive `letter-spacing` breaks the joined conjunct shaping and looks gappy. At 9-11px, Bengali glyphs (which need more height than Latin) are hard to read. Pill and badge text also has no `whitespace-nowrap` or truncation, so a long BN category name wraps inside a pill with `py-0.5` and the pill grows irregularly.
- **Fix:** Minimum 11px for labels and 12px for body (`text-xs`). Drop `tracking-*` when `i18n.language === 'bn'` (a `[lang=bn] .tracking-*` rule, or a `.label-caps` utility that is neutral in BN). Add `max-w-full truncate` or `whitespace-nowrap` on pills.

### [P2] Number columns without `tabular-nums` (counters, dates, badges)
- **Location:** Present only in 13 files (Insights, Calendar x2, Dashboard x1, Onboarding, trial pill, streak, progress meter, legal). Missing on e.g. `FeedbackClient.tsx:189` (date, `text-[10px]`), `ProfilesClient.tsx` (`{profiles.length} / {MAX_PROFILES}` subtitle, age and cycle-length stats), `SubscriptionClient.tsx` (price and plan comparison columns, `:469-488` `grid-cols-3`), `SymptomsClient.tsx:432,509` (count badges), `DashboardClient.tsx:865` (`{days}d`).
- **Category:** Layout
- **Evidence:** `<span className="text-[11px] md:text-xs text-[var(--color-text-muted)]">{days}d</span>`
- **Impact:** Digits jitter and misalign in the pricing table and in the stat and counter rows. The effect is subtle in Manrope but visible in the pricing table and phase day counts.
- **Fix:** Add `tabular-nums` to the body or to a `.num` utility and apply it to the listed counters. For Bengali digits, confirm `Noto Sans Bengali` honours `tnum` (it often does not), and give the badge a `min-w` instead.

### [P2] Landing page section rhythm and container widths are uneven
- **Location:** `HeroSection.tsx:25` (`min-h-dvh px-4 py-24`), `FeaturesSection.tsx:40,43` (`py-20`, `max-w-4xl`), `PhaseShowcaseSection.tsx:18,21` (`py-16`, `max-w-3xl`), `SocialProofSection.tsx:18,21` (`py-16`, `max-w-3xl`), `CTASection.tsx:12,13,15` (`py-20`, `max-w-3xl`, `p-10 md:p-14`), `LandingFooter.tsx:12,13` (`py-10`, `max-w-4xl`)
- **Category:** Layout
- **Evidence:** Section padding goes 96, 80, 64, 64, 80, 40, and widths go 4xl, 3xl, 3xl, 3xl, 4xl.
- **Impact:** The section order is Features (wide), Phases (narrow), Social proof (narrow), CTA (narrow), Footer (wide), so the left edge jumps back and forth down the page. The footer is wider than the CTA directly above it. The CTA panel gets `p-10` on a 360px screen (304px content less 80px padding leaves a cramped 224px for the text).
- **Fix:** Use one container (`max-w-5xl mx-auto px-4 sm:px-6`) and one section rhythm (`py-16 md:py-24`) for all sections. Change the CTA panel to `p-6 sm:p-10 md:p-14`.

### [P3] Input component reserves a permanent 24px error row
- **Location:** `apps/web/src/components/ui/Input.tsx:35-45`
- **Category:** Layout
- **Evidence:** `<p ... className="mt-1 text-sm ... min-h-[20px] ..."> {error || ' '}`
- **Impact:** Every input has about 24px of blank space under it, so spacing between stacked fields reads as `gap-6` while other forms use `gap-3` or `gap-4`. Forms built with `Input` and forms built with raw inputs (feedback textarea, profile modals) look differently spaced. `role="alert"` on an always-present element is also noisy.
- **Fix:** Render the error row only when there is an error, or accept the reserved row but remove other `mb-*` around it. Standardise form gap to `gap-4`.

### [P3] Duplicate `h1` and unlabelled landmark structure in the shell
- **Location:** `layout.tsx:416` (sidebar `h1`), `:532` (mobile header `h1`), plus every page's own `h1`
- **Category:** Accessibility
- **Evidence:** `<h1 className="text-xl font-extrabold ...">Cycle Circle</h1>`
- **Impact:** Each page has two visible `h1`s in the accessibility tree (the brand and the page title) at any one time. Screen reader heading navigation is confusing, and the Dashboard has only the brand `h1`.
- **Fix:** Make the brand a `<span>` or `<p>`. Leave the `h1` to the page.

### [P3] `error.tsx` and `not-found.tsx` are unstyled stubs
- **Location:** `apps/web/src/app/not-found.tsx:5-13`, `apps/web/src/app/error.tsx:38-52`, `apps/web/src/app/(main)/error.tsx`
- **Category:** Layout
- **Evidence:** `not-found` has no horizontal padding on its wrapper (`text-center space-y-4`), hard-coded English copy, and a bespoke button (`px-4 py-2 rounded-xl text-sm`) rather than `Button`. `error.tsx` has `px-6`, uses `h2 text-lg font-semibold` while not-found uses `h2 text-2xl font-bold`, and its buttons are `py-2` (~36px).
- **Impact:** At 360px the 404 text sits flush to the screen edge on long lines. The two screens do not match each other or the rest of the app. Bengali users see English.
- **Fix:** Share one `StatusScreen` with `px-6`, `h1 text-2xl font-bold`, `Button` (min 44px) and i18n strings.

---

## Systemic patterns

1. **Viewport breakpoints ignore the 256px sidebar.** Every `md:`/`lg:` split was probably designed for a full-width screen. This is the single biggest cause of cramped and misaligned columns on tablet and small laptops. Fix once at the shell (container queries or shifted breakpoints).
2. **No shared page scaffold.** Each page hand-writes its root (`py-3` or `py-4`, `gap-4`, `gap-5` or `space-y-6`), its header (`h1` size, weight, margin) and its skeleton. A `PageShell` plus `PageHeader` removes most of the "missing alignment" feeling in one pass.
3. **Fixed pixel offsets for fixed UI** (`bottom-[60px]`, `top-20`, `pb-24`, `lg:w-[480px]`) instead of a shared variable for nav height, header height and safe-area.
4. **Mobile chrome assumes short labels.** The bottom nav (6 items) and the header (wordmark + pill + 3 controls) were sized for English and about 390px; Bengali strings plus 360px overflow.
5. **Sub-44px controls and sub-12px text are the default style** for icon buttons, pills and badges.
6. **Loading skeletons drift from real layouts** (dashboard `p-4 max-w-4xl`, 3-col against the real 4-col, no Insights skeleton), which causes visible layout shift.

## What's working

- One shared `<main>` container (`px-4`, `md:max-w-4xl md:px-8`) for every `(main)` page, so horizontal gutters and max width are already uniform. No per-page `max-w-*` overrides were found.
- Bottom padding `pb-24` on the main column clears the ~67px nav on every page except where it is doubled (Symptoms).
- `Card` defaults (`rounded-2xl`, `p-5`, token colours) are used consistently and cover most surfaces. `Button` and `Input` already use token-driven focus rings and list specific transition properties (no `transition-all` in the files read).
- `min-w-0` and `truncate` are used on most flex rows that hold names (Settings, Profiles, Content, Onboarding, trackers), so long Bengali names generally do not blow out cards.
- `tabular-nums` is applied on the chart axes, the dashboard stat, the trial timer and the streak/progress counters.
- Auth uses a sensible `max-w-sm md:max-w-md` form column, and onboarding and get-started use `text-fluid-*` plus `min-h-dvh`, so those flows scale smoothly.
- The calendar grid uses `grid-cols-7` with `aspect-square` cells and `gap-0.5 md:gap-1`, and stays aligned at all widths.
- Decorative blobs are `pointer-events-none`, `aria-hidden`, and clipped by `overflow-hidden`, so they cause no horizontal scroll.

## Recommended spacing and alignment scale (grounded in current most-common values)

| Token | Value | Based on |
|---|---|---|
| Shell gutter | `px-4` mobile, `md:px-8` | already used by `<main>` |
| Content max width | `max-w-4xl` (896px) for app pages, `max-w-5xl` for landing sections, `max-w-3xl` for legal, `max-w-md` for auth and onboarding | existing values |
| Page vertical padding | `py-4` (24 with shell `pt-2`), bottom handled by the shell variable | 4 pages use `py-4`, 5 use `py-3` |
| Section gap | `gap-5` (20px) in the page stack; `gap-6` between a page header and content on `md+` | median of 4/5/6 in use |
| Card padding | `p-5` default (`Card padding="md"`), `p-3` compact rows, `p-6` for hero panels only | `padding="md"` is used 20+ times |
| Card radius | `rounded-2xl` cards, `rounded-3xl` hero/promo only, `rounded-xl` inner rows and inputs, `rounded-full` pills and buttons | existing counts |
| Intra-card gap | `gap-2` (default), `gap-3` between stacked blocks | `gap-2` is the most common value in every file |
| Page title | `h1 text-2xl md:text-3xl font-bold`, subtitle `text-sm text-muted mt-0.5`, `mb-5` | Settings, Subscription, Feedback |
| Min text | 12px (`text-xs`) for chips, 11px only for the bottom nav label | 30 uses of 9-11px today |
| Touch target | 44px minimum (`min-h-11 min-w-11`) | WCAG 2.5.8 / platform guidance |
| Fixed UI offsets | `--bottom-nav-h` (nav height plus `env(safe-area-inset-bottom)`), `--header-h` | replaces `bottom-[60px]`, `top-20`, `pb-24` |
| Two-column breakpoint | `lg:` for 2-col grids, `xl:` for the 480px calendar split (or `@container`) | sidebar 256px + gutters 64px |
