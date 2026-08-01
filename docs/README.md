# Vesta Documentation

## Layout

| Path | Purpose |
|------|---------|
| [`vesta/source/`](vesta/source/) | Canonical authored docs: SRS, PRD, planning notes, editable HTML source pages |
| [`vesta/exports/`](vesta/exports/) | Generated export artifacts (e.g. `vesta-srs.docx`, `vesta-srs.pdf`) |
| [`site/index.html`](site/index.html) | Source for the client-facing documentation landing page |
| [`archive/flo-research/`](archive/flo-research/) | Archived Flo research (reference only) |

## Static site

Published HTML is synced into [`../static-site/`](../static-site/) at the repo root.

```bash
pnpm docs:sync   # copy source → static-site
pnpm docs:check  # verify no drift
```

## Exports

Rebuild SRS exports from `SRS.md`:

```bash
pnpm docs:docx   # Word (.docx) via pandoc
pnpm docs:pdf    # PDF (rendered markdown style) via pandoc + Chrome
pnpm docs:export # both
```

Requires [pandoc](https://pandoc.org/) on PATH (`brew install pandoc`).
PDF export also requires Google Chrome or Chromium (or set `CHROME_PATH`).
