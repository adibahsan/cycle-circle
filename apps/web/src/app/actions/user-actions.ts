'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@vesta/shared'
import { requireAuth, getAuthUser } from '@vesta/shared/server/auth'

const completeProfileSchema = z.object({
  fullName: z.string().min(1).max(200),
  phone: z.string().min(1).max(20),
})

export async function completeProfile(input: z.infer<typeof completeProfileSchema>) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  const data = completeProfileSchema.parse(input)

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      fullName: data.fullName,
      phone: data.phone,
      profileCompleted: true,
    },
  })

  revalidatePath('/')
  return { id: updated.id, fullName: updated.fullName, profileCompleted: updated.profileCompleted }
}
