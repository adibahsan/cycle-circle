# Customer portal audit vs pastel reference (2026-10-18)

**Next action:** answer grill round 1 (scope, honest data, toolkit, illustrations, fix order) before any redesign code.

- **Scope:** `apps/web` logged-in portal: dashboard, calendar, insights, symptoms (the "log" page), settings, and the shell and UI primitives.
- **Method:** Impeccable `audit` and the `redesign-existing-projects` checklist. The impeccable detector returned 0 hits.
- **Evidence:** Playwright screenshots (seed persona "Rina", light theme, 1366px and 390px) are in `review/screenshots/e2e/audit-*/`. Five Sonnet subagents read the code, one per page; I re-checked their key claims myself.
- **Reference:** the pastel wellness dashboard. It has a hero with an illustration and a 3-stat strip, "How you might feel" cards, a hormone chart, a cycle-journey stepper with a progress ring, and 6 illustrated toolkit cards.

## Health score: 11/20 (Acceptable: significant work needed)

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 2 | Calendar day buttons have no accessible name: their state is shown by colour only. The charts have no text alternative. There is no skip link. |
| 2 | Performance | 2 | recharts still loads eagerly on /insights. The shell makes 3 fetches after hydration. The dashboard modals load eagerly. |
| 3 | Responsive | 2 | Touch targets of 12–30px: the consistency dots, small buttons, settings contact form and calendar cells (about 40px at 375px). |
| 4 | Theming | 3 | Colours are well tokenised and dark mode is complete. Phase colours used as text fail contrast: follicular 2.2:1, ovulation 2.7:1. |
| 5 | Implementation integrity | 2 | Regressions from the 10-17 audit (emoji, glow, ambient loops). A wrong cycle-overview maths bug. Metrics are duplicated. |

## Implementation integrity verdict: FAIL (partly regressed)

The 2026-10-17 pass removed emoji icons, glow halos and ambient loops. Some of those have come back:

- **Emoji icons:** `apps/web/src/lib/symptoms-data.ts:13+` defines 🔥 🤕 🎈 …, and they render on /symptoms and in the check-in modals.
- **Glow shadow:** `shadow-glow` is on the Symptoms save CTAs at `SymptomsClient.tsx:563,605`.
- **Infinite loops:** `StreakBadge.tsx:101`, `ProgressToUnlockMeter.tsx:102`, and `DashboardClient.tsx:204,439`.

## Top issues (P1)

1. **Cycle overview shows wrong day counts.**
   - Where: `DashboardClient.tsx:829-832`.
   - Problem: luteal is hard-coded to 14 and ovulation to 6, while shared `getCurrentPhase` uses other boundaries. The four blocks add up to cycle length + 1; Rina's add up to 29 on a 28-day cycle. Follicular goes negative on short cycles.
   - Fix: add a shared `getPhaseLengths()`.
2. **Calendar grid is invisible to screen readers.**
   - Where: `CalendarClient.tsx:156`.
   - Problem: the day buttons are unnamed, there are no grid semantics and no arrow keys, and period/fertile/predicted is shown by colour or border only.
3. **Save failures are silent on /symptoms and the quick or check-in modals.**
   - Problem: the save calls use `try/finally` with no catch and show no error UI. `PeriodLogModal` already does this correctly; copy its pattern.
4. **Insights charts have no text alternative.**
   - Problem: there is no `role="img"` or summary, no data table, and the tooltips work with a mouse only. recharts is also still bundled eagerly.
5. **Phase colour used as text fails contrast.**
   - Where: the dashboard ring number.
   - Fix: keep the colour on the ring and set the number in `text-primary`, or add `*-ink` tokens.

Other P1/P2 issues:
- No skip link.
- The settings contact inputs have no accessible name.
- Touch targets are under 44px.
- `<Link><Button>` nesting.
- Heading levels skip from h1 to h3.
- `toISOString()` causes a UTC off-by-one-day bug in Bangladesh (UTC+6), at `CalendarClient.tsx:869`.
- Insights months and digits follow the browser locale rather than the app language.

## Duplicated metrics (dashboard)

The "3 days late" figure appears 4 times on the dashboard: in the ring, the hero pill, the Period Late card and the dashed bar. Confidence 75% appears twice. This is the biggest hierarchy problem: nothing on the page leads.

## Gap vs reference

| Reference block | Today | Data to drive it honestly |
|---|---|---|
| Hero and 3-stat strip (day / phase, fertility, next period) | A ring card | Cycle day, phase and days to next period: yes. "Fertility chance": only as a rule based on the fertile window, which needs sign-off. |
| How you might feel (Energy 68% gauge, Mood, Physical) | None | **No energy, mood or physical model exists.** A % gauge would be invented data. The honest version is phase-keyed copy marked "common in this phase", or the user's own logged symptoms by phase. |
| Hormone chart | None | **No hormone data exists.** The honest version is a typical-curve illustration scaled to the user's cycle length, labelled "typical pattern, not your levels". It carries a medical-claim risk and the Bengali copy needs review. |
| Cycle journey stepper | Cycle overview blocks (with the maths bug) | Yes, after the `getPhaseLengths()` fix. |
| Cycle progress ring | `CycleRing` | Yes. It needs only a restyle. |
| Toolkit: Reflect today | The check-in flow exists | Yes |
| Toolkit: Move, Fuel, Self-care | /content articles | Possible, if the articles are phase-tagged (to verify). |
| Toolkit: Deep breath, Water 6/8, Journal | None | **Needs new features and data models.** There is no water, journal or mood-scale model in `schema.prisma`. |
| Illustrations | **None in `apps/web/public`** | They need to be commissioned or generated. |

## Design-system delta

What already matches:
- The blush page `--color-bg-primary` (#FFF7F8).
- White cards.
- `--color-bg-peach`.
- Pink follicular and lavender luteal.
- Manrope works for the reference headline at 700–800 weight with -0.03em tracking. Set tracking to 0 under `[lang=bn]`.

What to add:
- Six tint and accent pairs, each with a dark-mode value: peach, pink, mint, lavender, sky and sage.
- A 28px panel radius.
- A neutral `shadow-panel`. Today's shadows mix in `--goal-accent`, which tints every shadow pink.
- A `Card tone` prop.
- A display text step.
- A section header with a right-aligned subtitle.

Also needed:
- The ovulation colour is mustard gold, not the reference's mint, so it needs a call.
- Components bypass the `--radius-*` tokens: Card 16px, Modal 24px, Input 12px, segmented control 10px.

## What works (keep)

- `Modal`: `role=dialog`, `aria-modal`, ESC, a focus trap, inert background, overscroll contain and `dvh`.
- `role=switch` toggles, `aria-current` on navigation, safe-area handling and `color-scheme`.
- `transition-all` is used nowhere, and the detector is clean.
- Colours are fully tokenised and there is a dark set for every token.
- Store selectors are used, `DayCell` is memoised, and the insights stats use tabular-nums.

## Recommended commands (after the grill settles scope)

1. **[P1] `$impeccable harden`:** the cycle-overview maths, silent save failures, the UTC date bug and locale-aware digits.
2. **[P1] `$impeccable adapt`:** 44px targets, calendar grid semantics and keyboard support, the skip link and chart alternatives.
3. **[P1] `$impeccable quieter`:** remove the regressed emoji, glow and loops, and de-duplicate the dashboard metrics.
4. **[P2] `$impeccable optimize`:** dynamic recharts and modals, and server-render the shell status.
5. **[P2] `$impeccable shape`, then the redesign, then `$impeccable polish`.**

## Settled redesign plan (grill, 2026-10-18)

Decisions recorded in `docs/adr/0005-portal-redesign-borrows-the-look-not-the-data.md`, plus the new glossary term **Phase pattern** in `GLOSSARY.md`.

**Direction**
- **Full redesign:** the pastel reference becomes the portal's new look and replaces the 10-17 "refine" choice.
- **Data honesty:** borrow the look, never the reference's data. There will be no energy %, hormone chart, water, breathing or journal until those have their own spec and data model.

**Dashboard**
- **Hero:** a headline, an illustration and 3 stats: cycle day and phase, fertile window status, and next period or "late".
- **Phase pattern cards:** her most-logged symptoms in this phase, plus streak and prediction confidence. They show an empty-state line until she has one past cycle with logs.
- **Cycle area:** the cycle journey stepper (phase day ranges from a shared `getPhaseLengths()`) and the progress ring. These take the hormone chart's place.
- **Toolkit (6 cards):** Log period, Check-in, Calendar, Insights, Read for your phase (articles from `Article.cyclePhases`) and Profiles.

**Modes and empty states**
- **Pregnancy:** the same look, with no stepper and no fertile stat. The hero says tracking is coming soon.
- **Menopause:** the same look; the hero shows days since her last period and her symptom pattern, with no predictions.
- **No period logged:** a single "When did your last period start?" CTA, with a dimmed 28-day example stepper and ring labelled "example".

**Colour**
- **Phases:** period is rose-red, follicular pink, ovulation mint/teal, fertile window light mint and luteal lavender. Peach is a neutral warm tint.
- **Goal accent:** only on primary buttons, the active nav item and the profile ring. Page surfaces stay neutral blush.
- **Dark mode:** kept. Each pastel gets a deep tinted surface with a brighter accent, checked to 4.5:1 or better.

**Illustrations**
- **Style:** AI-generated through Canva or Figma image generation (`runcomfy` isn't installed). One soft flat-watercolour set, transparent WebP that works in both themes.
- **Subjects:** a South Asian woman for the hero; for the cards, a drop with petals, a journal, a calendar with a flower, a chart with leaves, an open book and figures of different ages.
- **Placeholder:** drawn icons in tinted badges until the set is approved.

**Naming:** the page stays **Symptoms**.

**Rollout (each PR on its own branch, with screenshots in both themes at desktop and phone sizes)**
0. P1 fixes (≈2–3 h): the cycle-overview maths, silent saves, the UTC date bug, the emoji/glow/loop regressions, calendar a11y, chart alternatives, skip link and 44px targets.
1. Tokens, `Card` tones, the shell and the dashboard (≈1 day).
2. Calendar and symptoms (≈½ day).
3. Insights (≈½ day).
4. Settings, profiles and subscription (≈½ day).
