#!/usr/bin/env node
/**
 * Convert docs/vesta/vesta-srs.html → docs/vesta/vesta-srs.docx
 *
 * The html-to-docx package is intentionally NOT a dependency of this repo.
 * Install it on demand into a scratch dir, then resolve from there so
 * package.json stays clean.
 *
 * Usage:
 *   HTML_TO_DOCX_DIR=/tmp/vesta-html-to-docx node scripts/build-srs-docx.mjs
 *
 * If HTML_TO_DOCX_DIR is unset, defaults to a system tmp path.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const inputPath = path.join(repoRoot, 'docs/vesta/vesta-srs.html');
const outputPath = path.join(repoRoot, 'docs/vesta/vesta-srs.docx');

const scratchDir = process.env.HTML_TO_DOCX_DIR
  || path.join(os.tmpdir(), 'vesta-html-to-docx');

const requireFromScratch = createRequire(path.join(scratchDir, 'package.json'));
const HTMLtoDOCX = requireFromScratch('@turbodocx/html-to-docx');

let html = await readFile(inputPath, 'utf8');

// html-to-docx 1.8 throws on @media / @-rules inside <style>; the converter
// only handles inline styles anyway, so strip the <style> block.
html = html.replace(/<style[\s\S]*?<\/style>/gi, '');

// Also drop any leftover @-rules that might appear inline (defensive).
html = html.replace(/@media[^{]*\{[\s\S]*?\}\s*\}/g, '');

const buffer = await HTMLtoDOCX(html, null, {
  orientation: 'portrait',
  margins: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
  table: { row: { cantSplit: true } },
  pageNumber: false,
  font: 'Calibri',
});

await writeFile(outputPath, buffer);

console.log(`wrote ${outputPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
