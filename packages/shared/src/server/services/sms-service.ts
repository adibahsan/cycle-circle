import { prisma } from '../db'
import { logger } from '../log'
import { smsSend } from '../adapters/bdapps'
import { createAuditLog } from './audit-service'
import { env } from '../../utils/env'
import { composeSms, scheduleDrafts, type SmsDraft, type SmsSendLanguage } from '../../utils/sms'

// ── Pure helpers ───────────────────────────────────────────────────────────────

export * from '../../utils/sms'

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
 * otherwise DRAFT. Accepts an optional Bengali translation.
 */
export async function createBroadcast(
  createdBy: string,
  message: string,
  messageBn?: string,
  scheduledFor?: string,
  sendLanguage: SmsSendLanguage = 'BOTH',
) {
  composeSms(message, messageBn, sendLanguage) // validates the language/text combination
  return prisma.smsBroadcast.create({
    data: {
      message,
      messageBn: messageBn || null,
      sendLanguage,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      status: scheduledFor ? 'SCHEDULED' : 'DRAFT',
      createdBy,
    },
  })
}

/**
 * Create multiple SCHEDULED broadcasts from parsed drafts (line parser or CSV).
 * Dated drafts go out on their own date, undated ones one per day from startDate
 * (or tomorrow), at 08:00 UTC. All drafts are validated before any row is written.
 */
export async function createBroadcastsBulk(
  createdBy: string,
  rows: SmsDraft[],
  startDate?: string,
  sendLanguage: SmsSendLanguage = 'BOTH',
) {
  for (const r of rows) composeSms(r.messageEn, r.messageBn, sendLanguage)
  const dates = scheduleDrafts(rows, startDate)
  return prisma.$transaction(
    rows.map((r, i) =>
      prisma.smsBroadcast.create({
        data: {
          message: r.messageEn,
          messageBn: r.messageBn ?? null,
          sendLanguage,
          scheduledFor: dates[i],
          status: 'SCHEDULED',
          createdBy,
        },
      }),
    ),
  )
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

// ── Private send logic ─────────────────────────────────────────────────────────

/**
 * Execute the actual SMS send (or simulate in dev mode), then mark the broadcast
 * SENT and deactivate all previously active broadcasts (content-override).
 *
 * Called by both manual sendBroadcast and the cron dispatchScheduledBroadcast.
 */
async function performSend(broadcast: {
  id: string
  message: string
  messageBn: string | null
  sendLanguage: SmsSendLanguage
}) {
  const isDevMode = env.DEV_MODE || env.NODE_ENV === 'development'
  const combined = composeSms(broadcast.message, broadcast.messageBn, broadcast.sendLanguage)
  let providerMessageId: string | null = null
  let deliveredCount = 0
  let targetCount = 0

  if (isDevMode) {
    console.log(`[SMS Broadcast DEV] id=${broadcast.id} message="${combined}"`)
    providerMessageId = `dev-${broadcast.id}`
    deliveredCount = 1
    targetCount = 1
  } else {
    const res = await smsSend(combined, ['tel:all'])
    providerMessageId = res.messageId ?? null
    // Real per-recipient counts arrive asynchronously via /api/webhooks/sms/report.
  }

  // Content-override: only the newest sent daily content stays active.
  await prisma.smsBroadcast.updateMany({
    where: { active: true, id: { not: broadcast.id } },
    data: { active: false },
  })

  return prisma.smsBroadcast.update({
    where: { id: broadcast.id },
    data: {
      status: 'SENT',
      sentAt: new Date(),
      active: true,
      providerMessageId,
      targetCount,
      deliveredCount,
      failedCount: 0,
    },
  })
}

// ── Public send functions ──────────────────────────────────────────────────────

/**
 * Send an SMS broadcast immediately (manual trigger by an admin).
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

  try {
    const updated = await performSend(broadcast)

    await createAuditLog(adminUserId, 'SEND_SMS_BROADCAST', 'SmsBroadcast', broadcastId, {
      message: broadcast.message.slice(0, 100),
      devMode: env.DEV_MODE || env.NODE_ENV === 'development',
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

/**
 * Dispatch the next due scheduled broadcast (one per run = one per day).
 * Returns what happened.
 */
export async function dispatchScheduledBroadcast(now: Date = new Date()) {
  const due = await prisma.smsBroadcast.findFirst({
    where: { status: 'SCHEDULED', scheduledFor: { lte: now } },
    orderBy: { scheduledFor: 'asc' },
  })
  if (!due) return { dispatched: false as const }
  await prisma.smsBroadcast.update({ where: { id: due.id }, data: { status: 'SENDING' } })
  try {
    const sent = await performSend(due)
    await createAuditLog(due.createdBy, 'DISPATCH_SMS_BROADCAST', 'SmsBroadcast', due.id, {
      auto: true,
    })
    return { dispatched: true as const, broadcastId: sent.id }
  } catch (err) {
    await prisma.smsBroadcast.update({ where: { id: due.id }, data: { status: 'SCHEDULED' } })
    logger.cron('sms.broadcast.dispatch.failed', { broadcastId: due.id, error: String(err) }, { level: 'error' })
    return { dispatched: false as const, error: String(err) }
  }
}

// ── Delivery-report recording ──────────────────────────────────────────────────

/**
 * Correlate an inbound sms/report to its broadcast and update delivery counts.
 *
 * targetCount and deliveredCount/failedCount are Int? in the schema; we read
 * current values and write explicit numbers to avoid Prisma increment-on-null
 * errors.
 */
export async function recordSmsDeliveryReport(requestId: string, deliveryStatus: string) {
  if (!requestId) return { matched: false as const }

  let broadcast = await prisma.smsBroadcast.findFirst({
    where: { providerMessageId: requestId },
    orderBy: { sentAt: 'desc' },
  })
  if (!broadcast) {
    broadcast = await prisma.smsBroadcast.findFirst({
      where: { status: 'SENT', active: true },
      orderBy: { sentAt: 'desc' },
    })
  }
  if (!broadcast) return { matched: false as const }

  const status = (deliveryStatus || '').toUpperCase()
  if (status === 'DELIVERED') {
    await prisma.smsBroadcast.update({
      where: { id: broadcast.id },
      data: {
        deliveredCount: (broadcast.deliveredCount ?? 0) + 1,
        targetCount: (broadcast.targetCount ?? 0) + 1,
      },
    })
    return { matched: true as const, counted: true as const }
  }
  if (status === 'FAILED') {
    await prisma.smsBroadcast.update({
      where: { id: broadcast.id },
      data: {
        failedCount: (broadcast.failedCount ?? 0) + 1,
        targetCount: (broadcast.targetCount ?? 0) + 1,
      },
    })
    return { matched: true as const, counted: true as const }
  }
  return { matched: true as const, counted: false as const } // PENDING / unknown
}
