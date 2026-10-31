import { Prisma } from '@prisma/client'
import { AUDIT_ACTIONS } from './audit-actions'
import { prisma } from '../db'
import { createAuditLog } from './audit-service'
import { bangladeshDayOf, dayToStoredDate, storedDateToDay } from '../../utils/dhaka-date'
import { fillDaySeries, resolveDaySeriesRange, type DaySeriesOpts } from '../../utils/day-series'
import {
  canEditMessage,
  canDeleteCampaign,
  validateSmsBody,
  parseCampaignCsv,
  SMS_MAX_CSV_CHARS,
  SMS_MAX_CAMPAIGN_MESSAGES,
  SMS_MAX_CAMPAIGN_NAME,
  type SmsCsvError,
} from '../../utils/sms'

// ── Pure helpers ───────────────────────────────────────────────────────────────

export * from '../../utils/sms'

export type CampaignStatus = 'planned' | 'running' | 'finished' | 'cancelled'

/**
 * A campaign's status comes from its messages (ADR 0010):
 * cancelled when `cancelledAt` is set; planned when nothing has been sent, failed or missed yet;
 * finished when no message is left to go out; running otherwise.
 */
export function deriveCampaignStatus(
  campaign: { cancelledAt: Date | null },
  messages: { status: string }[],
): CampaignStatus {
  if (campaign.cancelledAt) return 'cancelled'
  const has = (...s: string[]) => messages.some((m) => s.includes(m.status))
  if (!has('SENT', 'SENDING', 'FAILED', 'MISSED')) return 'planned'
  if (!has('PLANNED')) return 'finished'
  return 'running'
}

const NAME_BODY_CHARS = 40

/** "First 40 characters of the text, then the day": how migrated and one-off campaigns are named. */
export function campaignNameFor(body: string, day: string): string {
  return `${body.replace(/\s+/g, ' ').trim().slice(0, NAME_BODY_CHARS).trim()} ${day}`
}

// ── Chart-data helpers ─────────────────────────────────────────────────────────

export type ChartDateOpts = DaySeriesOpts

/**
 * Daily counts of campaign messages sent over the requested range (default last 30 days), by
 * Bangladesh day of `sentAt`. Every day in the range is included; days with none get count 0.
 */
export async function getSmsSendHistory(opts: ChartDateOpts): Promise<{ date: string; count: number }[]> {
  const { from, to, fromDay, toDay } = resolveDaySeriesRange(opts)

  const sent = await prisma.smsCampaignMessage.findMany({
    where: { status: 'SENT', sentAt: { gte: from, lte: to } },
    select: { sentAt: true },
  })

  const counts = new Map<string, number>()
  for (const m of sent) {
    if (!m.sentAt) continue
    const key = bangladeshDayOf(m.sentAt)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return fillDaySeries(fromDay, toDay, counts)
}

/** Count of campaign messages by status (PLANNED | SENDING | SENT | FAILED | MISSED | CANCELLED). */
export async function getSmsDeliveryBreakdown(): Promise<{ status: string; count: number }[]> {
  const groups = await prisma.smsCampaignMessage.groupBy({
    by: ['status'],
    _count: { status: true },
    orderBy: { status: 'asc' },
  })
  return groups.map((g) => ({ status: g.status, count: g._count.status }))
}

// ── Planning ───────────────────────────────────────────────────────────────────

const ACTIVE_DAY_STATUSES = ['PLANNED', 'SENDING', 'SENT'] as const

export interface PlannedMessageInput {
  /** Bangladesh day, `YYYY-MM-DD`. */
  day: string
  body: string
}

function assertDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) {
    throw new Error(`Invalid day "${day}"`)
  }
}

function assertBody(body: string) {
  const problem = validateSmsBody(body)
  if (problem) throw new Error(problem)
}

/** Refuse a Bangladesh day before today's (ADR 0008: "today" is the Bangladesh day of `now`). */
function assertNotPast(day: string, now: Date) {
  if (day < bangladeshDayOf(now)) throw new Error(`${day} is in the past`)
}

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'

/**
 * Refuse any of `days` that already carries a PLANNED, SENDING or SENT message (one SMS a day
 * across all campaigns), naming the campaign that holds it. `exceptMessageId` skips a message
 * that is itself being moved.
 */
async function assertDaysFree(days: string[], exceptMessageId?: string) {
  const dup = days.find((d, i) => days.indexOf(d) !== i)
  if (dup) throw new Error(`${dup} is used twice in this campaign`)
  if (days.length === 0) return
  const clash = await prisma.smsCampaignMessage.findFirst({
    where: {
      day: { in: days.map(dayToStoredDate) },
      status: { in: [...ACTIVE_DAY_STATUSES] },
      ...(exceptMessageId ? { id: { not: exceptMessageId } } : {}),
    },
    include: { campaign: { select: { name: true } } },
  })
  if (clash) {
    throw new Error(`${storedDateToDay(clash.day)} already has a message in the campaign "${clash.campaign.name}"`)
  }
}

/**
 * Plan a campaign: one message per Bangladesh day, gaps allowed. Refused (nothing written) when a
 * day clashes with another campaign's message. Returns the campaign with its messages.
 */
export async function planCampaign(
  createdBy: string,
  input: { name: string; messages: PlannedMessageInput[] },
  opts: { auditAction?: string } = {},
) {
  if (!input.name.trim()) throw new Error('A campaign needs a name')
  if (input.messages.length === 0) throw new Error('A campaign needs at least one message')
  for (const m of input.messages) {
    assertDay(m.day)
    assertBody(m.body)
  }
  await assertDaysFree(input.messages.map((m) => m.day))

  try {
    const campaign = await prisma.smsCampaign.create({
      data: {
        name: input.name.trim(),
        createdBy,
        messages: { create: input.messages.map((m) => ({ day: dayToStoredDate(m.day), body: m.body })) },
      },
      include: { messages: { orderBy: { day: 'asc' } } },
    })
    await createAuditLog(createdBy, opts.auditAction ?? AUDIT_ACTIONS.CREATE_SMS_CAMPAIGN, 'SmsCampaign', campaign.id, {
      name: campaign.name,
      days: input.messages.length,
    })
    return campaign
  } catch (e) {
    // Lost a race for the day against another planner: the partial unique index says no.
    if (isUniqueViolation(e)) throw new Error('One of those days was just taken by another campaign')
    throw e
  }
}

/**
 * The composer's entry point: plan a campaign with the full set of rules. On top of `planCampaign`
 * it refuses past Bangladesh days, over-long texts, an over-long name and too many messages.
 */
export async function createCampaign(
  createdBy: string,
  input: { name: string; messages: PlannedMessageInput[] },
  now: Date,
) {
  if (input.name.trim().length > SMS_MAX_CAMPAIGN_NAME) {
    throw new Error(`Campaign name is too long (limit ${SMS_MAX_CAMPAIGN_NAME} characters)`)
  }
  if (input.messages.length > SMS_MAX_CAMPAIGN_MESSAGES) {
    throw new Error(`A campaign can have at most ${SMS_MAX_CAMPAIGN_MESSAGES} messages`)
  }
  for (const m of input.messages) {
    assertDay(m.day)
    assertNotPast(m.day, now)
  }
  return planCampaign(createdBy, input)
}

/** An import refused for these rows (or the file as a whole): nothing was written. */
export class CampaignImportError extends Error {
  constructor(readonly rowErrors: SmsCsvError[]) {
    super(
      rowErrors.length === 1
        ? `Line ${rowErrors[0].line}: ${rowErrors[0].message}`
        : `${rowErrors.length} rows have problems; nothing was imported`,
    )
  }
}

/**
 * Import a campaign from a CSV with columns `day,text`: one campaign, one message per row. It
 * gets the same rules as the composer (no past Bangladesh day, no day another campaign holds,
 * no repeated day, valid texts, the message cap) and is all-or-nothing: any bad row throws a
 * `CampaignImportError` listing every problem by line, and nothing is written.
 */
export async function importCampaignCsv(
  createdBy: string,
  input: { name: string; csv: string },
  now: Date,
) {
  if (input.name.trim().length > SMS_MAX_CAMPAIGN_NAME) {
    throw new Error(`Campaign name is too long (limit ${SMS_MAX_CAMPAIGN_NAME} characters)`)
  }
  if (!input.name.trim()) throw new Error('A campaign needs a name')
  if (input.csv.length > SMS_MAX_CSV_CHARS) throw new Error('The file is too large')

  const { rows, errors } = parseCampaignCsv(input.csv)
  const today = bangladeshDayOf(now)
  const future = rows.filter((r) => {
    if (r.day >= today) return true
    errors.push({ line: r.line, message: `${r.day} is in the past` })
    return false
  })

  if (future.length > 0) {
    const holders = await prisma.smsCampaignMessage.findMany({
      where: { day: { in: future.map((r) => dayToStoredDate(r.day)) }, status: { in: [...ACTIVE_DAY_STATUSES] } },
      include: { campaign: { select: { name: true } } },
    })
    const holderByDay = new Map(holders.map((h) => [storedDateToDay(h.day), h.campaign.name]))
    for (const r of future) {
      const holder = holderByDay.get(r.day)
      if (holder) errors.push({ line: r.line, message: `${r.day} already has a message in the campaign "${holder}"` })
    }
  }

  if (errors.length > 0) throw new CampaignImportError(errors.sort((a, b) => a.line - b.line))

  const campaign = await planCampaign(
    createdBy,
    { name: input.name, messages: rows.map(({ day, body }) => ({ day, body })) },
    { auditAction: AUDIT_ACTIONS.IMPORT_SMS_CAMPAIGN },
  )
  return campaign
}

/** Add one message to an existing, not-cancelled campaign (same rules as `createCampaign`). */
export async function addCampaignMessage(
  campaignId: string,
  adminUserId: string,
  input: PlannedMessageInput,
  now: Date,
) {
  assertDay(input.day)
  assertNotPast(input.day, now)
  assertBody(input.body)
  const campaign = await prisma.smsCampaign.findUnique({
    where: { id: campaignId },
    select: { cancelledAt: true, _count: { select: { messages: true } } },
  })
  if (!campaign) throw new Error('Campaign not found')
  if (campaign.cancelledAt) throw new Error('A cancelled campaign cannot get new messages')
  if (campaign._count.messages >= SMS_MAX_CAMPAIGN_MESSAGES) {
    throw new Error(`A campaign can have at most ${SMS_MAX_CAMPAIGN_MESSAGES} messages`)
  }
  await assertDaysFree([input.day])

  try {
    const message = await prisma.smsCampaignMessage.create({
      data: { campaignId, day: dayToStoredDate(input.day), body: input.body },
    })
    await createAuditLog(adminUserId, AUDIT_ACTIONS.ADD_SMS_MESSAGE, 'SmsCampaignMessage', message.id, {
      campaignId,
      day: input.day,
    })
    return message
  } catch (e) {
    if (isUniqueViolation(e)) throw new Error(`${input.day} was just taken by another campaign`)
    throw e
  }
}

// ── Editing and deleting ───────────────────────────────────────────────────────

async function loadEditable(messageId: string) {
  const m = await prisma.smsCampaignMessage.findUnique({
    where: { id: messageId },
    include: { campaign: { select: { cancelledAt: true } } },
  })
  if (!m) throw new Error('Message not found')
  if (m.campaign.cancelledAt) throw new Error('A cancelled campaign cannot be changed')
  if (!canEditMessage(m.status)) {
    throw new Error(
      m.status === 'SENT'
        ? 'A sent message cannot be changed'
        : m.status === 'SENDING'
          ? 'A message that is sending cannot be changed'
          : `A ${m.status.toLowerCase()} message cannot be changed`,
    )
  }
  return m
}

/** Edit an unsent (PLANNED) message's text. A failed or missed day is resent, never edited in place. */
export async function updateCampaignMessage(messageId: string, adminUserId: string, input: { body: string }) {
  const m = await loadEditable(messageId)
  assertBody(input.body)

  const updated = await prisma.smsCampaignMessage.update({ where: { id: messageId }, data: { body: input.body } })
  await createAuditLog(adminUserId, AUDIT_ACTIONS.UPDATE_SMS_MESSAGE, 'SmsCampaignMessage', messageId, {
    campaignId: m.campaignId,
  })
  return updated
}

/** Move an unsent (PLANNED) message to another Bangladesh day (refused on a clash). */
export async function rescheduleCampaignMessage(messageId: string, adminUserId: string, day: string, now?: Date) {
  assertDay(day)
  if (now) assertNotPast(day, now)
  const m = await loadEditable(messageId)
  await assertDaysFree([day], m.id)

  try {
    const updated = await prisma.smsCampaignMessage.update({
      where: { id: messageId },
      data: { day: dayToStoredDate(day) },
    })
    await createAuditLog(adminUserId, AUDIT_ACTIONS.RESCHEDULE_SMS_MESSAGE, 'SmsCampaignMessage', messageId, {
      from: storedDateToDay(m.day),
      to: day,
    })
    return updated
  } catch (e) {
    if (isUniqueViolation(e)) throw new Error(`${day} was just taken by another campaign`)
    throw e
  }
}

/**
 * Remove an unsent (PLANNED) message from a campaign and free its day. Refused for the campaign's
 * last message (delete the campaign instead), for a cancelled campaign and for any non-PLANNED message.
 */
export async function removeCampaignMessage(messageId: string, adminUserId: string) {
  const m = await loadEditable(messageId)
  const total = await prisma.smsCampaignMessage.count({ where: { campaignId: m.campaignId } })
  if (total <= 1) throw new Error("This is the campaign's last message; delete the campaign instead")

  const removed = await prisma.smsCampaignMessage.deleteMany({ where: { id: messageId, status: 'PLANNED' } })
  if (removed.count === 0) throw new Error('This message can no longer be removed')
  await createAuditLog(adminUserId, AUDIT_ACTIONS.REMOVE_SMS_MESSAGE, 'SmsCampaignMessage', messageId, {
    campaignId: m.campaignId,
    day: storedDateToDay(m.day),
  })
  return { success: true }
}

/** Delete a campaign none of whose messages has been sent (or is being sent). */
export async function deleteCampaign(campaignId: string, adminUserId: string) {
  const campaign = await prisma.smsCampaign.findUnique({
    where: { id: campaignId },
    include: { messages: { select: { status: true } } },
  })
  if (!campaign || !canDeleteCampaign(campaign.messages)) {
    throw new Error('Cannot delete a campaign that has sent, or is sending, a message')
  }
  await prisma.smsCampaign.delete({ where: { id: campaignId } })
  await createAuditLog(adminUserId, AUDIT_ACTIONS.DELETE_SMS_CAMPAIGN, 'SmsCampaign', campaignId, {
    name: campaign.name,
  })
  return { success: true }
}

/**
 * Cancel a campaign: every message still PLANNED becomes CANCELLED and the campaign is stamped
 * `cancelledAt`. Sent, sending, failed and missed messages stay as they are, so the campaign can
 * show "Cancelled, N of M sent". Refused when it is already cancelled.
 */
export async function cancelCampaign(campaignId: string, adminUserId: string, now: Date) {
  const campaign = await prisma.smsCampaign.findUnique({ where: { id: campaignId }, select: { name: true, cancelledAt: true } })
  if (!campaign) throw new Error('Campaign not found')
  if (campaign.cancelledAt) throw new Error('This campaign is already cancelled')

  const [cancelled] = await prisma.$transaction([
    prisma.smsCampaignMessage.updateMany({ where: { campaignId, status: 'PLANNED' }, data: { status: 'CANCELLED' } }),
    prisma.smsCampaign.update({ where: { id: campaignId }, data: { cancelledAt: now } }),
  ])
  const total = await prisma.smsCampaignMessage.count({ where: { campaignId } })
  const sent = await prisma.smsCampaignMessage.count({ where: { campaignId, status: 'SENT' } })
  await createAuditLog(adminUserId, AUDIT_ACTIONS.CANCEL_SMS_CAMPAIGN, 'SmsCampaign', campaignId, {
    name: campaign.name,
    cancelledMessages: cancelled.count,
    sent,
    total,
  })
  return { cancelled: cancelled.count, sent, total }
}

/**
 * Resend a FAILED or MISSED message on a chosen free Bangladesh day: a new PLANNED message with
 * the same text joins the campaign (same clash and past-day rules as planning). The failed or
 * missed day stays in the history and never moves a later day.
 */
export async function resendCampaignMessage(messageId: string, adminUserId: string, day: string, now: Date) {
  const original = await prisma.smsCampaignMessage.findUnique({ where: { id: messageId } })
  if (!original) throw new Error('Message not found')
  if (original.status !== 'FAILED' && original.status !== 'MISSED') {
    throw new Error('Only a failed or missed message can be resent')
  }
  const added = await addCampaignMessage(original.campaignId, adminUserId, { day, body: original.body }, now)
  await createAuditLog(adminUserId, AUDIT_ACTIONS.RESEND_SMS_MESSAGE, 'SmsCampaignMessage', messageId, {
    campaignId: original.campaignId,
    newMessageId: added.id,
    from: storedDateToDay(original.day),
    to: day,
  })
  return added
}

// ── Reading ────────────────────────────────────────────────────────────────────

const creatorSelect = { select: { fullName: true, email: true } } as const

/** The campaign that holds the next PLANNED message to go out, if any. */
export async function getNextPlannedCampaignId(): Promise<string | null> {
  const next = await prisma.smsCampaignMessage.findFirst({
    where: { status: 'PLANNED', campaign: { cancelledAt: null } },
    orderBy: [{ day: 'asc' }, { createdAt: 'asc' }],
    select: { campaignId: true },
  })
  return next?.campaignId ?? null
}

export interface CampaignListParams {
  page?: number
  pageSize?: number
  /** A derived status, or 'all' / undefined for every campaign. */
  status?: string
  /** Case-insensitive match on the campaign name or any message text, across all pages. */
  q?: string
}

/**
 * Campaigns newest first, across all statuses unless `status` narrows it. Each campaign carries
 * its derived `status`, its creator and its messages (by day).
 */
export async function listCampaigns(params: CampaignListParams = {}) {
  const { page = 1, pageSize = 20, status } = params
  const wanted = status && status !== 'all' ? status : null
  const q = params.q?.trim().slice(0, 100)
  const where: Prisma.SmsCampaignWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { messages: { some: { body: { contains: q, mode: 'insensitive' } } } },
        ],
      }
    : {}

  const include = { creator: creatorSelect, messages: { orderBy: { day: 'asc' as const } } }
  const withStatus = <T extends { cancelledAt: Date | null; messages: { status: string }[] }>(c: T) => ({
    ...c,
    status: deriveCampaignStatus(c, c.messages),
  })

  let rows
  let total: number
  if (wanted) {
    // The status is derived, so filter after loading. A campaign list stays small.
    const all = (await prisma.smsCampaign.findMany({ where, include, orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }] })).map(withStatus)
    const matching = all.filter((c) => c.status === wanted)
    total = matching.length
    rows = matching.slice((page - 1) * pageSize, page * pageSize)
  } else {
    const [found, count] = await Promise.all([
      prisma.smsCampaign.findMany({
        where,
        include,
        orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.smsCampaign.count({ where }),
    ])
    total = count
    rows = found.map(withStatus)
  }

  return {
    campaigns: rows,
    total,
    /** All campaigns regardless of filter: tells "none yet" from "no filter match". */
    overallTotal: wanted || q ? await prisma.smsCampaign.count() : total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

/** One campaign with its messages by day and derived status; null when it does not exist. */
export async function getCampaign(id: string) {
  const c = await prisma.smsCampaign.findUnique({
    where: { id },
    include: { creator: creatorSelect, messages: { orderBy: { day: 'asc' } } },
  })
  return c ? { ...c, status: deriveCampaignStatus(c, c.messages) } : null
}
