#!/usr/bin/env node
/**
 * Local preflight for VPS ticket 03: public DNS A records → Contabo IPv4.
 * Does not SSH, read secrets, or require Docker.
 */

import { spawnSync } from 'node:child_process';

/** Contabo VPS IPv4 — docs/ops/README.md */
const EXPECTED_V4 = '62.171.155.231';

/** @type {{ resolver: string; hosts: string[] }} */
const DNS_CHECK = {
  resolver: '1.1.1.1',
  hosts: ['cycle-circle.com', 'www.cycle-circle.com', 'admin.cycle-circle.com'],
};

/** Server-side expectations (documentation only — not verified over SSH). */
const SERVER_CHECKLIST = [
  '/opt/vesta clone on main (or agreed release tag) with ops/deploy/compose.prod.yml',
  'COMPOSE_FILE=/opt/vesta/ops/deploy/compose.prod.yml in vesta ~/.bashrc',
  '/opt/vesta/.env.web.production from ops/deploy/env/web.production.example (chmod 600, owner vesta)',
  '/opt/vesta/.env.admin.production from ops/deploy/env/admin.production.example',
  '/opt/vesta/.env.postgres.production from ops/deploy/env/postgres.production.example',
  'CRON_SECRET byte-identical in web and admin env files; JWT_SECRET DIFFERENT in each (ADR 0007)',
  'APP_ENV=production (staging box: staging) in both web and admin env files',
  'POSTGRES_PASSWORD matches password in DATABASE_URL/DIRECT_URL in both app env files',
  'Staging: DEV_MODE=true in .env.web.production; NEXT_PUBLIC_DEV_MODE=true in ops/deploy/.env before web build',
  'Secrets copied from Vercel staging — never from git',
];

/**
 * @param {string} host
 * @param {string} resolver
 * @returns {string[]}
 */
function digA(host, resolver) {
  const result = spawnSync('dig', ['+short', 'A', host, `@${resolver}`], {
    encoding: 'utf8',
  });
  if (result.error) {
    console.error(`dig failed (${result.error.message}). Install bind/dig (macOS: built-in).`);
    process.exit(2);
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function main() {
  let failed = false;

  console.log(`VPS DNS preflight (expected A → ${EXPECTED_V4}, resolver @${DNS_CHECK.resolver})\n`);

  for (const host of DNS_CHECK.hosts) {
    const answers = digA(host, DNS_CHECK.resolver);
    const ok = answers.includes(EXPECTED_V4);
    const status = ok ? 'OK' : 'FAIL';
    console.log(`[${status}] ${host}`);
    console.log(`       A @${DNS_CHECK.resolver}: ${answers.length ? answers.join(', ') : '(no A record)'}`);
    if (!ok) failed = true;
  }

  console.log('\n--- Server checklist (verify on VPS via SSH; not checked by this script) ---');
  for (const line of SERVER_CHECKLIST) {
    console.log(`  • ${line}`);
  }
  console.log('\nRunbook: docs/ops/07-dns-and-env-runbook.md');

  if (failed) {
    console.error('\nDNS preflight failed. Fix records (especially admin.cycle-circle.com) and re-run.');
    process.exit(1);
  }

  console.log('\nDNS preflight passed.');
}

if (process.argv[1]?.endsWith('verify-vps-preflight.mjs')) {
  main();
}
