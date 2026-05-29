'use server'

import { prisma } from '@vesta/shared'
import { requireAdminAuth, getAuthUser } from '@vesta/shared/server/auth'
import { revalidatePath } from 'next/cache'

export async function suspendUser(userId: string, reason?: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  await prisma.user.update({
    where: { id: userId },
    data: { suspendedAt: new Date(), suspendedBy: admin.id },
  })

  await prisma.adminAuditLog.create({
    data: {
      adminId: admin.id,
      action: 'USER_SUSPENDED',
      targetType: 'User',
      targetId: userId,
      metadata: reason ? { reason } : undefined,
    },
  })

  revalidatePath('/users')
  revalidatePath(`/users/${userId}`)
  return { success: true }
}

export async function reactivateUser(userId: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  await prisma.user.update({
    where: { id: userId },
    data: { suspendedAt: null, suspendedBy: null },
  })

  await prisma.adminAuditLog.create({
    data: {
      adminId: admin.id,
      action: 'USER_REACTIVATED',
      targetType: 'User',
      targetId: userId,
    },
  })

  revalidatePath('/users')
  revalidatePath(`/users/${userId}`)
  return { success: true }
}

export async function softDeleteUser(userId: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  })

  await prisma.adminAuditLog.create({
    data: {
      adminId: admin.id,
      action: 'USER_DELETED',
      targetType: 'User',
      targetId: userId,
    },
  })

  revalidatePath('/users')
  return { success: true }
}

export async function grantProAccess(userId: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  const sub = await prisma.subscription.findFirst({ where: { userId } })
  if (sub) {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'PRO',
        adminOverride: true,
        adminOverrideBy: admin.id,
        adminOverrideAt: new Date(),
      },
    })
  } else {
    await prisma.subscription.create({
      data: {
        userId,
        status: 'PRO',
        adminOverride: true,
        adminOverrideBy: admin.id,
        adminOverrideAt: new Date(),
      },
    })
  }

  await prisma.user.update({ where: { id: userId }, data: { subscriptionStatus: 'PRO' } })

  await prisma.adminAuditLog.create({
    data: {
      adminId: admin.id,
      action: 'PRO_GRANTED',
      targetType: 'Subscription',
      targetId: userId,
    },
  })

  revalidatePath('/users')
  revalidatePath(`/users/${userId}`)
  revalidatePath('/subscriptions')
  return { success: true }
}

export async function revokeProAccess(userId: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  await prisma.subscription.updateMany({
    where: { userId, status: 'PRO' },
    data: {
      status: 'LAPSED',
      adminOverride: true,
      adminOverrideBy: admin.id,
      adminOverrideAt: new Date(),
    },
  })

  await prisma.user.update({ where: { id: userId }, data: { subscriptionStatus: 'LAPSED' } })

  await prisma.adminAuditLog.create({
    data: {
      adminId: admin.id,
      action: 'PRO_REVOKED',
      targetType: 'Subscription',
      targetId: userId,
    },
  })

  revalidatePath('/users')
  revalidatePath(`/users/${userId}`)
  revalidatePath('/subscriptions')
  return { success: true }
}
