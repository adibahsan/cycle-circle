'use server'

import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { cookies } from 'next/headers'
import { requireAuth, getAuthUser } from '@vesta/shared/server/auth'
import { normalizeGoal } from '@vesta/shared/utils/goal'
import {
  assertProfileOwnership,
  createProfile as svcCreateProfile,
  renameProfile as svcRenameProfile,
  updateProfile as svcUpdateProfile,
  removeProfile as svcRemoveProfile,
  updateUserName as svcUpdateUserName,
  completeUserProfile as svcCompleteUserProfile,
} from '@vesta/shared/server/services'
import { cacheTags } from '@/lib/cache-tags'

const createProfileSchema = z.object({
  name: z.string().min(1).max(100),
  relation: z.enum(['SELF', 'WIFE', 'SISTER', 'MOTHER', 'DAUGHTER', 'GIRLFRIEND']),
  cycleLength: z.number().int().min(21).max(45).optional(),
  periodLength: z.number().int().min(1).max(14).optional(),
  lastPeriodStart: z.string().optional(),
  flowIntensity: z.enum(['LIGHT', 'MEDIUM', 'HEAVY']).optional(),
  goal: z.string().max(500).optional(),
  userName: z.string().max(200).optional(),
})

export async function createProfile(input: z.infer<typeof createProfileSchema>) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  const data = createProfileSchema.parse(input)

  const profile = await svcCreateProfile(user.id, {
    ...data,
    goal: data.goal ? (normalizeGoal(data.goal) ?? data.goal) : undefined,
  })

  if (data.userName) {
    await svcUpdateUserName(user.id, data.userName)
  }

  await svcCompleteUserProfile(user.id, { fullName: data.userName ?? user.fullName ?? data.name })

  revalidateTag(cacheTags.profiles(user.id), { expire: 0 })
  revalidateTag(cacheTags.user(user.id), { expire: 0 })
  return profile
}

export async function renameProfile(profileId: string, name: string) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)

  const updated = await svcRenameProfile(profileId, user.id, z.string().min(1).max(100).parse(name))

  revalidateTag(cacheTags.profiles(user.id), { expire: 0 })
  return updated
}

const updateProfileSchema = z.object({
  profileId: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  relation: z.enum(['SELF', 'WIFE', 'SISTER', 'MOTHER', 'DAUGHTER', 'GIRLFRIEND']).optional(),
  cycleLength: z.number().int().min(21).max(45).optional(),
  periodLength: z.number().int().min(1).max(14).optional(),
  goal: z.enum(['tracking', 'conceive', 'pregnancy', 'perimenopause']).optional(),
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
    goal: data.goal,
  })

  revalidateTag(cacheTags.profiles(user.id), { expire: 0 })
  // Goal/cycle changes affect dashboard + calendar (mode, predictions),
  // which are cached under the tracking tag.
  revalidateTag(cacheTags.tracking(data.profileId), { expire: 0 })
  return updated
}

export async function deleteProfile(profileId: string) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)

  await svcRemoveProfile(profileId, user.id)
  const cookieStore = await cookies()
  if (cookieStore.get('vesta_active_profile')?.value === profileId) {
    cookieStore.delete('vesta_active_profile')
  }
  revalidateTag(cacheTags.profiles(user.id), { expire: 0 })
  revalidateTag(cacheTags.tracking(profileId), { expire: 0 })
}

export async function setActiveProfileCookie(profileId: string) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  await assertProfileOwnership(profileId, user.id)
  const cookieStore = await cookies()
  cookieStore.set('vesta_active_profile', profileId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
}
