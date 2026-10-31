/**
 * Vitest globalSetup: DB-backed tests never touch the dev database.
 *
 * Picks a dedicated test database, creates it if missing, runs `prisma migrate deploy`
 * against it, then exports it as DATABASE_URL / DIRECT_URL (workers inherit process.env).
 * Order: TEST_DATABASE_URL, then (CI only) the configured URL, else the configured server
 * with database `vesta_test`. Any name outside the allowlist throws.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PrismaClient } from '@prisma/client'

const SHARED_DIR = resolve(__dirname, '../../../../packages/shared')
const LOCAL_ALLOWED = [/^vesta_test$/, /^vesta_vitest$/, /^vesta_e2e(_\d+)?$/]

function loadEnvLocal(): void {
  try {
    const content = readFileSync(resolve(__dirname, '../../.env.local'), 'utf-8')
    for (const line of content.split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i === -1) continue
      const key = t.slice(0, i).trim()
      if (!process.env[key]) process.env[key] = t.slice(i + 1).trim()
    }
  } catch {
    // no .env.local: rely on the environment
  }
}

const dbName = (url: string) => decodeURIComponent(new URL(url).pathname.slice(1))

function isAllowed(name: string, ci: boolean): boolean {
  return LOCAL_ALLOWED.some((re) => re.test(name)) || (ci && name === 'vesta_ci')
}

export function resolveTestDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const ci = !!env.CI
  const configured = env.DATABASE_URL
  let target: string
  if (env.TEST_DATABASE_URL) {
    target = env.TEST_DATABASE_URL
  } else {
    if (!configured) throw new Error('DATABASE_URL is not set; cannot derive a test database.')
    if (ci) {
      target = configured
    } else if (LOCAL_ALLOWED.some((re) => re.test(dbName(configured)))) {
      target = configured
    } else {
      const url = new URL(configured)
      url.pathname = '/vesta_test'
      target = url.toString()
    }
  }
  const name = dbName(target)
  if (!isAllowed(name, ci)) {
    throw new Error(
      `Refusing to run tests against database "${name}". Allowed: vesta_test, vesta_vitest, vesta_e2e[_n]` +
        (ci ? ', vesta_ci' : '') +
        '.',
    )
  }
  return target
}

async function ensureDatabase(targetUrl: string): Promise<void> {
  const admin = new URL(targetUrl)
  admin.pathname = '/postgres'
  admin.search = ''
  const name = dbName(targetUrl)
  const client = new PrismaClient({ datasourceUrl: admin.toString() })
  try {
    const rows = await client.$queryRaw<{ n: number }[]>`SELECT 1 AS n FROM pg_database WHERE datname = ${name}`
    if (rows.length === 0) await client.$executeRawUnsafe(`CREATE DATABASE "${name}"`) // name is allowlist-checked
  } finally {
    await client.$disconnect()
  }
}

export default async function setup(): Promise<void> {
  loadEnvLocal()
  const target = resolveTestDatabaseUrl(process.env)
  await ensureDatabase(target)
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy', '--schema', './prisma/schema.prisma'], {
    cwd: SHARED_DIR,
    env: { ...process.env, DATABASE_URL: target, DIRECT_URL: target },
    stdio: 'pipe',
  })
  process.env.DATABASE_URL = target
  process.env.DIRECT_URL = target
  process.env.VESTA_TEST_DB_NAME = dbName(target)
}
