'use server'

import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { requireAuth, getAuthUser, validateMsisdn } from '@vesta/shared/server/auth'
import { ApiError } from '@vesta/shared/server/api-error'
import { normalizeEmail } from '@vesta/shared/utils/email'
import { completeUserProfile, updateUserContact, updateUserName as svcUpdateUserName, completeOnboardingTour as svcCompleteOnboardingTour } from '@vesta/shared/server/services'
import { cacheTags } from '@/lib/cache-tags'

/**
 * Result of a contact-saving action. We RETURN a typed code rather than throw,
 * because Next.js replaces thrown server-action error messages with an opaque
 * digest in production (and custom Error fields like `.code` never cross the
 * server-action boundary) — so a thrown error can't reliably tell the client
 * "this number/email is already in use".
 */
export type ContactResult =
  | { ok: true }
  | { ok: false; code: 'PHONE_TAKEN' | 'EMAIL_TAKEN' | 'INVALID_PHONE' | 'ERROR' }

const completeProfileSchema = z.object({
  fullName: z.string().min(1).max(200),
  phone: z.string().min(1).max(20),
})

export async function completeProfile(
  input: z.infer<typeof completeProfileSchema>,
): Promise<ContactResult> {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)

  let phone: string
  try {
    const data = completeProfileSchema.parse(input)
    phone = validateMsisdn(data.phone)
    await completeUserProfile(user.id, { fullName: data.fullName, phone })
  } catch (e) {
    return contactErrorResult(e)
  }

  revalidateTag(cacheTags.user(user.id), { expire: 0 })
  revalidateTag(cacheTags.profiles(user.id), { expire: 0 })
  return { ok: true }
}

/** Map a caught error from a contact write to a ContactResult code. */
function contactErrorResult(e: unknown): { ok: false; code: 'PHONE_TAKEN' | 'EMAIL_TAKEN' | 'INVALID_PHONE' | 'ERROR' } {
  if (e instanceof ApiError) {
    if (e.code === 'PHONE_TAKEN' || e.code === 'EMAIL_TAKEN' || e.code === 'INVALID_PHONE') {
      return { ok: false, code: e.code }
    }
  }
  return { ok: false, code: 'ERROR' }
}

const updateContactSchema = z.object({
  // `.trim()` runs before `.email()` so surrounding whitespace doesn't fail
  // validation; `normalizeEmail` then lowercases for the uniqueness check.
  email: z.string().trim().email().optional(),
  phone: z.string().min(1).optional(),
})

export async function updateContactInfo(
  input: z.infer<typeof updateContactSchema>,
): Promise<ContactResult> {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)

  try {
    const data = updateContactSchema.parse(input)
    const updateData: { email?: string; phone?: string } = {}

    if (data.email) {
      updateData.email = normalizeEmail(data.email)
    }
    if (data.phone) {
      updateData.phone = validateMsisdn(data.phone)
    }
    if (Object.keys(updateData).length === 0) {
      return { ok: false, code: 'ERROR' }
    }

    await updateUserContact(user.id, updateData)
  } catch (e) {
    return contactErrorResult(e)
  }

  revalidateTag(cacheTags.user(user.id), { expire: 0 })
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
