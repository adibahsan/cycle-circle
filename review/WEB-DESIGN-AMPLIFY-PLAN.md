# Web Design Amplify Plan — Colorful, Engaging, Feminine

**Date:** 2026-06-04
**Scope:** `apps/web` (customer-facing). Admin app out of scope.
**Goal:** Make the app feel more colorful and engaging while keeping its established feminine color identity — by *amplifying the existing design system*, adding real SVG illustrations, and activating the motion/micro-interaction layer that is already wired but unused.

---

## Context

`apps/web` already has a cohesive, feminine design system (`apps/web/src/app/globals.css`) — it is simply applied with restraint and under-animated. This is an **evolution, not a rebuild**. The motion runtime (`motion` v12) is installed and used for *entrance* animations only; 3 of 5 hand-written keyframes are defined but never used; there are zero illustrations; and several surfaces are functional-but-flat.

**Locked decisions (from kickoff Q&A):**
1. **Direction:** Amplify the existing palette — keep rose/lavender/coral/teal exactly, but use it more broadly. No new brand hues.
2. **Deliverable:** This plan doc first → implement top surfaces after approval.
3. **Graphics:** Add **real SVG illustrations** (florals/organic feminine motifs, empty-state art, onboarding hero) as inline React components — no binary image assets to manage.
4. **Surfaces:** All — Dashboard, Calendar, Onboarding + Auth/OTP, Content/Profiles/Subscription.

**Existing assets to reuse (do NOT reinvent):**
- Tokens & utilities in `globals.css`: `--color-primary/secondary/accent`, phase colors (`--color-menstrual/follicular/ovulation/luteal/fertile`), `.glass`, `.glass-hover`, `.shadow-soft`, `.shadow-glow`, `.gradient-primary`, `.gradient-warm`, `.page-enter`.
- Dormant keyframes ready to deploy: `.animate-float`, `.animate-breathe`, `.animate-drift` (only `pulse-soft`/`shimmer` are currently used).
- `getPhaseColor()` in `packages/shared/src/utils/cycle-utils.ts:69` → returns the right CSS var per phase. Use this everywhere phase color is needed.
- Primitives: `components/ui/Button.tsx`, `Card.tsx`, `Input.tsx`, `Shimmer.tsx`, `VestaLogo.tsx`.
- Installed skills: **`framer-motion-animator`** (motion patterns) and **`vercel-react-view-transitions`** (route transitions) — consult during implementation.

**Guardrails (from CLAUDE.md UI rules — must hold):**
- No `transition-all` — enumerate properties (Button already does this correctly).
- `focus-visible:ring-*` on every interactive element; `prefers-reduced-motion` already global in `globals.css:154` — every new motion must degrade through it.
- `aria-hidden` on decorative illustrations/icons; `tabular-nums` on counters; `Intl.*` for formatting.
- All new animation must respect `useReducedMotion()` (already used in DashboardClient/CalendarClient/VestaLogo).

---

## Phase 0 — Foundation (do first; everything else builds on it)

These are small, shared changes that the per-surface work depends on.

### 0.1 Extend the palette *application* layer in `globals.css`
Add new **utilities only** (no new color tokens) under `@layer utilities`:
- `.gradient-mesh` — soft multi-stop radial mesh (rose + lavender + coral at low alpha) for page/section backgrounds.
- `.gradient-cool` — lavender→teal (complements existing `gradient-primary`/`gradient-warm`).
- `.bg-phase-tint` helper pattern — phase color at ~10–14% alpha for card backgrounds (currently done ad-hoc with inline `#E8476C22` in calendar/dashboard — standardize it).
- `.text-gradient` — `background-clip: text` rose→lavender for hero headings.
- Activate dark-mode-aware variants for each.

### 0.2 Create a shared motion variants library — `apps/web/src/lib/motion.ts`
Centralize repeated motion patterns so surfaces stay consistent and reduced-motion is handled in one place:
- `fadeInUp`, `staggerContainer`, `staggerItem` (entrance).
- `cardHover` (`whileHover: y:-4 + shadow-glow`, `whileTap: scale .98`).
- `popIn` (success/celebration: scale 0→1 spring).
- `springSoft` transition preset (matches existing `cubic-bezier(0.22,1,0.36,1)` feel).
- Export a `useMotionSafe()` wrapper that returns no-op variants when `useReducedMotion()` is true.

### 0.3 Build an **animated** illustration kit — `apps/web/src/components/illustrations/`
Inline SVG React components, colored via `currentColor`/CSS vars so they theme + dark-mode for free. **Every illustration is alive by default** — animation is a built-in property of the component, not something callers must remember to add. All marked `aria-hidden` / `role="img"` with label where meaningful.

**Animation conventions for the kit:**
- **Ambient loop built in:** each illustration ships with a gentle, looping idle motion so it feels lively at rest (drift, sway, bloom-pulse, twinkle). Prefer CSS keyframes for cheap continuous loops (reuse `.animate-float`/`.animate-breathe`/`.animate-drift`; add `sway`/`bloom`/`twinkle` keyframes to `globals.css` as needed) and `motion` for richer/staggered or interaction-driven motion.
- **Internal part motion:** animate *parts* of each SVG independently (e.g. petals at staggered phase offsets, layered blobs drifting at different speeds, sparkles fading in/out) — far livelier than transforming the whole graphic as one block.
- **Entrance + interaction:** support an entrance reveal (draw-on / scale-in) and, where interactive, `whileHover`/`whileTap` liveliness.
- **`animated` prop + reduced-motion:** expose an `animated` prop (default `true`); when `useReducedMotion()` is true (or `animated={false}`), render the static composed SVG. The global CSS rule covers keyframe-based motion automatically.
- **Perf:** keep ambient loops GPU-friendly (transform/opacity only), low element counts, and pause/avoid heavy loops far below the fold.

**Components (each ships with its signature ambient motion):**
- `Blob.tsx` — organic gradient blobs; **layered blobs drift/float at staggered speeds** for parallax-like background life.
- `FloralAccent.tsx` — feminine line-art motif for headers/dividers; **petals gently sway**, optional draw-on entrance.
- `EmptyState.tsx` — illustration + message; **subtle idle motion** (e.g. floating elements / breathing) so empty screens don't feel dead.
- `CycleBloom.tsx` — petal/bloom motif for the dashboard ring + onboarding completion; **petals bloom open with staggered scale + a slow breathing idle**, phase-tinted via `getPhaseColor()`.
- `AuthHeroArt.tsx` — replaces the CSS-only auth blobs; **continuous floating/drift composition** for an alive entry screen.

### 0.4 Upgrade shared primitives (ripples across every surface)
- **`Button.tsx:16`** — replace hardcoded `focus-visible:ring-rose-500` with `focus-visible:ring-[var(--color-primary)]` (token consistency; ~32 other hardcoded instances tracked as cleanup). Optionally wrap as `motion.button` with `whileTap` (keep CSS `active:scale` as the reduced-motion fallback).
- **`Card.tsx:20`** — promote the existing `hover` styling into a richer (but still subtle) lift; expose an optional `phase` prop to apply `.bg-phase-tint` + phase-colored border using `getPhaseColor()`.
- **`Input.tsx`** — animated focus ring / label float (small).
- Add **`SkeletonText` / richer empty states** leveraging `EmptyState.tsx`.

---

## Per-surface plan (where + how)

> Priority order = Dashboard → Calendar → Onboarding/Auth → Content/Profiles/Subscription. Each surface is already a Client Component (or has one), so `motion` is available.

### A. Dashboard — `apps/web/src/app/(main)/dashboard/DashboardClient.tsx` (highest impact)
- **Background:** apply `.gradient-mesh` + 1–2 `<Blob>` illustrations with `.animate-drift`/`.animate-float` behind the content (replaces the current ad-hoc inline radial blobs).
- **Cycle ring:** keep the existing animated `motion.circle` stroke fill; add a `<CycleBloom>` motif and tint the ring track/number with `getPhaseColor()` for the current phase. Animate the center day number with `popIn` on mount (tabular-nums).
- **Cards grid:** apply `cardHover` from `lib/motion.ts`; tint each card with its phase via the new `Card phase=` prop. Animate the countdown progress bar width (already partially present).
- **Empty/no-profile state:** swap text-only fallback for `<EmptyState>`.

### B. Calendar — `apps/web/src/app/(main)/calendar/CalendarClient.tsx`
- **Day cells:** convert to `motion.button` with `whileHover: scale 1.08`, `whileTap: scale .92`; standardize phase tints via `.bg-phase-tint` + `getPhaseColor()` (replace inline `#E8476C22` literals).
- **Month transitions:** `AnimatePresence` slide (direction-aware: forward/back) on month change — a natural fit for the **`vercel-react-view-transitions`** skill or `motion` x-slide.
- **Legend:** small phase color chips with `breathe` on the active phase.
- **Indicators:** pop-in fertile/ovulation/predicted dots.

### C. Onboarding + Auth/OTP — first impressions
- **Onboarding** (`apps/web/src/app/onboarding/OnboardingClient.tsx`): animate goal-selection cards (`staggerItem`, `whileTap`); visual flow-intensity selector (color-graded droplet icons); **celebratory completion** using `popIn` + `<CycleBloom>` + brief confetti-style `motion` particles (reduced-motion: static checkmark).
- **Auth layout** (`apps/web/src/app/(auth)/layout.tsx:131`): replace CSS-only blobs with `<AuthHeroArt>` + `.animate-float`; richer branding entrance.
- **OTP** (`verify-otp/page.tsx`): staggered digit-box entrance, per-digit focus animation, success state animation before redirect.

### D. Content / Profiles / Subscription (medium impact)
- **Content** (`content/ContentClient.tsx`): phase-accent bar on article cards via `getPhaseColor()`; `cardHover`; smooth article-modal open/close (`AnimatePresence` scale+fade); `<EmptyState>` when a phase filter has no articles.
- **Profiles** (`profiles/ProfilesClient.tsx`): relation color-coding + emoji/`FloralAccent` per card; add/delete animations (`AnimatePresence` layout); animated steppers.
- **Subscription** (`subscription/SubscriptionClient.tsx`): pricing-card `cardHover` + `whileHover` border to `--color-primary`; pulse/glow the "recommended" badge; staggered feature-checkmark reveal; `gradient-primary`/`shadow-glow` CTA emphasis.

---

## Accessibility & performance guardrails

- **Reduced motion:** every `motion` component routes through `useReducedMotion()` / `useMotionSafe()`. The global CSS rule (`globals.css:154`) covers CSS keyframes; JS-driven motion must opt in.
- **Decorative SVGs/icons:** `aria-hidden="true"`; meaningful illustrations get `role="img"` + label.
- **Focus:** keep visible `focus-visible:ring-[var(--color-primary)]` on all interactive elements; never remove outline.
- **Numerics:** `font-variant-numeric: tabular-nums` on the cycle-day number, countdowns, stepper values.
- **Perf:** inline SVG (no extra network); lazy-mount heavy decorative motion below the fold; keep blob/`drift` counts low; verify no CLS from late-loading illustrations; dashboard LCP unaffected (ring/number render server-fast, decoration is non-blocking).
- **Dark mode:** validate phase tints + gradients remain distinguishable on the dark warm-brown backgrounds (`globals.css:50`).
- **Bilingual:** ensure illustrations/decoration don't crowd longer Bengali strings (Noto Sans Bengali).

---

## Implementation phasing (after approval)

1. **Phase 0 foundation** (utilities, `lib/motion.ts`, `components/illustrations/`, primitive upgrades) — unlocks everything, low risk.
2. **Dashboard** — the showcase surface; validate the whole approach here first.
3. **Calendar** — second-highest traffic.
4. **Onboarding + Auth/OTP** — first-impression polish.
5. **Content / Profiles / Subscription** — breadth pass.

Each phase = its own commit set; review visually before moving on.

---

## Verification

- **Run it:** `just w` → exercise each surface in the browser at desktop + mobile widths. (Infra: `just infra` already on PG17.)
- **Automated UI audit:** run the **`ui-review-playwright`** skill — screenshots desktop+mobile + a11y snapshot per page, writes `review/AUTO-UI-REVIEW-{date}.md`. Compare before/after.
- **Reduced motion:** toggle OS "Reduce Motion" → confirm animations collapse, no layout breakage.
- **Dark mode + language:** toggle theme and EN↔BN on each surface; verify contrast and that decoration doesn't overlap content.
- **A11y/lint:** `just typecheck`; keyboard-tab every interactive element for visible focus; check `aria-hidden` on decorative SVGs.
- **Perf:** Lighthouse on Dashboard (LCP/CLS) before vs after; confirm bundle delta is minimal (no new heavy deps — motion already present, SVGs inline).

---

## Out of scope / explicit non-goals
- No new color tokens or brand-hue changes (amplify only).
- No new runtime dependencies (use installed `motion`; SVGs are inline).
- Admin app untouched.
- Email templates (`packages/shared/src/server/email-templates.ts`) — noted as a future consistency cleanup (hardcoded hex), not part of this effort.
