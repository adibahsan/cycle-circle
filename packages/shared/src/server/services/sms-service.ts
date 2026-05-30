import { prisma } from '../db'
import { smsSend } from '../adapters/bdapps'
import { createAuditLog } from './audit-service'
import { env } from '../../utils/env'

/**
 * Create an SMS broadcast. Status is SCHEDULED when a future date is provided,
 * otherwise DRAFT.
 */
export async function createBroadcast(
  createdBy: string,
  message: string,
  scheduledFor?: string,
) {
  return prisma.smsBroadcast.create({
    data: {
      message,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      status: scheduledFor ? 'SCHEDULED' : 'DRAFT',
      createdBy,
    },
  })
}

/**
 * Delete an SMS broadcast. Throws if the broadcast is already sent or in progress.
 */
export async function deleteBroadcast(id: string) {
  const broadcast = await prisma.smsBroadcast.findUnique({ where: { id } })
  if (!broadcast || broadcast.status === 'SENT' || broadcast.status === 'SENDING') {
    throw new Error('Cannot delete a sent or in-progress broadcast')
  }

  await prisma.smsBroadcast.delete({ where: { id } })
  return { success: true }
}

export interface SmsBroadcastListParams {
  page?: number
  pageSize?: number
  status?: string
}

/**
 * Return a paginated list of SMS broadcasts with optional status filter.
 * Each broadcast includes creator name and email.
 */
export async function listBroadcasts(params: SmsBroadcastListParams = {}) {
  const { page = 1, pageSize = 20, status } = params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (status && status !== 'all') where.status = status

  const [broadcasts, total] = await Promise.all([
    prisma.smsBroadcast.findMany({
      where,
      include: { creator: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.smsBroadcast.count({ where }),
  ])

  return {
    broadcasts,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

/**
 * Send an SMS broadcast immediately.
 *
 * In dev mode (DEV_MODE=true or NODE_ENV=development) the message is logged
 * to the console and the broadcast is marked SENT with synthetic counts.
 * In production the BDApps smsSend API is called with `destinationAddresses:
 * ["tel:all"]` to reach all subscribers.
 */
export async function sendBroadcast(broadcastId: string, adminUserId: string) {
  const broadcast = await prisma.smsBroadcast.findUnique({ where: { id: broadcastId } })

  if (!broadcast) {
    throw new Error('Broadcast not found')
  }
  if (broadcast.status !== 'DRAFT' && broadcast.status !== 'SCHEDULED') {
    throw new Error(`Cannot send a broadcast with status ${broadcast.status}`)
  }

  // Mark as sending
  await prisma.smsBroadcast.update({
    where: { id: broadcastId },
    data: { status: 'SENDING' },
  })

  const isDevMode = env.DEV_MODE || env.NODE_ENV === 'development'

  try {
    let targetCount = 0
    let deliveredCount = 0
    let failedCount = 0

    if (isDevMode) {
      // In development, simulate a successful send
      console.log(`[SMS Broadcast DEV] id=${broadcastId} message="${broadcast.message}"`)
      targetCount = 1
      deliveredCount = 1
      failedCount = 0
    } else {
      // In production, send via BDApps to all subscribers
      await smsSend(broadcast.message, ['tel:all'])
      // BDApps does not return per-recipient counts synchronously; we record
      // what we know and can reconcile via delivery reports later.
      targetCount = 0
      deliveredCount = 0
      failedCount = 0
    }

    const updated = await prisma.smsBroadcast.update({
      where: { id: broadcastId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        targetCount,
        deliveredCount,
        failedCount,
      },
    })

    await createAuditLog(adminUserId, 'SEND_SMS_BROADCAST', 'SmsBroadcast', broadcastId, {
      message: broadcast.message.slice(0, 100),
      devMode: isDevMode,
    })

    return updated
  } catch (error) {
    // Roll back to the previous status so the admin can retry
    await prisma.smsBroadcast.update({
      where: { id: broadcastId },
      data: { status: broadcast.status },
    })
    throw error
  }
}
