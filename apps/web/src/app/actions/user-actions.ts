'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireAuth, getAuthUser } from '@vesta/shared/server/auth'
import { completeUserProfile } from '@vesta/shared/server/services'

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

  revalidatePath('/')
  return updated
}
