'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireAuth, getAuthUser } from '@vesta/shared/server/auth'
import { createFeedback } from '@vesta/shared/server/services'

const feedbackSchema = z.object({
  profileId: z.string().min(1).optional(),
  category: z.enum(['BUG', 'FEATURE', 'GENERAL', 'SATISFACTION']),
  message: z.string().min(1).max(2000),
  rating: z.number().int().min(1).max(5).optional(),
})

export async function submitFeedback(input: z.infer<typeof feedbackSchema>) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  const data = feedbackSchema.parse(input)

  const feedback = await createFeedback(user.id, {
    profileId: data.profileId,
    category: data.category,
    message: data.message,
    rating: data.rating,
  })

  revalidatePath('/')
  return feedback
}
