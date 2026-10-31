import { AUDIT_ACTIONS } from './audit-actions'
import { prisma } from '../db'
import { Prisma } from '@prisma/client'
import { fillDaySeries, resolveDaySeriesRange, type DaySeriesOpts } from '../../utils/day-series'
import { logger } from '../log'
import { isPhoneSubscriberId, setSubscription } from '../adapters/bdapps'
import { recordChurnEvent } from './churn-service'

/** What caused a plan change; recorded on every translog line. */
export type PlanChangeCause =
  | 'otp-verify'
  | 'phone-verify'
  | 'dev-login'
  | 'webhook'
  | 'nightly-check'
  | 'unsubscribe'
  | 'admin'
  | 'unknown'

/** One translog line per plan change (GLOSSARY: Translog). */
function logPlanChange(
  userId: string,
  from: string | null,
  to: string,
  cause: PlanChangeCause,
  extra: Record<string, unknown> = {},
) {
  logger.translog('plan.change', { from, to, cause, changed: from !== to, ...extra }, { userId })
}

/** Outcome of the BDApps unsubscribe step shared by Revoke, Suspend and Delete (ADR 0006). */
export type BdappsUnsubscribeResult =
  | { status: 'unsubscribed' }
  | { status: 'skipped'; reason: 'no-subscriber-id' }
  | { status: 'failed'; error: string }

/** The failure text to show an admin, or null when the unsubscribe worked, was skipped or did not run. */
export function bdappsFailureText(result: BdappsUnsubscribeResult | null | undefined): string | null {
  return result?.status === 'failed' ? result.error : null
}

/**
 * Unsubscribe a user's number on BDApps so they stop being charged. Needs the masked
 * subscriber id stored at OTP verify; legacy phone ids are rejected by BDApps (E1951) so
 * they are skipped. Never throws: a failure comes back as `failed` for the admin to see,
 * and our own change still applies. Does not touch our database.
 */
export async function unsubscribeUserOnBdapps(userId: string, adminId?: string): Promise<BdappsUnsubscribeResult> {
  const subscriberId = await getBdappsSubscriberId(userId)
  if (!subscriberId || isPhoneSubscriberId(subscriberId)) {
    logger.translog('plan.bdapps-unsubscribe', { result: 'skipped', adminId }, { userId })
    return { status: 'skipped', reason: 'no-subscriber-id' }
  }
  try {
    await setSubscription(subscriberId, 'unsubscribe')
    logger.translog('plan.bdapps-unsubscribe', { result: 'unsubscribed', subscriberId, adminId }, { userId })
    return { status: 'unsubscribed' }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    logger.translog('plan.bdapps-unsubscribe', { result: 'failed', subscriberId, adminId, error }, { userId, level: 'error' })
    return { status: 'failed', error }
  }
}

/**
 * Grant PRO access to a user. Finds an existing subscription and updates it,
 * or creates a new one. Syncs user.subscriptionStatus to PRO.
 */
export async function grantPro(userId: string, adminId: string, now: Date) {
  const before = await prisma.user.findUnique({ where: { id: userId }, select: { subscriptionStatus: true } })
  const sub = await prisma.subscription.findFirst({ where: { userId } })

  if (sub) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'PRO',
        adminOverride: true,
        adminOverrideBy: adminId,
        adminOverrideAt: now,
        adminOverrideUnsubFailed: false,
      },
    })
  } else {
    await prisma.subscription.create({
      data: {
        userId,
        status: 'PRO',
        adminOverride: true,
        adminOverrideBy: adminId,
        adminOverrideAt: now,
      },
    })
  }

  await prisma.user.update({ where: { id: userId }, data: { subscriptionStatus: 'PRO' } })

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: AUDIT_ACTIONS.PRO_GRANTED,
      targetType: 'Subscription',
      targetId: userId,
    },
  })
  logPlanChange(userId, before?.subscriptionStatus ?? null, 'PRO', 'admin', { adminId, adminOverride: true })

  return { success: true }
}

/**
 * Revoke PRO access from a user. Updates all active PRO subscriptions to LAPSED
 * and syncs user.subscriptionStatus.
 */
export async function revokePro(userId: string, adminId: string, now: Date) {
  const before = await prisma.user.findUnique({ where: { id: userId }, select: { subscriptionStatus: true } })
  // BDApps first so a failure is known when the override is stored; our side applies either way.
  const bdapps = await unsubscribeUserOnBdapps(userId, adminId)
  await prisma.subscription.updateMany({
    where: { userId, status: 'PRO' },
    data: {
      status: 'LAPSED',
      adminOverride: true,
      adminOverrideBy: adminId,
      adminOverrideAt: now,
      // Skipped (no usable id) is as unconfirmed as failed: only a new masked id ends the override.
      adminOverrideUnsubFailed: bdapps.status !== 'unsubscribed',
    },
  })

  await prisma.user.update({ where: { id: userId }, data: { subscriptionStatus: 'LAPSED' } })

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: AUDIT_ACTIONS.PRO_REVOKED,
      targetType: 'Subscription',
      targetId: userId,
    },
  })
  logPlanChange(userId, before?.subscriptionStatus ?? null, 'LAPSED', 'admin', { adminId, adminOverride: true, bdapps: bdapps.status })
  if (before?.subscriptionStatus === 'PRO') await recordChurnEvent(userId, 'ADMIN_REVOKE', now)

  return { success: true, bdapps }
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
  now: Date,
) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { subscriptionStatus: true } })
  const previous = user?.subscriptionStatus ?? null
  // Taking Pro away also ends BDApps billing (ADR 0006); granting Pro leaves BDApps alone.
  const bdapps: BdappsUnsubscribeResult | null = status === 'PRO' ? null : await unsubscribeUserOnBdapps(userId, adminId)
  const adminOverrideUnsubFailed = !!bdapps && bdapps.status !== 'unsubscribed'

  const existing = await prisma.subscription.findFirst({ where: { userId }, select: { id: true } })
  if (existing) {
    await prisma.subscription.updateMany({
      where: { userId },
      data: { status, adminOverride: true, adminOverrideBy: adminId, adminOverrideAt: now, adminOverrideUnsubFailed },
    })
  } else {
    await prisma.subscription.create({
      data: { userId, status, adminOverride: true, adminOverrideBy: adminId, adminOverrideAt: now, adminOverrideUnsubFailed },
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
  logPlanChange(userId, previous, status, 'admin', { adminId, adminOverride: true, bdapps: bdapps?.status })
  if (previous === 'PRO' && status !== 'PRO') await recordChurnEvent(userId, 'ADMIN_REVOKE', now)

  return { success: true, bdapps }
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
  cause: PlanChangeCause = 'unknown',
  now?: Date,
): Promise<'FREE' | 'PRO' | 'LAPSED'> {
  const before = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { subscriptionStatus: true },
  })
  const override = await prisma.subscription.findFirst({
    where: { userId, adminOverride: true },
    orderBy: { adminOverrideAt: 'desc' },
    select: { bdappsSubscriberId: true, adminOverrideUnsubFailed: true },
  })
  let overrideEnded = false
  if (override) {
    // BDApps reporting a subscription ends the override (ADR 0006): a new masked id always
    // does; the same id only if our unsubscribe worked, else REGISTERED is just the old status.
    const bare = (id: string) => id.replace(/^tel:/, '')
    const newId =
      !!override.bdappsSubscriberId &&
      !isPhoneSubscriberId(subscriberId) &&
      bare(override.bdappsSubscriberId) !== bare(subscriberId)
    if (!registered || !(newId || !override.adminOverrideUnsubFailed)) {
      logger.translog('plan.override-kept', { status: before.subscriptionStatus, cause, registered, subscriberId }, { userId })
      return before.subscriptionStatus
    }
    await prisma.subscription.updateMany({
      where: { userId },
      data: { adminOverride: false, adminOverrideBy: null, adminOverrideAt: null, adminOverrideUnsubFailed: false },
    })
    overrideEnded = true
  }

  const existing = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  const status = registered ? 'PRO' : 'FREE'
  const data = {
    status,
    bdappsSubscriberId: subscriberId,
  } as const

  if (existing) {
    await prisma.subscription.update({ where: { id: existing.id }, data })
  } else {
    await prisma.subscription.create({ data: { userId, ...data } })
  }
  await prisma.user.update({ where: { id: userId }, data: { subscriptionStatus: status } })
  logPlanChange(userId, before.subscriptionStatus, status, cause, { subscriberId, ...(overrideEnded && { overrideEnded }) })
  if (before.subscriptionStatus === 'PRO' && status !== 'PRO') {
    await recordChurnEvent(userId, cause === 'nightly-check' ? 'DAILY_CHECK' : 'BDAPPS_UNSUBSCRIBE', now)
  }
  return status
}

/**
 * Sync a BDApps status change (webhook or nightly check) onto the user who owns
 * `phone` (`+8801…`). Returns null when no user has that number.
 */
export async function syncBdappsSubscriptionByPhone(
  phone: string,
  registered: boolean,
  cause: PlanChangeCause = 'webhook',
) {
  const user = await prisma.user.findFirst({ where: { phone }, select: { id: true } })
  if (!user) return null
  // Keep a stored (masked) subscriber id; the phone is only a fallback for legacy rows.
  const subscriberId = (await getBdappsSubscriberId(user.id)) ?? phone
  const status = await applyBdappsSubscription(user.id, subscriberId, registered, cause)
  return { userId: user.id, status }
}

/**
 * Sync a webhook status change by BDApps subscriberId. Masked ids (our app) match the
 * id stored at OTP verify, with or without `tel:`; unmasked `tel:8801…` ids fall back
 * to the user's phone. Returns null when nobody matches.
 */
export async function syncBdappsSubscriptionBySubscriberId(
  subscriberId: string,
  registered: boolean,
  cause: PlanChangeCause = 'webhook',
) {
  const bare = subscriberId.replace(/^tel:/, '')
  const sub = await prisma.subscription.findFirst({
    where: { bdappsSubscriberId: { in: [`tel:${bare}`, bare] } },
    orderBy: { createdAt: 'desc' },
    select: { userId: true, bdappsSubscriberId: true },
  })
  if (sub?.bdappsSubscriberId) {
    // Pass the id BDApps reported, not the stored one: a different id is a new subscription (ADR 0006).
    const status = await applyBdappsSubscription(sub.userId, `tel:${bare}`, registered, cause)
    return { userId: sub.userId, status }
  }
  return /^8801\d{9}$/.test(bare) ? syncBdappsSubscriptionByPhone(`+${bare}`, registered, cause) : null
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

/**
 * Revoked users (admin override, not Pro) with a masked subscriber id, whether or not our
 * unsubscribe worked. The nightly check asks BDApps about them; `applyBdappsSubscription`
 * decides whether a REGISTERED answer ends the override.
 */
export async function listRevokedSubscribers(): Promise<{ userId: string; subscriberId: string }[]> {
  const rows = await prisma.subscription.findMany({
    where: { adminOverride: true, status: { not: 'PRO' }, bdappsSubscriberId: { not: null } },
    select: { userId: true, bdappsSubscriberId: true },
  })
  return rows
    .filter((r): r is { userId: string; bdappsSubscriberId: string } => !!r.bdappsSubscriberId && !isPhoneSubscriberId(r.bdappsSubscriberId))
    .map((r) => ({ userId: r.userId, subscriberId: r.bdappsSubscriberId }))
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

export type SubscriptionChartDateRangeOpts = DaySeriesOpts

/**
 * Daily new subscriptions created over the given date range (default: last 30 days).
 * Uses Subscription.createdAt. Gap-fills days with zero for a continuous x-axis.
 */
export async function getSubscriptionTrend(
  opts: SubscriptionChartDateRangeOpts,
): Promise<{ date: string; count: number }[]> {
  const { from, to, fromDay, toDay } = resolveDaySeriesRange(opts)

  // Bucket by Bangladesh day (UTC+6), not UTC day. "createdAt" is a UTC timestamp without zone, so tag it UTC first.
  const rows = await prisma.$queryRaw<{ date: string; count: bigint }[]>`
    SELECT
      TO_CHAR(DATE_TRUNC('day', ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka'), 'YYYY-MM-DD') AS date,
      COUNT(*)::bigint AS count
    FROM "Subscription"
    WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
    GROUP BY DATE_TRUNC('day', ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')
    ORDER BY DATE_TRUNC('day', ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka') ASC
  `

  const lookup = new Map<string, number>()
  for (const row of rows) {
    lookup.set(row.date, Number(row.count))
  }

  return fillDaySeries(fromDay, toDay, lookup)
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

export interface SubscriptionListParams {
  page?: number
  pageSize?: number
  status?: string
}

/**
 * Return a paginated list of subscriptions with optional status filter.
 * Each subscription includes the associated user.
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
