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

## Check the handbook

`pnpm handbook:check` confirms the handbook still covers the product. It is not part of CI; run it before a release and after changing a User- or Admin-facing feature. Add `--skip-build` (`node scripts/check-handbook.mjs --skip-build`) for a quick run without the HTML and PDF build. It prints PASS or FAIL per check, with one line per problem saying what to fix, and exits non-zero on any failure.

1. **Route coverage.** Every `page.tsx` in `apps/web` (User) and `apps/admin` (Admin) must be listed in [routes.md](routes.md), either under Covered with the anchor of the section that explains it, or under Excluded with a reason (internal or developer-only pages). API routes are not pages and are not checked. A row for a page that no longer exists, or an anchor that no chapter defines, also fails.
2. **Links and anchors.** Every `[text](#anchor)` and relative file link in the chapters must resolve, and an anchor may be defined only once.
3. **Screenshots.** Every `![..](../screenshots/x.png)` must exist, and every image in `screenshots/` must be used by some chapter.
4. **Build.** `scripts/build-handbook.mjs` must produce the HTML and the PDF (needs pandoc and xelatex). The build rewrites the generated HTML; do not commit it on a chapter branch.

New page in the app: write or extend a section, then add the page to the Covered table in `routes.md`.

## Rebuild the handbook

```bash
pnpm handbook:build        # HTML + PDF with pandoc (3.x) and xelatex; also syncs the HTML into docs/site/vesta/
node scripts/build-handbook.mjs --no-pdf     # HTML only
pnpm handbook:test         # unit tests of the index/outline parser
pnpm docs:check            # the docs-sync drift check (must pass)
pnpm handbook:check        # coverage gate, see below (run before a release)
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
