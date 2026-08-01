#!/usr/bin/env node
/**
 * Convert docs/vesta/source/SRS.md → docs/vesta/exports/vesta-srs.docx
 *
 * Requires pandoc on PATH (brew install pandoc).
 *
 * Usage:
 *   node scripts/build-srs-docx.mjs
 *   pnpm docs:docx
 */

import { execFileSync } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const inputPath = path.join(repoRoot, 'docs/vesta/source/SRS.md');
const outputDir = path.join(repoRoot, 'docs/vesta/exports');
const outputPath = path.join(outputDir, 'vesta-srs.docx');

try {
  execFileSync('pandoc', ['--version'], { stdio: 'ignore' });
} catch {
  console.error('pandoc is required but was not found on PATH.');
  console.error('Install it with: brew install pandoc');
  process.exit(1);
}

await mkdir(outputDir, { recursive: true });

execFileSync(
  'pandoc',
  [
    inputPath,
    '-o',
    outputPath,
    '--from',
    'gfm',
    '--standalone',
    '--toc',
    '--toc-depth=3',
    '--number-sections',
    '--metadata',
    'title=Software Requirements Specification — Vesta v1',
    '--metadata',
    'author=Adib',
    '--metadata',
    'date=June 2026',
  ],
  { stdio: 'inherit' },
);

const { size } = await stat(outputPath);

console.log(`wrote ${outputPath} (${(size / 1024).toFixed(1)} KB)`);
