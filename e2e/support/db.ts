/**
 * Prisma against this slot's `vesta_e2e*` database for setup only (states the UI
 * can't reach in time). Do not import `@vesta/shared`'s `prisma` — that reads
 * `DATABASE_URL` from the process env and would hit `vesta_dev`.
 */
import { PrismaClient, type Prisma, type SubscriptionStatus } from '@prisma/client'
import { assertE2eDatabase, DATABASE_URL } from './slot.ts'

assertE2eDatabase(DATABASE_URL)

/** One connection per Playwright worker — shared Postgres is also used by Next + other slots. */
function workerDatasourceUrl(): string {
  const url = new URL(DATABASE_URL)
  url.searchParams.set('connection_limit', '1')
  return url.toString()
}

let client: PrismaClient | null = null

/** Shared Prisma client for this process, locked to the E2E database. */
export function e2eDb(): PrismaClient {
  if (!client) {
    client = new PrismaClient({ datasourceUrl: workerDatasourceUrl() })
  }
  return client
}

/** Alias used by web login specs / the `db` fixture (#120). */
export function getE2eDb(): PrismaClient {
  return e2eDb()
}

export const db = getE2eDb()
export type { PrismaClient }

/** Disconnect the shared client (worker teardown). Safe to call when unused. */
export async function closeE2eDb(): Promise<void> {
  if (!client) return
  const toClose = client
  client = null
  await toClose.$disconnect()
}

export type CreateSubscriptionOpts = {
  userId: string
  status: SubscriptionStatus
  bdappsSubscriberId?: string | null
  adminOverride?: boolean
}

/** Upsert a Subscription row and sync `user.subscriptionStatus` (setup only). */
export async function setUserSubscription(opts: CreateSubscriptionOpts): Promise<void> {
  const prisma = e2eDb()
  const existing = await prisma.subscription.findFirst({
    where: { userId: opts.userId },
    orderBy: { createdAt: 'desc' },
  })
  const data: Prisma.SubscriptionUpdateInput = {
    status: opts.status,
    adminOverride: opts.adminOverride ?? false,
    ...(opts.bdappsSubscriberId !== undefined ? { bdappsSubscriberId: opts.bdappsSubscriberId } : {}),
  }
  if (existing) {
    await prisma.subscription.update({ where: { id: existing.id }, data })
  } else {
    await prisma.subscription.create({
      data: {
        userId: opts.userId,
        status: opts.status,
        adminOverride: opts.adminOverride ?? false,
        bdappsSubscriberId: opts.bdappsSubscriberId ?? null,
      },
    })
  }
  await prisma.user.update({ where: { id: opts.userId }, data: { subscriptionStatus: opts.status } })
}
