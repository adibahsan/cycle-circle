import { AUDIT_ACTIONS } from './audit-actions'
import { prisma } from '../db'
import { logger } from '../log'
import { smsSend } from '../adapters/bdapps'
import { createAuditLog } from './audit-service'
import { bangladeshToday, dayToStoredDate } from '../../utils/dhaka-date'
import { env } from '../../utils/env'
import { canSendMessage } from '../../utils/sms'

// Sending campaign messages (the #195 guarantees, on SmsCampaignMessage):
//  - the PLANNED -> SENDING move is one conditional update, so exactly one caller sends;
//  - the provider call is made once (the BDApps adapter never re-sends a request it may have accepted);
//  - once the provider accepted, no database error can mark the message FAILED;
//  - a message stuck in SENDING is closed out as FAILED ("outcome unknown"), never put back to PLANNED.

/**
 * A SENDING message older than this is presumed orphaned (the process died mid-send). The send
 * itself is capped at ~20 s, so this is generous.
 */
export const SMS_STUCK_SENDING_MS = 30 * 60 * 1000

type SendableMessage = { id: string; body: string }

const isDevSend = () => env.DEV_MODE || env.NODE_ENV === 'development'

/**
 * Atomically move a PLANNED message to SENDING. Exactly one caller wins; the loser gets false
 * and must not call the provider.
 */
async function claimForSending(id: string): Promise<boolean> {
  const { count } = await prisma.smsCampaignMessage.updateMany({
    where: { id, status: 'PLANNED' },
    data: { status: 'SENDING' },
  })
  return count === 1
}

/**
 * The one provider call (or the dev simulation). Retries live in the BDApps adapter, which
 * never re-sends a request BDApps may already have accepted. Throws if the send failed.
 */
async function providerSend(message: SendableMessage) {
  if (isDevSend()) {
    console.log(`[SMS Campaign DEV] id=${message.id} message="${message.body}"`)
    return {
      providerRequestId: `dev-req-${message.id}`,
      providerMessageId: `dev-${message.id}`,
      audienceSize: 1 as number | null,
      deliveredCount: 1,
    }
  }
  const res = await smsSend(message.body, ['tel:all'])
  // Real per-recipient counts arrive asynchronously via /api/webhooks/sms/report.
  return {
    providerRequestId: res.requestId || null,
    providerMessageId: res.messageId || null,
    audienceSize: null as number | null,
    deliveredCount: 0,
  }
}

type SendResult = Awaited<ReturnType<typeof providerSend>>

/**
 * Record a send that already happened. A DB error here is returned, never thrown or turned
 * into FAILED: the message is out, so it must not look re-sendable.
 */
async function recordSent(messageId: string, now: Date, result: SendResult) {
  try {
    const row = await prisma.smsCampaignMessage.update({
      where: { id: messageId },
      data: {
        status: 'SENT',
        sentAt: now,
        providerRequestId: result.providerRequestId,
        providerMessageId: result.providerMessageId,
        audienceSize: result.audienceSize,
        deliveredCount: result.deliveredCount,
        failedCount: 0,
        lastError: null,
        sendAttempts: { increment: 1 },
      },
    })
    return { ok: true as const, row }
  } catch (error) {
    logger.cron('sms.message.record.failed', { messageId, error: String(error) }, { level: 'error' })
    return { ok: false as const, error }
  }
}

/** Best effort: the send already happened, so a failed audit write must not fail it. */
async function auditSent(...args: Parameters<typeof createAuditLog>) {
  try {
    await createAuditLog(...args)
  } catch (error) {
    logger.cron('sms.message.audit.failed', { messageId: args[3], error: String(error) }, { level: 'error' })
  }
}

/** The provider call failed: nothing went out as far as we know, so the admin may retry. */
async function markFailed(messageId: string, error: unknown) {
  try {
    await prisma.smsCampaignMessage.update({
      where: { id: messageId },
      data: { status: 'FAILED', sendAttempts: { increment: 1 }, lastError: errorText(error) },
    })
  } catch (dbError) {
    // Left in SENDING: recoverStuckMessages will close it out.
    logger.cron('sms.message.markFailed.failed', { messageId, error: String(dbError) }, { level: 'error' })
  }
}

function errorText(err: unknown) {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500)
}

// ── Public send functions ──────────────────────────────────────────────────────

/**
 * Send a campaign message immediately (manual trigger by an admin).
 *
 * In dev mode (DEV_MODE=true or NODE_ENV=development) the message is logged to the console and
 * marked SENT with synthetic counts. In production the BDApps smsSend API is called with
 * `destinationAddresses: ["tel:all"]` to reach all subscribers.
 *
 * Concurrent calls (double-click, a manual send racing the cron) make one provider call:
 * the loser throws without sending.
 */
export async function sendCampaignMessage(messageId: string, adminUserId: string, now: Date) {
  const message = await prisma.smsCampaignMessage.findUnique({ where: { id: messageId } })

  if (!message) {
    throw new Error('Message not found')
  }
  if (!canSendMessage(message.status)) {
    throw new Error(`Cannot send a message with status ${message.status}`)
  }
  if (!(await claimForSending(messageId))) {
    throw new Error('This message is already being sent')
  }

  let result: SendResult
  try {
    result = await providerSend(message)
  } catch (error) {
    await markFailed(messageId, error)
    throw error
  }

  const recorded = await recordSent(messageId, now, result)
  await auditSent(adminUserId, AUDIT_ACTIONS.SEND_SMS_BROADCAST, 'SmsCampaignMessage', messageId, {
    campaignId: message.campaignId,
    message: message.body.slice(0, 100),
    devMode: isDevSend(),
  })
  if (!recorded.ok) {
    throw new Error(
      'The message was sent, but saving its status failed. Do not send it again; it will be reviewed within a day.',
    )
  }
  return recorded.row
}

/**
 * Dispatch the next due planned message (one per run = one per day): the oldest PLANNED message
 * whose Bangladesh day has come, in a campaign that is not cancelled. Returns what happened.
 */
export async function dispatchDueCampaignMessage(now: Date) {
  const due = await prisma.smsCampaignMessage.findFirst({
    where: {
      status: 'PLANNED',
      day: { lte: dayToStoredDate(bangladeshToday(now)) },
      campaign: { cancelledAt: null },
    },
    orderBy: [{ day: 'asc' }, { createdAt: 'asc' }],
    include: { campaign: { select: { createdBy: true } } },
  })
  if (!due) return { dispatched: false as const }
  // A manual send (or another run) may have taken it between the find and now.
  if (!(await claimForSending(due.id))) return { dispatched: false as const, skipped: 'already claimed' }

  let result: SendResult
  try {
    result = await providerSend(due)
  } catch (err) {
    // A failing message must not hold the queue across days.
    await markFailed(due.id, err)
    logger.cron('sms.message.dispatch.failed', { messageId: due.id, failed: true, error: String(err) }, { level: 'error' })
    return { dispatched: false as const, error: String(err) }
  }

  const recorded = await recordSent(due.id, now, result)
  await auditSent(due.campaign.createdBy, AUDIT_ACTIONS.DISPATCH_SMS_BROADCAST, 'SmsCampaignMessage', due.id, {
    campaignId: due.campaignId,
    auto: true,
  })
  return recorded.ok
    ? { dispatched: true as const, messageId: due.id, campaignId: due.campaignId }
    : { dispatched: true as const, messageId: due.id, campaignId: due.campaignId, unrecorded: true as const }
}

/**
 * Close out messages stuck in SENDING (the process died mid-send, or the result could not be
 * saved). We cannot know whether BDApps sent it, so it moves to FAILED with an "outcome
 * unknown" error; the admin checks the handset/BDApps and may reschedule it.
 */
export async function recoverStuckMessages(now: Date, thresholdMs = SMS_STUCK_SENDING_MS) {
  const { count } = await prisma.smsCampaignMessage.updateMany({
    where: { status: 'SENDING', updatedAt: { lt: new Date(now.getTime() - thresholdMs) } },
    data: {
      status: 'FAILED',
      lastError: 'Outcome unknown: sending did not finish. Check whether subscribers received it before rescheduling.',
    },
  })
  if (count > 0) logger.cron('sms.message.recovered', { count }, { level: 'error' })
  return { recovered: count }
}

// ── Delivery-report recording ──────────────────────────────────────────────────

/**
 * Correlate an inbound sms/report to its message and bump its delivery counts.
 *
 * BDApps reports carry the `requestId` of the send, so that is matched first against
 * `providerRequestId`. Rows sent before it was stored fall back to `providerMessageId`.
 * Counts are bumped in SQL so concurrent reports (one per recipient) cannot lose updates.
 */
export async function recordSmsDeliveryReport(requestId: string, deliveryStatus: string) {
  if (!requestId) return { matched: false as const }

  // Only an exact id match counts; never fall back to another message.
  const message =
    (await prisma.smsCampaignMessage.findFirst({
      where: { providerRequestId: requestId },
      orderBy: { sentAt: 'desc' },
      select: { id: true },
    })) ??
    (await prisma.smsCampaignMessage.findFirst({
      where: { providerMessageId: requestId },
      orderBy: { sentAt: 'desc' },
      select: { id: true },
    }))
  if (!message) return { matched: false as const }

  const status = (deliveryStatus || '').toUpperCase()
  if (status === 'DELIVERED') {
    await prisma.$executeRaw`UPDATE "SmsCampaignMessage" SET "deliveredCount" = COALESCE("deliveredCount", 0) + 1 WHERE "id" = ${message.id}`
    return { matched: true as const, counted: true as const }
  }
  if (status === 'FAILED') {
    await prisma.$executeRaw`UPDATE "SmsCampaignMessage" SET "failedCount" = COALESCE("failedCount", 0) + 1 WHERE "id" = ${message.id}`
    return { matched: true as const, counted: true as const }
  }
  return { matched: true as const, counted: false as const } // PENDING / unknown
}
