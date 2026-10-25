/**
 * Prisma against this slot's `vesta_e2e*` database for setup only (states the UI
 * can't reach in time). Do not import `@vesta/shared`'s `prisma` — that reads
 * `DATABASE_URL` from the process env and would hit `vesta_dev`.
 */
import { PrismaClient, type Prisma, type SubscriptionStatus } from '@prisma/client'
import { assertE2eDatabase, DATABASE_URL } from './slot.ts'

let client: PrismaClient | null = null

/** Shared Prisma client for this process, locked to the E2E database. */
export function e2eDb(): PrismaClient {
  assertE2eDatabase()
  if (!client) {
    client = new PrismaClient({ datasourceUrl: DATABASE_URL })
  }
  return client
}

export type CreateSubscriptionOpts = {
  userId: string
  status: SubscriptionStatus
  bdappsSubscriberId?: string | null
  adminOverride?: boolean
}

/** Upsert a Subscription row and sync `user.subscriptionStatus` (setup only). */
export async function setUserSubscription(opts: CreateSubscriptionOpts): Promise<void> {
  const db = e2eDb()
  const existing = await db.subscription.findFirst({ where: { userId: opts.userId }, orderBy: { createdAt: 'desc' } })
  const data: Prisma.SubscriptionUpdateInput = {
    status: opts.status,
    adminOverride: opts.adminOverride ?? false,
    ...(opts.bdappsSubscriberId !== undefined ? { bdappsSubscriberId: opts.bdappsSubscriberId } : {}),
  }
  if (existing) {
    await db.subscription.update({ where: { id: existing.id }, data })
  } else {
    await db.subscription.create({
      data: {
        userId: opts.userId,
        status: opts.status,
        adminOverride: opts.adminOverride ?? false,
        bdappsSubscriberId: opts.bdappsSubscriberId ?? null,
      },
    })
  }
  await db.user.update({ where: { id: opts.userId }, data: { subscriptionStatus: opts.status } })
}
