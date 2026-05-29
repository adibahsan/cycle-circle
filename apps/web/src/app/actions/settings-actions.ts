'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@vesta/shared'
import { requireAuth, getAuthUser } from '@vesta/shared/server/auth'

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

  const profile = await prisma.profile.findUnique({ where: { id: data.profileId } })
  if (!profile || profile.userId !== user.id) throw new Error('Profile not found')

  const updated = await prisma.notificationPreference.upsert({
    where: { profileId: data.profileId },
    create: {
      profileId: data.profileId,
      periodAlert: data.periodAlert ?? true,
      fertileWindow: data.fertileWindow ?? true,
      loggingReminder: data.loggingReminder ?? true,
    },
    update: {
      ...(data.periodAlert !== undefined && { periodAlert: data.periodAlert }),
      ...(data.fertileWindow !== undefined && { fertileWindow: data.fertileWindow }),
      ...(data.loggingReminder !== undefined && { loggingReminder: data.loggingReminder }),
    },
  })

  revalidatePath('/')
  return updated
}
