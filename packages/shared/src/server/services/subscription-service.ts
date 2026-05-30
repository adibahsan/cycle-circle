import { prisma } from '../db'

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

export async function handleSubscriptionWebhook(
  phone: string,
  newStatus: 'PRO' | 'LAPSED' | 'FREE',
) {
  const user = await prisma.user.findFirst({
    where: { phone },
    include: {
      subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })

  if (!user) return null

  await prisma.user.update({
    where: { id: user.id },
    data: { subscriptionStatus: newStatus },
  })

  if (user.subscriptions.length > 0) {
    await prisma.subscription.update({
      where: { id: user.subscriptions[0].id },
      data: {
        status: newStatus,
        ...(newStatus === 'PRO' && { consecutiveFailures: 0, gracePeriodEndsAt: null }),
      },
    })
  }

  return user
}

export async function listProSubscriptions() {
  return prisma.subscription.findMany({
    where: { status: 'PRO' },
    include: { user: { select: { phone: true } } },
  })
}

export async function recordSubscriptionCheckResult(
  subscriptionId: string,
  userId: string,
  healthy: boolean,
  currentFailures: number,
) {
  if (healthy) {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { consecutiveFailures: 0 },
    })
    return { lapsed: false }
  }

  const newFailures = currentFailures + 1
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      consecutiveFailures: newFailures,
      status: newFailures >= 3 ? 'LAPSED' : 'PRO',
    },
  })

  if (newFailures >= 3) {
    await prisma.user.update({
      where: { id: userId },
      data: { subscriptionStatus: 'LAPSED' },
    })
    return { lapsed: true }
  }

  return { lapsed: false }
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
