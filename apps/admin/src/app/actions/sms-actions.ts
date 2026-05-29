'use server'

import { requireAdminAuth, getAuthUser } from '@vesta/shared/server/auth'
import { createBroadcast, deleteBroadcast } from '@vesta/shared/server/services'
import { revalidatePath } from 'next/cache'

export async function createSmsBroadcast(message: string, scheduledFor?: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  const broadcast = await createBroadcast(admin.id, message, scheduledFor)

  revalidatePath('/sms')
  return broadcast
}

export async function deleteSmsBroadcast(id: string) {
  await requireAdminAuth()

  await deleteBroadcast(id)

  revalidatePath('/sms')
  return { success: true }
}
