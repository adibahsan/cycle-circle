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
  'ops/deploy/scripts/install-vesta-crontab.sh',
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

/**
 * Every FQDN in server_name of the self-signed nginx conf must be a DNS: SAN in generate-selfsigned-cert.sh.
 * @param {string} nginxText
 * @param {string} certScriptText
 * @returns {string[]} hostnames missing from the SAN
 */
export function missingSelfSignedSans(nginxText, certScriptText) {
  const stripComments = (t) => t.replace(/#.*$/gm, '');
  const hosts = new Set();
  const re = /\bserver_name\s+([^;]+);/g;
  let m;
  const nginx = stripComments(nginxText);
  while ((m = re.exec(nginx)) !== null) {
    for (const h of m[1].trim().split(/\s+/)) {
      if (h.startsWith('~') || h.startsWith('$') || h === '_' || h === 'localhost') continue;
      if (h.includes('.')) hosts.add(h);
    }
  }
  const sanLine =
    stripComments(certScriptText).match(/-addext\s+"subjectAltName=([^"]+)"/)?.[1] ?? '';
  const sans = sanLine
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.startsWith('DNS:'))
    .map((e) => e.slice(4));
  const covered = (h) =>
    sans.some((s) => {
      if (s === h) return true;
      if (!s.startsWith('*.')) return false;
      const rest = h.slice(h.indexOf('.') + 1);
      return h.indexOf('.') > 0 && rest === s.slice(2);
    });
  return [...hosts].filter((h) => !covered(h)).sort();
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

  const sanMissing = missingSelfSignedSans(
    await readFile(path.join(deployDir, 'nginx/cycle-circle.selfsigned.conf'), 'utf8'),
    await readFile(path.join(deployDir, 'scripts/generate-selfsigned-cert.sh'), 'utf8'),
  );
  if (sanMissing.length > 0) {
    console.error(
      'Self-signed cert SAN mismatch: generate-selfsigned-cert.sh subjectAltName is missing hosts served by cycle-circle.selfsigned.conf:',
    );
    for (const h of sanMissing) {
      console.error(`  - ${h}`);
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
