import { prisma } from '../db'
import { createAuditLog } from './audit-service'

export async function listNotificationPrefs(profileIds: string[]) {
  return prisma.notificationPreference.findMany({
    where: { profileId: { in: profileIds } },
  })
}

export async function upsertNotificationPrefs(
  profileId: string,
  userId: string,
  data: {
    periodAlert?: boolean
    fertileWindow?: boolean
    loggingReminder?: boolean
  },
) {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile || profile.userId !== userId) throw new Error('Profile not found')

  return prisma.notificationPreference.upsert({
    where: { profileId },
    create: {
      profileId,
      periodAlert: data.periodAlert ?? true,
      fertileWindow: data.fertileWindow ?? true,
      loggingReminder: data.loggingReminder ?? true,
    },
    update: {
      ...(data.periodAlert !== undefined && { periodAlert: data.periodAlert }),
      ...(data.fertileWindow !== undefined && { fertileWindow: data.fertileWindow }),
      ...(data.loggingReminder !== undefined && { loggingReminder: data.loggingReminder }),
    },
  })
}

/**
 * Admin-only setter for notification preferences. Skips ownership check and
 * writes an audit log entry with the applied changes.
 */
export async function adminSetNotificationPrefs(
  profileId: string,
  data: { periodAlert?: boolean; fertileWindow?: boolean; loggingReminder?: boolean },
  adminId: string,
) {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile) throw new Error('Profile not found')

  const updated = await prisma.notificationPreference.upsert({
    where: { profileId },
    create: {
      profileId,
      periodAlert: data.periodAlert ?? true,
      fertileWindow: data.fertileWindow ?? true,
      loggingReminder: data.loggingReminder ?? true,
    },
    update: {
      ...(data.periodAlert !== undefined && { periodAlert: data.periodAlert }),
      ...(data.fertileWindow !== undefined && { fertileWindow: data.fertileWindow }),
      ...(data.loggingReminder !== undefined && { loggingReminder: data.loggingReminder }),
    },
  })

  await createAuditLog(adminId, 'NOTIFICATION_PREFS_UPDATED', 'Profile', profileId, {
    userId: profile.userId,
    ...data,
  })
  return updated
}
