import { AUDIT_ACTIONS } from './audit-actions'
import { prisma } from '../db'
import { logger } from '../log'
import { smsSend } from '../adapters/bdapps'
import { createAuditLog } from './audit-service'
import { bangladeshDayOf } from '../../utils/dhaka-date'
import { fillDaySeries, resolveDaySeriesRange, type DaySeriesOpts } from '../../utils/day-series'
import { env } from '../../utils/env'
import {
  composeSms,
  scheduleDrafts,
  canEditBroadcast,
  canDeleteBroadcast,
  canSendBroadcast,
  type SmsDraft,
  type SmsSendLanguage,
} from '../../utils/sms'

// ── Pure helpers ───────────────────────────────────────────────────────────────

export * from '../../utils/sms'

// ── Chart-data helpers ─────────────────────────────────────────────────────────

export type ChartDateOpts = DaySeriesOpts

/**
 * Returns daily broadcast counts (sent or scheduled) over the requested range.
 * Defaults to the last 30 days. Every calendar date in the range is included;
 * days with no broadcasts get count: 0 (gap-fill).
 *
 * A broadcast is counted on the day it was sent (`sentAt`) when available,
 * otherwise on `createdAt`.
 */
export async function getSmsSendHistory(
  opts: ChartDateOpts,
): Promise<{ date: string; count: number }[]> {
  const { from, to, fromDay, toDay } = resolveDaySeriesRange(opts)

  const broadcasts = await prisma.smsBroadcast.findMany({
    where: {
      OR: [
        { sentAt: { gte: from, lte: to } },
        { sentAt: null, createdAt: { gte: from, lte: to } },
      ],
    },
    select: { sentAt: true, createdAt: true },
  })

  // Build a map keyed by Bangladesh day (YYYY-MM-DD)
  const counts = new Map<string, number>()
  for (const b of broadcasts) {
    const ts = b.sentAt ?? b.createdAt
    const key = bangladeshDayOf(ts)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return fillDaySeries(fromDay, toDay, counts)
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
  if (!broadcast || !canDeleteBroadcast(broadcast.status)) {
    throw new Error('Cannot delete a sent or in-progress broadcast')
  }

  await prisma.smsBroadcast.delete({ where: { id } })
  return { success: true }
}

/**
 * A SENDING broadcast older than this is presumed orphaned (the process died mid-send). The
 * send itself is capped at ~20 s, so this is generous.
 */
export const SMS_STUCK_SENDING_MS = 30 * 60 * 1000

async function loadEditable(id: string) {
  const b = await prisma.smsBroadcast.findUnique({ where: { id } })
  if (!b) throw new Error('Broadcast not found')
  if (!canEditBroadcast(b.status)) {
    throw new Error(
      b.status === 'SENT' ? 'A sent broadcast cannot be changed' : 'A broadcast that is sending cannot be changed',
    )
  }
  return b
}

function parseScheduleDate(value: string): Date {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw new Error('Invalid schedule date')
  return d
}

export interface UpdateBroadcastInput {
  message?: string
  messageBn?: string | null
  sendLanguage?: SmsSendLanguage
}

/**
 * Edit the text / send language of an unsent broadcast. A FAILED broadcast goes back
 * into the queue (SCHEDULED when it has a date, else DRAFT) with its error cleared.
 */
export async function updateBroadcast(id: string, adminUserId: string, input: UpdateBroadcastInput) {
  const b = await loadEditable(id)
  const message = input.message ?? b.message
  const messageBn = input.messageBn === undefined ? b.messageBn : input.messageBn || null
  const sendLanguage = input.sendLanguage ?? (b.sendLanguage as SmsSendLanguage)
  if (!message.trim()) throw new Error('Message cannot be empty')
  composeSms(message, messageBn, sendLanguage) // validates the language/text combination

  const updated = await prisma.smsBroadcast.update({
    where: { id },
    data: {
      message,
      messageBn,
      sendLanguage,
      ...(b.status === 'FAILED'
        ? { status: b.scheduledFor ? 'SCHEDULED' : 'DRAFT', lastError: null, sendAttempts: 0 }
        : {}),
    },
  })
  await createAuditLog(adminUserId, AUDIT_ACTIONS.UPDATE_SMS_BROADCAST, 'SmsBroadcast', id, { sendLanguage })
  return updated
}

/** Put an unsent broadcast in the queue for `scheduledFor` (resets attempts and any FAILED state). */
export async function rescheduleBroadcast(id: string, adminUserId: string, scheduledFor: string) {
  const when = parseScheduleDate(scheduledFor)
  const b = await loadEditable(id)
  const updated = await prisma.smsBroadcast.update({
    where: { id },
    data: { scheduledFor: when, status: 'SCHEDULED', lastError: null, sendAttempts: 0 },
  })
  await createAuditLog(adminUserId, AUDIT_ACTIONS.RESCHEDULE_SMS_BROADCAST, 'SmsBroadcast', id, {
    from: b.scheduledFor?.toISOString() ?? null,
    to: when.toISOString(),
  })
  return updated
}

/** The scheduled broadcast that will go out next, if any. */
export async function getNextScheduledBroadcastId(): Promise<string | null> {
  const next = await prisma.smsBroadcast.findFirst({
    where: { status: 'SCHEDULED', scheduledFor: { not: null } },
    orderBy: { scheduledFor: 'asc' },
    select: { id: true },
  })
  return next?.id ?? null
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
  // 'queue' = everything still to go out (not SENT), soonest first, undated last.
  if (status === 'queue') where.status = { in: ['DRAFT', 'SCHEDULED', 'SENDING', 'FAILED'] }
  else if (status && status !== 'all') where.status = status
  const orderBy =
    status === 'queue'
      ? [{ scheduledFor: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }]
      : [{ createdAt: 'desc' }]

  const [broadcasts, total, overallTotal] = await Promise.all([
    prisma.smsBroadcast.findMany({
      where,
      include: { creator: { select: { fullName: true, email: true } } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      orderBy: orderBy as any,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.smsBroadcast.count({ where }),
    prisma.smsBroadcast.count(),
  ])

  return {
    broadcasts,
    total,
    /** All broadcasts regardless of filter — tells "none yet" from "no filter match". */
    overallTotal,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

// ── Private send logic ─────────────────────────────────────────────────────────

type SendableBroadcast = {
  id: string
  message: string
  messageBn: string | null
  sendLanguage: SmsSendLanguage
}

const isDevSend = () => env.DEV_MODE || env.NODE_ENV === 'development'

/**
 * Atomically move a DRAFT/SCHEDULED broadcast to SENDING. Exactly one caller wins; the
 * loser gets false and must not call the provider.
 */
async function claimForSending(id: string): Promise<boolean> {
  const { count } = await prisma.smsBroadcast.updateMany({
    where: { id, status: { in: ['DRAFT', 'SCHEDULED'] } },
    data: { status: 'SENDING' },
  })
  return count === 1
}

/**
 * The one provider call (or the dev simulation). Retries live in the BDApps adapter, which
 * never re-sends a request BDApps may already have accepted. Throws if the send failed.
 */
async function providerSend(broadcast: SendableBroadcast) {
  const combined = composeSms(broadcast.message, broadcast.messageBn, broadcast.sendLanguage)
  if (isDevSend()) {
    console.log(`[SMS Broadcast DEV] id=${broadcast.id} message="${combined}"`)
    return { providerMessageId: `dev-${broadcast.id}`, targetCount: 1, deliveredCount: 1 }
  }
  const res = await smsSend(combined, ['tel:all'])
  // Real per-recipient counts arrive asynchronously via /api/webhooks/sms/report.
  return { providerMessageId: res.messageId || null, targetCount: 0, deliveredCount: 0 }
}

type SendResult = Awaited<ReturnType<typeof providerSend>>

/**
 * Record a send that already happened. A DB error here is returned, never thrown or turned
 * into FAILED: the message is out, so the broadcast must not look re-sendable.
 */
async function recordSent(broadcastId: string, now: Date, result: SendResult) {
  try {
    const row = await prisma.smsBroadcast.update({
      where: { id: broadcastId },
      data: {
        status: 'SENT',
        sentAt: now,
        active: true,
        providerMessageId: result.providerMessageId,
        targetCount: result.targetCount,
        deliveredCount: result.deliveredCount,
        failedCount: 0,
        lastError: null,
        sendAttempts: { increment: 1 },
      },
    })
    // Content-override: only the newest sent daily content stays active. Best effort.
    await prisma.smsBroadcast
      .updateMany({ where: { active: true, id: { not: broadcastId } }, data: { active: false } })
      .catch((err: unknown) =>
        logger.cron('sms.broadcast.deactivate.failed', { broadcastId, error: String(err) }, { level: 'error' }),
      )
    return { ok: true as const, row }
  } catch (error) {
    logger.cron('sms.broadcast.record.failed', { broadcastId, error: String(error) }, { level: 'error' })
    return { ok: false as const, error }
  }
}

/** Best effort: the send already happened, so a failed audit write must not fail it. */
async function auditSent(...args: Parameters<typeof createAuditLog>) {
  try {
    await createAuditLog(...args)
  } catch (error) {
    logger.cron('sms.broadcast.audit.failed', { broadcastId: args[3], error: String(error) }, { level: 'error' })
  }
}

/** The provider call failed: nothing went out as far as we know, so the admin may retry. */
async function markFailed(broadcastId: string, error: unknown) {
  try {
    await prisma.smsBroadcast.update({
      where: { id: broadcastId },
      data: { status: 'FAILED', sendAttempts: { increment: 1 }, lastError: errorText(error) },
    })
  } catch (dbError) {
    // Left in SENDING: recoverStuckBroadcasts will close it out.
    logger.cron('sms.broadcast.markFailed.failed', { broadcastId, error: String(dbError) }, { level: 'error' })
  }
}

function errorText(err: unknown) {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500)
}

// ── Public send functions ──────────────────────────────────────────────────────

/**
 * Send an SMS broadcast immediately (manual trigger by an admin).
 *
 * In dev mode (DEV_MODE=true or NODE_ENV=development) the message is logged
 * to the console and the broadcast is marked SENT with synthetic counts.
 * In production the BDApps smsSend API is called with `destinationAddresses:
 * ["tel:all"]` to reach all subscribers.
 *
 * Concurrent calls (double-click, a manual send racing the cron) make one provider call:
 * the loser throws without sending.
 */
export async function sendBroadcast(broadcastId: string, adminUserId: string, now: Date) {
  const broadcast = await prisma.smsBroadcast.findUnique({ where: { id: broadcastId } })

  if (!broadcast) {
    throw new Error('Broadcast not found')
  }
  if (!canSendBroadcast(broadcast.status)) {
    throw new Error(`Cannot send a broadcast with status ${broadcast.status}`)
  }
  if (!(await claimForSending(broadcastId))) {
    throw new Error('This broadcast is already being sent')
  }

  let result: SendResult
  try {
    result = await providerSend(broadcast)
  } catch (error) {
    await markFailed(broadcastId, error)
    throw error
  }

  const recorded = await recordSent(broadcastId, now, result)
  await auditSent(adminUserId, AUDIT_ACTIONS.SEND_SMS_BROADCAST, 'SmsBroadcast', broadcastId, {
    message: broadcast.message.slice(0, 100),
    devMode: isDevSend(),
  })
  if (!recorded.ok) {
    throw new Error(
      'The broadcast was sent, but saving its status failed. Do not send it again; it will be reviewed within a day.',
    )
  }
  return recorded.row
}

/**
 * Dispatch the next due scheduled broadcast (one per run = one per day).
 * Returns what happened.
 */
export async function dispatchScheduledBroadcast(now: Date) {
  const due = await prisma.smsBroadcast.findFirst({
    where: { status: 'SCHEDULED', scheduledFor: { lte: now } },
    orderBy: { scheduledFor: 'asc' },
  })
  if (!due) return { dispatched: false as const }
  // A manual send (or another run) may have taken it between the find and now.
  if (!(await claimForSending(due.id))) return { dispatched: false as const, skipped: 'already claimed' }

  let result: SendResult
  try {
    result = await providerSend(due)
  } catch (err) {
    // A failing broadcast must not hold the queue across days.
    await markFailed(due.id, err)
    logger.cron('sms.broadcast.dispatch.failed', { broadcastId: due.id, failed: true, error: String(err) }, { level: 'error' })
    return { dispatched: false as const, error: String(err) }
  }

  const recorded = await recordSent(due.id, now, result)
  await auditSent(due.createdBy, AUDIT_ACTIONS.DISPATCH_SMS_BROADCAST, 'SmsBroadcast', due.id, { auto: true })
  return recorded.ok
    ? { dispatched: true as const, broadcastId: due.id }
    : { dispatched: true as const, broadcastId: due.id, unrecorded: true as const }
}

/**
 * Close out broadcasts stuck in SENDING (the process died mid-send, or the result could not
 * be saved). We cannot know whether BDApps sent it, so it moves to FAILED with an "outcome
 * unknown" error; the admin checks the handset/BDApps and may reschedule it.
 */
export async function recoverStuckBroadcasts(now: Date, thresholdMs = SMS_STUCK_SENDING_MS) {
  const { count } = await prisma.smsBroadcast.updateMany({
    where: { status: 'SENDING', updatedAt: { lt: new Date(now.getTime() - thresholdMs) } },
    data: {
      status: 'FAILED',
      lastError: 'Outcome unknown: sending did not finish. Check whether subscribers received it before rescheduling.',
    },
  })
  if (count > 0) logger.cron('sms.broadcast.recovered', { count }, { level: 'error' })
  return { recovered: count }
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

  // Only an exact providerMessageId match counts; never fall back to another broadcast.
  const broadcast = await prisma.smsBroadcast.findFirst({
    where: { providerMessageId: requestId },
    orderBy: { sentAt: 'desc' },
  })
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
