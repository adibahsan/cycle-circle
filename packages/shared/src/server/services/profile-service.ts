import type { FlowIntensity } from '@prisma/client'
import { prisma } from '../db'
import { ensurePeriodLogFromProfile } from '../period-log-sync'
import { normalizeGoal } from '../../utils/goal'

export function defaultNotificationPrefsForGoal(goal?: string | null): {
  periodAlert: boolean
  fertileWindow: boolean
  loggingReminder: boolean
} {
  const g = normalizeGoal(goal)
  if (g === 'conceive')      return { periodAlert: false, fertileWindow: true,  loggingReminder: false }
  if (g === 'pregnancy')     return { periodAlert: false, fertileWindow: false, loggingReminder: false }
  if (g === 'perimenopause') return { periodAlert: true,  fertileWindow: false, loggingReminder: true  }
  return { periodAlert: true, fertileWindow: true, loggingReminder: true }
}

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
    flowIntensity?: FlowIntensity
    goal?: string
  },
) {
  const profile = await prisma.$transaction(async (tx) => {
    const count = await tx.profile.count({ where: { userId } })
    if (count >= 6) throw new Error('Maximum of 6 profiles allowed')

    const created = await tx.profile.create({
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

    await tx.notificationPreference.create({
      data: {
        profileId: created.id,
        ...defaultNotificationPrefsForGoal(data.goal),
      },
    })

    return created
  })

  if (data.lastPeriodStart) {
    await ensurePeriodLogFromProfile(profile, data.flowIntensity)
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

export async function updateProfile(
  profileId: string,
  userId: string,
  data: {
    name?: string
    relation?: 'SELF' | 'WIFE' | 'SISTER' | 'MOTHER' | 'DAUGHTER' | 'GIRLFRIEND'
    cycleLength?: number
    periodLength?: number
    goal?: string | null
  },
) {
  const currentProfile = await assertProfileOwnership(profileId, userId)

  const updated = await prisma.profile.update({
    where: { id: profileId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.relation !== undefined && { relation: data.relation }),
      ...(data.cycleLength !== undefined && { cycleLength: data.cycleLength }),
      ...(data.periodLength !== undefined && { periodLength: data.periodLength }),
      ...(data.goal !== undefined && { goal: data.goal }),
    },
  })

  // When goal is explicitly provided and differs from the current goal,
  // auto-apply the notification defaults for the new goal.
  if (data.goal !== undefined && data.goal !== currentProfile.goal) {
    const defaults = defaultNotificationPrefsForGoal(data.goal)
    await prisma.notificationPreference.upsert({
      where: { profileId },
      create: { profileId, ...defaults },
      update: { ...defaults },
    })
  }

  return updated
}

export async function removeProfile(profileId: string, userId: string) {
  await assertProfileOwnership(profileId, userId)
  const totalProfiles = await prisma.profile.count({ where: { userId } })
  if (totalProfiles <= 1) throw new Error('Cannot delete your last profile')
  return prisma.profile.delete({ where: { id: profileId } })
}
