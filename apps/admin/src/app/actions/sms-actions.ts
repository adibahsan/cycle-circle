'use server'

import { requireAdminAuth, getAuthUser } from '@vesta/shared/server/auth'
import { createBroadcast, deleteBroadcast, sendBroadcast } from '@vesta/shared/server/services'
import { revalidateTag } from 'next/cache'
import { adminCacheTags } from '@/lib/admin-cache-tags'

export async function createSmsBroadcast(message: string, scheduledFor?: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  const broadcast = await createBroadcast(admin.id, message, scheduledFor)

  revalidateTag(adminCacheTags.sms, { expire: 0 })
  return broadcast
}

export async function deleteSmsBroadcast(id: string) {
  await requireAdminAuth()

  await deleteBroadcast(id)

  revalidateTag(adminCacheTags.sms, { expire: 0 })
  return { success: true }
}

export async function sendSmsBroadcast(id: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  await sendBroadcast(id, admin.id)

  revalidateTag(adminCacheTags.sms, { expire: 0 })
  return { success: true }
}
