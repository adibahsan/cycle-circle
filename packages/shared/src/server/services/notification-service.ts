import { prisma } from '../db'

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
