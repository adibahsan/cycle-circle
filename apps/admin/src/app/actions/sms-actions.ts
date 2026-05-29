'use server'

import { prisma } from '@vesta/shared'
import { requireAdminAuth, getAuthUser } from '@vesta/shared/server/auth'
import { revalidatePath } from 'next/cache'

export async function createSmsBroadcast(message: string, scheduledFor?: string) {
  const jwt = await requireAdminAuth()
  const admin = await getAuthUser(jwt.sub)

  const broadcast = await prisma.smsBroadcast.create({
    data: {
      message,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      status: scheduledFor ? 'SCHEDULED' : 'DRAFT',
      createdBy: admin.id,
    },
  })

  revalidatePath('/sms')
  return broadcast
}

export async function deleteSmsBroadcast(id: string) {
  await requireAdminAuth()

  const broadcast = await prisma.smsBroadcast.findUnique({ where: { id } })
  if (!broadcast || broadcast.status === 'SENT' || broadcast.status === 'SENDING') {
    throw new Error('Cannot delete a sent or in-progress broadcast')
  }

  await prisma.smsBroadcast.delete({ where: { id } })
  revalidatePath('/sms')
  return { success: true }
}
