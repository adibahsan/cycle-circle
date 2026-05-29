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
