'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireAuth, getAuthUser } from '@vesta/shared/server/auth'
import {
  createProfile as svcCreateProfile,
  renameProfile as svcRenameProfile,
  updateProfile as svcUpdateProfile,
  removeProfile as svcRemoveProfile,
  updateUserName as svcUpdateUserName,
} from '@vesta/shared/server/services'

const createProfileSchema = z.object({
  name: z.string().min(1).max(100),
  relation: z.enum(['SELF', 'WIFE', 'SISTER', 'MOTHER', 'DAUGHTER', 'GIRLFRIEND']),
  cycleLength: z.number().int().min(21).max(45).optional(),
  periodLength: z.number().int().min(1).max(14).optional(),
  lastPeriodStart: z.string().optional(),
  goal: z.string().max(500).optional(),
  userName: z.string().max(200).optional(),
})

export async function createProfile(input: z.infer<typeof createProfileSchema>) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  const data = createProfileSchema.parse(input)

  const profile = await svcCreateProfile(user.id, data)

  if (data.userName) {
    await svcUpdateUserName(user.id, data.userName)
  }

  revalidatePath('/')
  return profile
}

export async function renameProfile(profileId: string, name: string) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)

  const updated = await svcRenameProfile(profileId, user.id, z.string().min(1).max(100).parse(name))

  revalidatePath('/')
  return updated
}

const updateProfileSchema = z.object({
  profileId: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  relation: z.enum(['SELF', 'WIFE', 'SISTER', 'MOTHER', 'DAUGHTER', 'GIRLFRIEND']).optional(),
  cycleLength: z.number().int().min(21).max(45).optional(),
  periodLength: z.number().int().min(1).max(14).optional(),
})

export async function updateProfile(input: z.infer<typeof updateProfileSchema>) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  const data = updateProfileSchema.parse(input)

  const updated = await svcUpdateProfile(data.profileId, user.id, {
    name: data.name,
    relation: data.relation,
    cycleLength: data.cycleLength,
    periodLength: data.periodLength,
  })

  revalidatePath('/')
  return updated
}

export async function deleteProfile(profileId: string) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)

  await svcRemoveProfile(profileId, user.id)
  revalidatePath('/')
}
