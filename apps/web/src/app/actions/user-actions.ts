'use server'

import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { requireAuth, getAuthUser, validateMsisdn } from '@vesta/shared/server/auth'
import { completeUserProfile, updateUserContact, updateUserName as svcUpdateUserName, completeOnboardingTour as svcCompleteOnboardingTour } from '@vesta/shared/server/services'

const completeProfileSchema = z.object({
  fullName: z.string().min(1).max(200),
  phone: z.string().min(1).max(20),
})

export async function completeProfile(input: z.infer<typeof completeProfileSchema>) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  const data = completeProfileSchema.parse(input)

  const updated = await completeUserProfile(user.id, {
    fullName: data.fullName,
    phone: data.phone,
  })

  revalidateTag(`user:${user.id}`, { expire: 0 })
  revalidateTag(`profiles:${user.id}`, { expire: 0 })
  return updated
}

const updateContactSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
})

export async function updateContactInfo(input: z.infer<typeof updateContactSchema>) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  const data = updateContactSchema.parse(input)

  const updateData: { email?: string; phone?: string } = {}

  if (data.email) {
    updateData.email = data.email
  }

  if (data.phone) {
    updateData.phone = validateMsisdn(data.phone)
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('No contact info provided')
  }

  await updateUserContact(user.id, updateData)

  revalidateTag(`user:${user.id}`, { expire: 0 })
  return { success: true }
}

const updateUserNameSchema = z.string().min(1).max(200)

export async function updateUserName(input: string) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  const name = updateUserNameSchema.parse(input)

  await svcUpdateUserName(user.id, name)

  revalidateTag(`user:${user.id}`, { expire: 0 })
  revalidateTag(`profiles:${user.id}`, { expire: 0 })
  return { success: true }
}

export async function completeOnboardingTour() {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  await svcCompleteOnboardingTour(user.id)
  revalidateTag(`user:${user.id}`, { expire: 0 })
  return { success: true }
}
