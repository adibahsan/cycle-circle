/**
 * `pnpm e2e [-- <playwright args>]`: build web + admin for production, reset this slot's
 * vesta_e2e database (drop + create, migrate deploy, seed), check Mailpit, then run Playwright (which
 * starts the fake BDApps and both apps). See e2e/README.md for the env switches.
 *
 * CI project selection is owned by playwright.config.ts (`E2E_SUITE` / `CI_PROJECTS`).
 * This runner only forwards Playwright args; do not list project names in the workflow.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { normalizeCaptureArgs } from '../../scripts/handbook/capture-args.mjs'
import { bangladeshDayOf } from '../support/bangladesh-day.ts'
import { FakeBdappsClient } from '../support/fake-bdapps.ts'
import { assertMailpit } from '../support/mailpit.ts'
import { recreateDatabase } from '../support/reset-db.ts'
import { DB_NAME, E2E_DIR, ENV, PORTS, REPO_DIR, SLOT, assertE2eDatabase } from '../support/slot.ts'

const flag = (name: string) => process.env[name] === '1' || process.env[name] === 'true'

function run(label: string, cmd: string, args: string[], cwd: string, env: Record<string, string> = {}): Promise<void> {
  console.log(`[e2e] ${label}: ${cmd} ${args.join(' ')}`)
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } })
    child.on('error', reject)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${label} exited with ${code}`))))
  })
}

async function build() {
  if (flag('E2E_SKIP_BUILD')) {
    for (const app of ['web', 'admin']) {
      if (!fs.existsSync(path.join(REPO_DIR, 'apps', app, '.next', 'BUILD_ID'))) {
        throw new Error(`E2E_SKIP_BUILD=1 but apps/${app} has no production build; run once without it`)
      }
    }
    console.log('[e2e] skipping build (E2E_SKIP_BUILD=1)')
    return
  }
  // Sequential: two parallel `next build`s on one machine mostly fight for CPU and memory.
  await run('build web', 'pnpm', ['exec', 'next', 'build'], path.join(REPO_DIR, 'apps/web'), ENV.web)
  await run('build admin', 'pnpm', ['exec', 'next', 'build'], path.join(REPO_DIR, 'apps/admin'), ENV.admin)
}

const SHARED_DIR = path.join(REPO_DIR, 'packages/shared')
const prisma = (label: string, ...args: string[]) =>
  run(label, 'pnpm', ['exec', 'prisma', ...args, '--schema', './prisma/schema.prisma'], SHARED_DIR, { ...ENV.db, ...seedEnv })

/** Handbook capture only: seed "today" as the Bangladesh day, as the apps count it (the E2E suite keeps the UTC day). */
let seedEnv: Record<string, string> = {}

/** True when the slot DB already has the schema and the seed (its admin user). */
async function isSeeded(): Promise<boolean> {
  const { PrismaClient } = await import('@prisma/client')
  const db = new PrismaClient({ datasourceUrl: ENV.db.DATABASE_URL })
  try {
    return (await db.user.count({ where: { role: 'ADMIN' } })) > 0
  } catch {
    return false
  } finally {
    await db.$disconnect()
  }
}

async function prepareDatabase() {
  assertE2eDatabase(ENV.db.DATABASE_URL)
  if (flag('E2E_SKIP_RESET')) {
    // Keep the data: only apply pending migrations, and seed a database that is new.
    const seeded = await isSeeded()
    await prisma(`migrate ${DB_NAME}`, 'migrate', 'deploy')
    if (!seeded) await prisma(`seed ${DB_NAME}`, 'db', 'seed')
    else console.log(`[e2e] keeping ${DB_NAME} data (E2E_SKIP_RESET=1)`)
  } else {
    // `prisma migrate reset` is blocked for AI agents, so drop and recreate the slot database
    // ourselves (guarded to vesta_e2e*), then apply every migration and seed.
    console.log(`[e2e] recreating ${DB_NAME}`)
    await recreateDatabase(ENV.db.DATABASE_URL)
    await prisma(`migrate ${DB_NAME}`, 'migrate', 'deploy')
    await prisma(`seed ${DB_NAME}`, 'db', 'seed')
    // Next's data cache (unstable_cache, served stale-while-revalidate) lives on disk and would
    // hand the first request of this run the previous run's rows.
    for (const app of ['web', 'admin']) {
      fs.rmSync(path.join(REPO_DIR, 'apps', app, '.next', 'cache', 'fetch-cache'), { recursive: true, force: true })
    }
  }
  // A fake BDApps left running (E2E_REUSE_SERVERS=1) still holds last run's subscribers.
  await new FakeBdappsClient().reset().catch(() => {})
}

/**
 * Locally, start Mailpit from the dev compose file when it is not reachable and wait for it.
 * Skipped in CI (a service container provides it) and when E2E_MAILPIT_URL points elsewhere.
 */
async function ensureMailpit() {
  try {
    await assertMailpit()
    return
  } catch (e) {
    if (process.env.CI || process.env.E2E_MAILPIT_URL) throw e
  }
  await run('start mailpit', 'docker', ['compose', '-f', path.join(REPO_DIR, 'ops/docker/compose.yml'), 'up', '-d', 'mailpit'], REPO_DIR)
  for (let i = 0; i < 30; i++) {
    try {
      await assertMailpit()
      return
    } catch {
      await new Promise((r) => setTimeout(r, 1_000))
    }
  }
  await assertMailpit() // throws the actionable "not reachable" error
}

async function main() {
  const args = process.argv.slice(2)
  if (args[0] === '--') args.shift()
  // `pnpm handbook:capture -- <name>` and `pnpm handbook:capture <name>` must both filter.
  if (args.includes('--config=playwright.handbook.config.ts')) args.splice(0, args.length, ...normalizeCaptureArgs(args))
  const suite = process.env.CI_PROJECTS?.trim() || process.env.E2E_SUITE || 'all'
  console.log(
    `[e2e] slot ${SLOT}: web :${PORTS.web}, admin :${PORTS.admin}, fake BDApps :${PORTS.fakeBdapps}, db ${DB_NAME}, suite ${suite}`,
  )
  assertE2eDatabase(ENV.db.DATABASE_URL)
  const handbook = args.includes('--config=playwright.handbook.config.ts')
  if (handbook) seedEnv = { SEED_TODAY: bangladeshDayOf(new Date()) }
  await build()
  await ensureMailpit()
  // A full handbook capture runs the Admin shots and the User shots one after the other, each on a freshly
  // reset database: the accounts the User shots create must not leak into Admin aggregates and lists (or back).
  // The Admin files share demo campaigns, articles and totals, so they run one at a time, in file order.
  // Only an unfiltered capture (no project, no file name) is split into the two phases.
  const phases = handbook && args.length === 1 ? [['--project=handbook-admin', '--workers=1'], ['--project=handbook-phone']] : [[]]
  for (const phase of phases) {
    await prepareDatabase()
    await run('playwright', 'pnpm', ['exec', 'playwright', 'test', ...args, ...phase], E2E_DIR)
  }
}

main().catch((e: unknown) => {
  console.error(`[e2e] ${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
})
