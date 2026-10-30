/**
 * Drop and recreate a slot's E2E database without `prisma migrate reset` (Prisma refuses that
 * for AI agents). Connects to the server's `postgres` maintenance database, so the target
 * can be missing or in use. The name guard runs first: only `vesta_e2e` / `vesta_e2e_<n>`
 * can ever reach a DROP.
 */
import { PrismaClient } from '@prisma/client'
import { assertE2eDatabase } from './slot.ts'

/** The same server, pointed at the `postgres` maintenance database. */
export function maintenanceUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl)
  url.pathname = '/postgres'
  return url.toString()
}

/** The two statements that reset `name`; throws unless `name` is an E2E database. */
export function resetStatements(databaseUrl: string): string[] {
  assertE2eDatabase(databaseUrl)
  const name = new URL(databaseUrl).pathname.slice(1)
  return [`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`, `CREATE DATABASE "${name}"`]
}

export async function recreateDatabase(databaseUrl: string): Promise<void> {
  const statements = resetStatements(databaseUrl) // guard before any connection
  const admin = new PrismaClient({ datasourceUrl: maintenanceUrl(databaseUrl) })
  try {
    for (const sql of statements) await admin.$executeRawUnsafe(sql)
  } finally {
    await admin.$disconnect()
  }
}
