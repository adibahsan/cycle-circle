import { prisma } from '../db'
import { ensurePeriodLogFromProfile } from '../period-log-sync'

export async function assertProfileOwnership(profileId: string, userId: string) {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile || profile.userId !== userId) throw new Error('Profile not found')
  return profile
}

export async function listProfiles(userId: string) {
  return prisma.profile.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })
}

export async function getProfileById(profileId: string, userId: string) {
  const profile = await assertProfileOwnership(profileId, userId)
  const prediction = await prisma.prediction.findUnique({ where: { profileId } })
  return { profile, prediction }
}

export async function createProfile(
  userId: string,
  data: {
    name: string
    relation: 'SELF' | 'WIFE' | 'SISTER' | 'MOTHER' | 'DAUGHTER' | 'GIRLFRIEND'
    cycleLength?: number
    periodLength?: number
    lastPeriodStart?: string
    goal?: string
  },
) {
  const count = await prisma.profile.count({ where: { userId } })
  if (count >= 6) throw new Error('Maximum of 6 profiles allowed')

  const profile = await prisma.profile.create({
    data: {
      userId,
      name: data.name,
      relation: data.relation,
      cycleLength: data.cycleLength ?? 28,
      periodLength: data.periodLength ?? 5,
      lastPeriodStart: data.lastPeriodStart ? new Date(data.lastPeriodStart) : undefined,
      goal: data.goal,
    },
  })

  await prisma.notificationPreference.create({
    data: {
      profileId: profile.id,
      periodAlert: true,
      fertileWindow: true,
      loggingReminder: true,
    },
  })

  if (data.lastPeriodStart) {
    await ensurePeriodLogFromProfile(profile)
  }

  return profile
}

export async function renameProfile(profileId: string, userId: string, name: string) {
  await assertProfileOwnership(profileId, userId)
  return prisma.profile.update({
    where: { id: profileId },
    data: { name },
  })
}

export async function removeProfile(profileId: string, userId: string) {
  await assertProfileOwnership(profileId, userId)
  const totalProfiles = await prisma.profile.count({ where: { userId } })
  if (totalProfiles <= 1) throw new Error('Cannot delete your last profile')
  return prisma.profile.delete({ where: { id: profileId } })
}
