'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireAuth, getAuthUser } from '@vesta/shared/server/auth'
import { upsertNotificationPrefs } from '@vesta/shared/server/services'

const updatePrefsSchema = z.object({
  profileId: z.string().min(1),
  periodAlert: z.boolean().optional(),
  fertileWindow: z.boolean().optional(),
  loggingReminder: z.boolean().optional(),
})

export async function updateNotificationPrefs(input: z.infer<typeof updatePrefsSchema>) {
  const jwt = await requireAuth()
  const user = await getAuthUser(jwt.sub)
  const data = updatePrefsSchema.parse(input)

  const updated = await upsertNotificationPrefs(data.profileId, user.id, {
    periodAlert: data.periodAlert,
    fertileWindow: data.fertileWindow,
    loggingReminder: data.loggingReminder,
  })

  revalidatePath('/')
  return updated
}
