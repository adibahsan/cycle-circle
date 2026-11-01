# Cycle Circle Handbook (source)

The English handbook for the client's business, ops and support staff. Spec: issue #238. Published as one HTML page on the client docs site (`docs/site/vesta/cycle-circle-handbook.html`, linked from `docs/site/index.html`) and as a PDF.

## Layout

```
docs/handbook/
  index.md            chapter order (parts and chapters); the build reads it top to bottom
  OUTLINE.md          every section: anchor id, screenshot file, owning ticket, device
  TEMPLATE.md         the six section headings and the writing rules
  chapters/<slug>.md  one file per chapter (parallel tickets own disjoint files)
  screenshots/        <anchor>.png, written by the capture project, committed
  build/              pandoc filter, CSS, PDF header
  dist/               build scratch + the PDF (gitignored)
```

Parts: 1 User Guide (phone screenshots), 2 Admin Guide (desktop), 3 Automatic Behaviour, 4 Reference.

## Write or change a section

1. Find the chapter file in [OUTLINE.md](OUTLINE.md) (File, Ticket). Edit only your chapter files.
2. Follow [TEMPLATE.md](TEMPLATE.md). Keep the `{#anchor}` on the section heading.
3. Need another section? Add the row to your chapter's table in OUTLINE.md (`<chapter code>-<slug>`, screenshot `<anchor>.png`) and the heading to the chapter file.
4. Add the screens (below), rebuild, look at the result.

A pull request that changes a User- or Admin-facing feature updates the matching section and screenshot (CODING_STANDARDS.md).

## Rebuild the handbook

```bash
pnpm handbook:build        # HTML + PDF with pandoc (3.x) and xelatex; also syncs the HTML into docs/site/vesta/
node scripts/build-handbook.mjs --no-pdf     # HTML only
pnpm handbook:test         # unit tests of the index/outline parser
pnpm docs:check            # the docs-sync drift check (must pass)
```

Outputs: `docs/vesta/source/cycle-circle-handbook.html` (committed, with `docs/site/vesta/cycle-circle-handbook.html`) and `docs/handbook/dist/cycle-circle-handbook.pdf` (gitignored). Only the integration branch commits the generated HTML; chapter branches leave it alone so parallel tickets never conflict on a generated file.

## Regenerate screenshots

Needs the local Compose stack (Postgres :5431, Mailpit :8025; `pnpm docker:dev`) and the Playwright Chromium.

```bash
pnpm handbook:capture                                   # build web + admin, reset the slot DB + seed, capture every chapter
E2E_SKIP_BUILD=1 pnpm handbook:capture                  # reuse the last build
E2E_SKIP_BUILD=1 pnpm handbook:capture -- --project=handbook-phone getting-started   # one chapter file
```

The capture project is separate from the E2E suite: `e2e/playwright.handbook.config.ts` loads only `e2e/handbook/screens/**/*.shots.ts`, and the E2E config never loads that folder. It uses the same fake BDApps, seeded personas and login helpers, and refuses any page that is not this slot's local web or admin app. Add screens for a chapter in `e2e/handbook/screens/user/<chapter>.shots.ts` (phone) or `screens/admin/<chapter>.shots.ts` (desktop), calling `shot(page, '<anchor>', { suffix })`.
