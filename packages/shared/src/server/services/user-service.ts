import { prisma } from '../db'

export interface CompleteUserProfileData {
  fullName: string
  phone?: string
}

/**
 * Mark a user's profile as completed and update their name/phone.
 */
export async function completeUserProfile(userId: string, data: CompleteUserProfileData) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      fullName: data.fullName,
      phone: data.phone,
      profileCompleted: true,
    },
  })

  return { id: updated.id, fullName: updated.fullName, profileCompleted: updated.profileCompleted }
}

/**
 * Suspend a user by setting suspendedAt + suspendedBy.
 */
export async function suspendUser(userId: string, adminId: string, reason?: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { suspendedAt: new Date(), suspendedBy: adminId },
  })

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: 'USER_SUSPENDED',
      targetType: 'User',
      targetId: userId,
      metadata: reason ? { reason } : undefined,
    },
  })

  return { success: true }
}

/**
 * Clear suspension fields to reactivate a previously suspended user.
 */
export async function reactivateUser(userId: string, adminId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { suspendedAt: null, suspendedBy: null },
  })

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: 'USER_REACTIVATED',
      targetType: 'User',
      targetId: userId,
    },
  })

  return { success: true }
}

/**
 * Soft-delete a user by setting deletedAt.
 */
export async function softDeleteUser(userId: string, adminId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  })

  await prisma.adminAuditLog.create({
    data: {
      adminId,
      action: 'USER_DELETED',
      targetType: 'User',
      targetId: userId,
    },
  })

  return { success: true }
}

/**
 * Fetch a single user by ID. Returns null when not found.
 * Unlike getAuthUser in auth.ts, this does NOT throw on suspended/deleted users —
 * it is intended for admin reads that need to inspect those states.
 */
export async function getUserById(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } })
}
