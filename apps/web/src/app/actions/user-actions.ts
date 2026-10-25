'use server'

import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { requireAuth, getAuthUser } from '@vesta/shared/server/auth'
import { completeUserProfile, updateUserName as svcUpdateUserName, completeOnboardingTour as svcCompleteOnboardingTour } from '@vesta/shared/server/services'
import { cacheTags } from '@/lib/cache-tags'

/**
 * Result of a profile-saving action. We RETURN a typed code rather than throw,
 * because Next.js replaces thrown server-action error messages with an opaque
 * digest in production.
 *
 * Phone and email are NOT saved here: they change only through verification
 * (phone OTP: /api/user/phone/*, email code: /api/user/email/*).
 */
export type ContactResult =
  | { ok: true }
  | { ok: false; code: 'PHONE_TAKEN' | 'EMAIL_TAKEN' | 'INVALID_PHONE' | 'ERROR' }

const completeProfileSchema = z.object({
  fullName: z.string().min(1).max(200),
})

export async function completeProfile(
  input: z.infer<typeof completeProfileSchema>,
): Promise<ContactResult> {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)

  try {
    const data = completeProfileSchema.parse(input)
    await completeUserProfile(user.id, { fullName: data.fullName })
  } catch {
    return { ok: false, code: 'ERROR' }
  }

  revalidateTag(cacheTags.user(user.id), { expire: 0 })
  revalidateTag(cacheTags.profiles(user.id), { expire: 0 })
  return { ok: true }
}

const updateUserNameSchema = z.string().min(1).max(200)

export async function updateUserName(input: string) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  const name = updateUserNameSchema.parse(input)

  await svcUpdateUserName(user.id, name)

  revalidateTag(cacheTags.user(user.id), { expire: 0 })
  revalidateTag(cacheTags.profiles(user.id), { expire: 0 })
  return { success: true }
}

export async function completeOnboardingTour() {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  await svcCompleteOnboardingTour(user.id)
  revalidateTag(cacheTags.user(user.id), { expire: 0 })
  return { success: true }
}
