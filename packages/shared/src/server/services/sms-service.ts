import { prisma } from '../db'
import { smsSend } from '../adapters/bdapps'
import { createAuditLog } from './audit-service'
import { env } from '../../utils/env'

// ── Chart-data helpers ─────────────────────────────────────────────────────────

export interface ChartDateOpts {
  days?: number
  dateFrom?: Date
  dateTo?: Date
}

/**
 * Returns daily broadcast counts (sent or scheduled) over the requested range.
 * Defaults to the last 30 days. Every calendar date in the range is included;
 * days with no broadcasts get count: 0 (gap-fill).
 *
 * A broadcast is counted on the day it was sent (`sentAt`) when available,
 * otherwise on `createdAt`.
 */
export async function getSmsSendHistory(
  opts: ChartDateOpts = {},
): Promise<{ date: string; count: number }[]> {
  const { days = 30, dateFrom, dateTo } = opts

  const to = dateTo ?? new Date()
  const from = dateFrom ?? new Date(new Date(to).setDate(to.getDate() - days + 1))

  // Normalise to start-of-day UTC for consistent bucketing
  from.setUTCHours(0, 0, 0, 0)
  to.setUTCHours(23, 59, 59, 999)

  const broadcasts = await prisma.smsBroadcast.findMany({
    where: {
      OR: [
        { sentAt: { gte: from, lte: to } },
        { sentAt: null, createdAt: { gte: from, lte: to } },
      ],
    },
    select: { sentAt: true, createdAt: true },
  })

  // Build a map keyed by ISO date string (YYYY-MM-DD)
  const counts = new Map<string, number>()
  for (const b of broadcasts) {
    const ts = b.sentAt ?? b.createdAt
    const key = ts.toISOString().slice(0, 10)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  // Gap-fill every day in the range
  const result: { date: string; count: number }[] = []
  const cursor = new Date(from)
  while (cursor <= to) {
    const key = cursor.toISOString().slice(0, 10)
    result.push({ date: key, count: counts.get(key) ?? 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return result
}

/**
 * Returns a count breakdown of broadcasts by their current status.
 * Status values correspond to the `SmsBroadcastStatus` enum:
 * DRAFT | SCHEDULED | SENDING | SENT | FAILED.
 */
export async function getSmsDeliveryBreakdown(): Promise<
  { status: string; count: number }[]
> {
  const groups = await prisma.smsBroadcast.groupBy({
    by: ['status'],
    _count: { status: true },
    orderBy: { status: 'asc' },
  })

  return groups.map((g) => ({ status: g.status, count: g._count.status }))
}

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
