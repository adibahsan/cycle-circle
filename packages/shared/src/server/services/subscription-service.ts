import { prisma } from '../db'
import { Prisma } from '@prisma/client'

/**
 * Grant PRO access to a user. Finds an existing subscription and updates it,
 * or creates a new one. Syncs user.subscriptionStatus to PRO.
 */
export async function grantPro(userId: string, adminId: string) {
  const sub = await prisma.subscription.findFirst({ where: { userId } })

  if (sub) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'PRO',
        adminOverride: true,
        adminOverrideBy: adminId,
        adminOverrideAt: new Date(),
      },
    })
  } else {
    await prisma.subscription.create({
      data: {
        userId,
        status: 'PRO',
        adminOverride: true,
        adminOverrideBy: adminId,
        adminOverrideAt: new Date(),
      },
    })
  }

  await prisma.user.update({ where: { id: userId }, data: { subscriptionStatus: 'PRO' } })

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: 'PRO_GRANTED',
      targetType: 'Subscription',
      targetId: userId,
    },
  })

  return { success: true }
}

/**
 * Revoke PRO access from a user. Updates all active PRO subscriptions to LAPSED
 * and syncs user.subscriptionStatus.
 */
export async function revokePro(userId: string, adminId: string) {
  await prisma.subscription.updateMany({
    where: { userId, status: 'PRO' },
    data: {
      status: 'LAPSED',
      adminOverride: true,
      adminOverrideBy: adminId,
      adminOverrideAt: new Date(),
    },
  })

  await prisma.user.update({ where: { id: userId }, data: { subscriptionStatus: 'LAPSED' } })

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: 'PRO_REVOKED',
      targetType: 'Subscription',
      targetId: userId,
    },
  })

  return { success: true }
}

/**
 * Set a user's subscription to an explicit status (PRO | FREE | LAPSED).
 * Updates or creates a Subscription row and syncs user.subscriptionStatus.
 * Writes an audit log entry capturing the previous status.
 */
export async function setSubscriptionStatus(
  userId: string,
  status: 'PRO' | 'FREE' | 'LAPSED',
  adminId: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { subscriptionStatus: true } })
  const previous = user?.subscriptionStatus ?? null
  const now = new Date()

  const existing = await prisma.subscription.findFirst({ where: { userId }, select: { id: true } })
  const resetOnActive = status === 'LAPSED' ? {} : { consecutiveFailures: 0, gracePeriodEndsAt: null }
  if (existing) {
    await prisma.subscription.updateMany({
      where: { userId },
      data: { status, adminOverride: true, adminOverrideBy: adminId, adminOverrideAt: now, ...resetOnActive },
    })
  } else {
    await prisma.subscription.create({
      data: { userId, status, adminOverride: true, adminOverrideBy: adminId, adminOverrideAt: now },
    })
  }

  await prisma.user.update({ where: { id: userId }, data: { subscriptionStatus: status } })

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: `SUBSCRIPTION_SET_${status}`,
      targetType: 'User',
      targetId: userId,
      metadata: { previous } as Prisma.InputJsonValue,
    },
  })

  return { success: true }
}

export async function createCaasTransaction(externalTrxId: string, amount: number) {
  return prisma.caasTransaction.create({
    data: { externalTrxId, amount, status: 'PENDING' },
  })
}

export async function updateCaasTransaction(
  id: string,
  data: {
    status: 'SUCCESS' | 'FAILED'
    subscriptionId?: string
    internalTrxId?: string | null
    referenceId?: string | null
  },
) {
  return prisma.caasTransaction.update({
    where: { id },
    data: {
      status: data.status,
      ...(data.subscriptionId !== undefined && { subscriptionId: data.subscriptionId }),
      ...(data.internalTrxId !== undefined && { internalTrxId: data.internalTrxId }),
      ...(data.referenceId !== undefined && { referenceId: data.referenceId }),
    },
  })
}

export async function upsertProSubscription(
  userId: string,
  phone: string,
  amount: number,
) {
  const existing = await prisma.subscription.findFirst({ where: { userId } })

  if (existing) {
    return prisma.subscription.update({
      where: { id: existing.id },
      data: {
        status: 'PRO',
        bdappsSubscriberId: phone,
        amount,
        consecutiveFailures: 0,
        gracePeriodEndsAt: null,
      },
    })
  }

  return prisma.subscription.create({
    data: {
      userId,
      status: 'PRO',
      bdappsSubscriberId: phone,
      amount,
    },
  })
}

export async function markUserPro(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { subscriptionStatus: 'PRO' },
  })
}

/**
 * Apply a BDApps subscription status to a user. A REGISTERED phone number makes
 * the user PRO; anything else makes them FREE. An admin override always wins.
 * Returns the user's resulting status.
 */
export async function hasAdminOverride(userId: string): Promise<boolean> {
  const row = await prisma.subscription.findFirst({
    where: { userId, adminOverride: true },
    select: { id: true },
  })
  return row !== null
}

/**
 * Set a user's plan from BDApps. `subscriberId` is what later getStatus / unsubscribe
 * calls must use: the masked `tel:<id>` from otp/verify (ADR 0002), or the phone for
 * legacy rows and dev login.
 */
export async function applyBdappsSubscription(
  userId: string,
  subscriberId: string,
  registered: boolean,
): Promise<'FREE' | 'PRO' | 'LAPSED'> {
  if (await hasAdminOverride(userId)) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { subscriptionStatus: true },
    })
    return user.subscriptionStatus
  }

  const existing = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  const status = registered ? 'PRO' : 'FREE'
  const data = {
    status,
    bdappsSubscriberId: subscriberId,
    consecutiveFailures: 0,
    gracePeriodEndsAt: null,
  } as const

  if (existing) {
    await prisma.subscription.update({ where: { id: existing.id }, data })
  } else {
    await prisma.subscription.create({ data: { userId, ...data } })
  }
  await prisma.user.update({ where: { id: userId }, data: { subscriptionStatus: status } })
  return status
}

/**
 * Sync a BDApps status change (webhook or nightly check) onto the user who owns
 * `phone` (`+8801…`). Returns null when no user has that number.
 */
export async function syncBdappsSubscriptionByPhone(phone: string, registered: boolean) {
  const user = await prisma.user.findFirst({ where: { phone }, select: { id: true } })
  if (!user) return null
  // Keep a stored (masked) subscriber id; the phone is only a fallback for legacy rows.
  const subscriberId = (await getBdappsSubscriberId(user.id)) ?? phone
  const status = await applyBdappsSubscription(user.id, subscriberId, registered)
  return { userId: user.id, status }
}

/**
 * Sync a webhook status change by BDApps subscriberId. Masked ids (our app) match the
 * id stored at OTP verify, with or without `tel:`; unmasked `tel:8801…` ids fall back
 * to the user's phone. Returns null when nobody matches.
 */
export async function syncBdappsSubscriptionBySubscriberId(subscriberId: string, registered: boolean) {
  const bare = subscriberId.replace(/^tel:/, '')
  const sub = await prisma.subscription.findFirst({
    where: { bdappsSubscriberId: { in: [`tel:${bare}`, bare] } },
    orderBy: { createdAt: 'desc' },
    select: { userId: true, bdappsSubscriberId: true },
  })
  if (sub?.bdappsSubscriberId) {
    const status = await applyBdappsSubscription(sub.userId, sub.bdappsSubscriberId, registered)
    return { userId: sub.userId, status }
  }
  return /^8801\d{9}$/.test(bare) ? syncBdappsSubscriptionByPhone(`+${bare}`, registered) : null
}

/** The subscriber id stored for a user's latest BDApps subscription, if any. */
export async function getBdappsSubscriberId(userId: string): Promise<string | null> {
  const sub = await prisma.subscription.findFirst({
    where: { userId, bdappsSubscriberId: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { bdappsSubscriberId: true },
  })
  return sub?.bdappsSubscriberId ?? null
}

/** Users whose BDApps subscription we believe is active (for the nightly check). */
export async function listBdappsSubscribers(): Promise<{ userId: string; subscriberId: string }[]> {
  const [rows, legacy] = await Promise.all([
    prisma.subscription.findMany({
      where: { status: 'PRO', adminOverride: false, bdappsSubscriberId: { not: null } },
      select: { userId: true, bdappsSubscriberId: true },
    }),
    // Legacy phone users who are PRO but never got a Subscription row.
    prisma.user.findMany({
      where: {
        subscriptionStatus: 'PRO',
        phone: { not: null },
        subscriptions: { none: {} },
      },
      select: { id: true, phone: true },
    }),
  ])

  const overridden = new Set(
    (
      await prisma.subscription.findMany({
        where: { adminOverride: true, userId: { in: rows.map((r) => r.userId) } },
        select: { userId: true },
      })
    ).map((r) => r.userId),
  )

  const byUser = new Map<string, string>()
  for (const r of rows) {
    if (r.bdappsSubscriberId && !overridden.has(r.userId)) byUser.set(r.userId, r.bdappsSubscriberId)
  }
  for (const u of legacy) {
    if (u.phone && !byUser.has(u.id)) byUser.set(u.id, u.phone)
  }
  return [...byUser].map(([userId, subscriberId]) => ({ userId, subscriberId }))
}

export async function listProSubscriptions() {
  return prisma.subscription.findMany({
    where: { status: 'PRO' },
    include: { user: { select: { phone: true } } },
  })
}

// ---------------------------------------------------------------------------
// Chart-data aggregations for admin Subscriptions section
// ---------------------------------------------------------------------------

export interface SubscriptionChartDateRangeOpts {
  days?: number
  dateFrom?: Date
  dateTo?: Date
}

/**
 * Daily new subscriptions created over the given date range (default: last 30 days).
 * Uses Subscription.createdAt. Gap-fills days with zero for a continuous x-axis.
 */
export async function getSubscriptionTrend(
  opts: SubscriptionChartDateRangeOpts = {},
): Promise<{ date: string; count: number }[]> {
  const { dateTo = new Date(), dateFrom, days = 30 } = opts
  const resolvedFrom =
    dateFrom ?? new Date(new Date(dateTo).setDate(dateTo.getDate() - days + 1))

  const from = new Date(
    Date.UTC(resolvedFrom.getFullYear(), resolvedFrom.getMonth(), resolvedFrom.getDate()),
  )
  const to = new Date(
    Date.UTC(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 23, 59, 59, 999),
  )

  const rows = await prisma.$queryRaw<{ date: string; count: bigint }[]>`
    SELECT
      TO_CHAR(DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
      COUNT(*)::bigint AS count
    FROM "Subscription"
    WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
    GROUP BY DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC')
    ORDER BY DATE_TRUNC('day', "createdAt" AT TIME ZONE 'UTC') ASC
  `

  const lookup = new Map<string, number>()
  for (const row of rows) {
    lookup.set(row.date, Number(row.count))
  }

  const result: { date: string; count: number }[] = []
  const cursor = new Date(from)
  while (cursor <= to) {
    const key = cursor.toISOString().slice(0, 10)
    result.push({ date: key, count: lookup.get(key) ?? 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return result
}

/**
 * Count of subscriptions grouped by status (FREE, PRO, LAPSED).
 */
export async function getSubscriptionStatusBreakdown(): Promise<
  { status: string; count: number }[]
> {
  const rows = await prisma.subscription.groupBy({
    by: ['status'],
    _count: { _all: true },
  })

  return rows.map((r) => ({ status: r.status as string, count: r._count._all }))
}

/**
 * Count of CaasTransactions grouped by status (PENDING, SUCCESS, FAILED, etc.)
 * over the given date range (default: last 30 days).
 */
export async function getCaasResultDistribution(
  opts: SubscriptionChartDateRangeOpts = {},
): Promise<{ result: string; count: number }[]> {
  const { dateTo = new Date(), dateFrom, days = 30 } = opts
  const resolvedFrom =
    dateFrom ?? new Date(new Date(dateTo).setDate(dateTo.getDate() - days + 1))

  const from = new Date(
    Date.UTC(resolvedFrom.getFullYear(), resolvedFrom.getMonth(), resolvedFrom.getDate()),
  )
  const to = new Date(
    Date.UTC(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate(), 23, 59, 59, 999),
  )

  const rows = await prisma.caasTransaction.groupBy({
    by: ['status'],
    _count: { _all: true },
    where: {
      createdAt: { gte: from, lte: to },
    },
  })

  return rows.map((r) => ({ result: r.status, count: r._count._all }))
}

export interface SubscriptionListParams {
  page?: number
  pageSize?: number
  status?: string
}

/**
 * Return a paginated list of subscriptions with optional status filter.
 * Each subscription includes the associated user and latest CAAS transaction.
 */
export async function listSubscriptions(params: SubscriptionListParams = {}) {
  const { page = 1, pageSize = 20, status } = params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (status && status !== 'all') where.status = status

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, phone: true, email: true } },
        caasTransactions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.subscription.count({ where }),
  ])

  return {
    subscriptions,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}
