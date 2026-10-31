#!/usr/bin/env node
/**
 * `pnpm db:drift`: fails when prisma/schema.prisma and prisma/migrations disagree (a model
 * changed without a migration, or a hand-edited migration). Replays the migrations into a
 * throwaway `vesta_shadow` database on the same server, created here if missing. Never pass a
 * real database as the shadow: Prisma wipes it.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const SHARED_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SHADOW = 'vesta_shadow'

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    const line = readFileSync(resolve(SHARED_DIR, '.env.local'), 'utf-8')
      .split('\n')
      .find((l) => l.trim().startsWith('DATABASE_URL='))
    if (line) return line.slice(line.indexOf('=') + 1).trim().replace(/^"|"$/g, '')
  } catch {
    // no .env.local
  }
  throw new Error('DATABASE_URL is not set (env or packages/shared/.env.local)')
}

const withDb = (url, name) => {
  const u = new URL(url)
  u.pathname = `/${name}`
  u.search = ''
  return u.toString()
}

const base = databaseUrl()
const admin = new PrismaClient({ datasourceUrl: withDb(base, 'postgres') })
try {
  const rows = await admin.$queryRaw`SELECT 1 FROM pg_database WHERE datname = ${SHADOW}`
  if (rows.length === 0) await admin.$executeRawUnsafe(`CREATE DATABASE "${SHADOW}"`)
} finally {
  await admin.$disconnect()
}

const res = spawnSync(
  'pnpm',
  [
    'exec', 'prisma', 'migrate', 'diff',
    '--from-migrations', './prisma/migrations',
    '--to-schema-datamodel', './prisma/schema.prisma',
    '--shadow-database-url', withDb(base, SHADOW),
    '--exit-code',
  ],
  { cwd: SHARED_DIR, stdio: 'inherit' },
)
if (res.status === 2) {
  console.error('\ndb:drift: schema.prisma and the migrations disagree. Add a migration (pnpm db:migrate).')
}
process.exit(res.status ?? 1)
