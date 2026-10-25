/**
 * Database client for the slot's E2E database.
 * Use ONLY for test setup states the UI cannot reach in time (e.g. aging an OTP challenge).
 * Never import `@vesta/shared` prisma directly, which targets vesta_dev.
 */
import { PrismaClient } from '@prisma/client'
import { DATABASE_URL, assertE2eDatabase } from './slot.ts'

assertE2eDatabase(DATABASE_URL)

let client: PrismaClient | undefined

export function getE2eDb(): PrismaClient {
  if (!client) {
    client = new PrismaClient({ datasourceUrl: DATABASE_URL })
  }
  return client
}

export const db = getE2eDb()
export type { PrismaClient }
