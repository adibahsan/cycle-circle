/**
 * Direct database access for test state setup that the UI cannot reach in time
 * (e.g. creating logs days in the past to test stale-state nudges).
 *
 * Always connects to the slot database (assertE2eDatabase guards it).
 */
import { PrismaClient } from '@prisma/client'
import { DATABASE_URL, assertE2eDatabase } from './slot.ts'

assertE2eDatabase(DATABASE_URL)

let client: PrismaClient | null = null

export function getDb(): PrismaClient {
  if (!client) {
    client = new PrismaClient({ datasourceUrl: DATABASE_URL })
  }
  return client
}

export const db = getDb()
