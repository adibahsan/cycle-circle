# Vesta Documentation

## Layout

| Path | Purpose |
|------|---------|
| [`vesta/source/`](vesta/source/) | Canonical authored docs: SRS, PRD, planning notes, editable HTML source pages |
| [`vesta/exports/`](vesta/exports/) | Generated export artifacts (e.g. `vesta-srs.docx`) |
| [`site/index.html`](site/index.html) | Source for the client-facing documentation landing page |
| [`archive/flo-research/`](archive/flo-research/) | Archived Flo research (reference only) |

## Static site

Published HTML is synced into [`../static-site/`](../static-site/) at the repo root.

```bash
pnpm docs:sync   # copy source → static-site
pnpm docs:check  # verify no drift
```

## Word export

Rebuild the client SRS DOCX from HTML:

```bash
HTML_TO_DOCX_DIR=/tmp/vesta-html-to-docx node tools/scripts/build-srs-docx.mjs
```
