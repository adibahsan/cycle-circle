'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@vesta/shared'
import { requireAuth, getAuthUser } from '@vesta/shared/server/auth'
import { ensurePeriodLogFromProfile } from '@vesta/shared/server/period-log-sync'

const createProfileSchema = z.object({
  name: z.string().min(1).max(100),
  relation: z.enum(['SELF', 'WIFE', 'SISTER', 'MOTHER', 'DAUGHTER', 'GIRLFRIEND']),
  cycleLength: z.number().int().min(21).max(45).optional(),
  periodLength: z.number().int().min(1).max(14).optional(),
  lastPeriodStart: z.string().optional(),
  goal: z.string().max(500).optional(),
})

export async function createProfile(input: z.infer<typeof createProfileSchema>) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  const data = createProfileSchema.parse(input)

  const count = await prisma.profile.count({ where: { userId: user.id } })
  if (count >= 6) throw new Error('Maximum of 6 profiles allowed')

  const profile = await prisma.profile.create({
    data: {
      userId: user.id,
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

  revalidatePath('/')
  return profile
}

export async function renameProfile(profileId: string, name: string) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)

  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile || profile.userId !== user.id) throw new Error('Profile not found')

  const updated = await prisma.profile.update({
    where: { id: profileId },
    data: { name: z.string().min(1).max(100).parse(name) },
  })

  revalidatePath('/')
  return updated
}

export async function deleteProfile(profileId: string) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)

  const profile = await prisma.profile.findUnique({ where: { id: profileId } })
  if (!profile || profile.userId !== user.id) throw new Error('Profile not found')

  const totalProfiles = await prisma.profile.count({ where: { userId: user.id } })
  if (totalProfiles <= 1) throw new Error('Cannot delete your last profile')

  await prisma.profile.delete({ where: { id: profileId } })
  revalidatePath('/')
}
