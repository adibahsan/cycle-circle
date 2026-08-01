#!/usr/bin/env node
/**
 * Convert docs/vesta/source/SRS.md → docs/vesta/exports/vesta-srs.pdf
 *
 * Pipeline: pandoc (GFM → HTML + CSS) → Chrome headless print
 *
 * Requires:
 *   - pandoc on PATH (brew install pandoc)
 *   - Google Chrome or Chromium for headless PDF print
 *
 * Usage:
 *   node scripts/build-srs-pdf.mjs
 *   pnpm docs:pdf
 */

import { execFileSync, execSync } from 'node:child_process';
import { access, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const inputPath = path.join(repoRoot, 'docs/vesta/source/SRS.md');
const outputDir = path.join(repoRoot, 'docs/vesta/exports');
const outputPath = path.join(outputDir, 'vesta-srs.pdf');
const tempHtmlPath = path.join(outputDir, '.vesta-srs-print.html');
const cssPath = path.join(repoRoot, 'scripts/assets/srs-markdown.css');

const chromeCandidates = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(Boolean);

function requirePandoc() {
  try {
    execFileSync('pandoc', ['--version'], { stdio: 'ignore' });
  } catch {
    console.error('pandoc is required but was not found on PATH.');
    console.error('Install it with: brew install pandoc');
    process.exit(1);
  }
}

async function resolveChrome() {
  for (const candidate of chromeCandidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }

  for (const command of ['chromium', 'google-chrome', 'chrome']) {
    try {
      const resolved = execSync(`command -v ${command}`, {
        encoding: 'utf8',
      }).trim();
      if (resolved) return resolved;
    } catch {
      // try next command
    }
  }

  console.error('Chrome or Chromium is required for PDF export but was not found.');
  console.error(
    'Install Google Chrome, or set CHROME_PATH to your browser executable.',
  );
  process.exit(1);
}

requirePandoc();
const chromePath = await resolveChrome();

await mkdir(outputDir, { recursive: true });

execFileSync(
  'pandoc',
  [
    inputPath,
    '-o',
    tempHtmlPath,
    '--from',
    'gfm',
    '--standalone',
    '--toc',
    '--toc-depth=3',
    '--css',
    cssPath,
    '--metadata',
    'title=Software Requirements Specification — Vesta v1',
    '--metadata',
    'author=Adib',
    '--metadata',
    'date=June 2026',
  ],
  { stdio: 'inherit' },
);

const htmlUrl = pathToFileURL(tempHtmlPath).href;

execFileSync(
  chromePath,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${outputPath}`,
    htmlUrl,
  ],
  { stdio: 'inherit' },
);

await rm(tempHtmlPath, { force: true });

const { size } = await stat(outputPath);

console.log(`wrote ${outputPath} (${(size / 1024).toFixed(1)} KB)`);
