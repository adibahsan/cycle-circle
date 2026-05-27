#!/usr/bin/env node

import { copyFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const sourceDir = path.join(repoRoot, 'docs/vesta/source');
const deployDir = path.join(repoRoot, 'static-site/vesta');
const sourceIndex = path.join(repoRoot, 'docs/site/index.html');
const deployIndex = path.join(repoRoot, 'static-site/index.html');

const publishedDocs = [
  'vesta-mvp-plan.html',
  'vesta-srs.html',
  'vesta-user-journey-flows.html',
  'vesta-user-stories.html',
];

const args = new Set(process.argv.slice(2));
const shouldSync = args.has('--sync');
const shouldCheck = args.has('--check') || !shouldSync;

if (args.has('--help')) {
  console.log(`Usage:
  node tools/scripts/sync-netlify-docs.mjs --sync
  node tools/scripts/sync-netlify-docs.mjs --check`);
  process.exit(0);
}

const deployedHtml = (await readdir(deployDir))
  .filter((file) => file.endsWith('.html'))
  .sort();

const unexpected = deployedHtml.filter((file) => !publishedDocs.includes(file));
if (unexpected.length > 0) {
  console.error(`Unexpected static-site Vesta HTML file(s): ${unexpected.join(', ')}`);
  console.error('Add them to publishedDocs in tools/scripts/sync-netlify-docs.mjs if they should be deployed.');
  process.exit(1);
}

let hasDrift = false;

for (const file of publishedDocs) {
  const sourcePath = path.join(sourceDir, file);
  const deployPath = path.join(deployDir, file);

  if (shouldSync) {
    await copyFile(sourcePath, deployPath);
    console.log(`synced ${file}`);
    continue;
  }

  if (shouldCheck) {
    const [source, deployed] = await Promise.all([
      readFile(sourcePath),
      readFile(deployPath),
    ]);

    if (!source.equals(deployed)) {
      hasDrift = true;
      console.error(`drift: ${file}`);
    }
  }
}

if (shouldSync) {
  await copyFile(sourceIndex, deployIndex);
  console.log('synced index.html');
}

if (shouldCheck) {
  const [source, deployed] = await Promise.all([
    readFile(sourceIndex),
    readFile(deployIndex),
  ]);

  if (!source.equals(deployed)) {
    hasDrift = true;
    console.error('drift: index.html');
  }
}

if (shouldCheck) {
  if (hasDrift) {
    console.error('Static site docs are out of sync. Run pnpm docs:sync.');
    process.exit(1);
  }

  console.log('Static site docs are in sync.');
}
