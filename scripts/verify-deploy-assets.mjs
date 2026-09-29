#!/usr/bin/env node
/**
 * Verifies production deploy files referenced by ops/deploy/compose.prod.yml exist in the repo.
 * Does not require Docker or /opt/vesta env files on the host.
 */

import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deployDir = path.join(repoRoot, 'ops/deploy');
const composePath = path.join(deployDir, 'compose.prod.yml');

/** Canonical inventory for VPS v1 (must stay in sync with docs/ops/deploy-artifacts-verification.md). */
const REQUIRED_DEPLOY_PATHS = [
  'ops/deploy/compose.prod.yml',
  'ops/deploy/Dockerfile.web',
  'ops/deploy/Dockerfile.admin',
  'ops/deploy/README.md',
  'ops/deploy/.env.example',
  'ops/deploy/env/web.production.example',
  'ops/deploy/env/admin.production.example',
  'ops/deploy/env/postgres.production.example',
  'ops/deploy/nginx/cycle-circle.conf',
  'ops/deploy/nginx/cycle-circle.bootstrap.conf',
  'ops/deploy/scripts/backup-db.sh',
  'ops/deploy/scripts/apply-letsencrypt-nginx.sh',
  'ops/deploy/scripts/sync-letsencrypt-to-ssl.sh',
  'ops/deploy/scripts/dump-le-metadata.sh',
  'ops/deploy/ssl/README.md',
  'ops/deploy/tls/production-inventory.json',
  'ops/deploy/tls/archives/cycle-circle.com-fullchain.pem',
  'ops/deploy/tls/archives/README.md',
  'ops/deploy/vesta-crontab',
  'ops/docker/postgres/init.sql',
  '.dockerignore',
];

async function pathExists(relativePath) {
  try {
    await access(path.join(repoRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

/** @param {string} composeText */
function pathsFromCompose(composeText) {
  const found = new Set();
  const dockerfileRe = /dockerfile:\s*(\S+)/g;
  let m;
  while ((m = dockerfileRe.exec(composeText)) !== null) {
    found.add(m[1].replace(/^\.\//, ''));
  }
  const bindRe = /-\s+\.\/([^:${}\s]+):/g;
  while ((m = bindRe.exec(composeText)) !== null) {
    found.add(`ops/deploy/${m[1]}`);
  }
  const initMountRe = /-\s+\.\.\/docker\/postgres\/init\.sql:/;
  if (initMountRe.test(composeText)) {
    found.add('ops/docker/postgres/init.sql');
  }
  return [...found];
}

async function main() {
  const missing = [];
  for (const rel of REQUIRED_DEPLOY_PATHS) {
    if (!(await pathExists(rel))) {
      missing.push(rel);
    }
  }

  let composeText;
  try {
    composeText = await readFile(composePath, 'utf8');
  } catch {
    console.error('Missing ops/deploy/compose.prod.yml');
    process.exit(1);
  }

  for (const rel of pathsFromCompose(composeText)) {
    const full = path.join(repoRoot, rel);
    if (!full.startsWith(repoRoot)) {
      missing.push(rel);
      continue;
    }
    if (!(await pathExists(rel))) {
      missing.push(rel);
    }
  }

  if (missing.length > 0) {
    console.error('Deploy asset verification failed. Missing paths:');
    for (const p of [...new Set(missing)].sort()) {
      console.error(`  - ${p}`);
    }
    process.exit(1);
  }

  console.log(
    `Deploy assets OK (${REQUIRED_DEPLOY_PATHS.length} canonical paths + compose references).`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
