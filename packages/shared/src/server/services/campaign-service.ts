import { Prisma } from '@prisma/client'
import { AUDIT_ACTIONS } from './audit-actions'
import { prisma } from '../db'
import { createAuditLog } from './audit-service'
import { addDaysToDay, bangladeshDayOf, dayToStoredDate, storedDateToDay } from '../../utils/dhaka-date'
import { fillDaySeries, resolveDaySeriesRange, type DaySeriesOpts } from '../../utils/day-series'
import {
  composeSms,
  scheduleDrafts,
  canEditMessage,
  canDeleteCampaign,
  type SmsDraft,
  type SmsSendLanguage,
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
  if (!body.trim()) throw new Error('Message cannot be empty')
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

/** First day from `fromDay` on with no PLANNED/SENDING/SENT message. */
async function nextFreeDay(fromDay: string): Promise<string> {
  const taken = await prisma.smsCampaignMessage.findMany({
    where: { day: { gte: dayToStoredDate(fromDay) }, status: { in: [...ACTIVE_DAY_STATUSES] } },
    select: { day: true },
  })
  const used = new Set(taken.map((t) => storedDateToDay(t.day)))
  let day = fromDay
  while (used.has(day)) day = addDaysToDay(day, 1)
  return day
}

/**
 * Plan a campaign: one message per Bangladesh day, gaps allowed. Refused (nothing written) when a
 * day clashes with another campaign's message. Returns the campaign with its messages.
 */
export async function planCampaign(
  createdBy: string,
  input: { name: string; messages: PlannedMessageInput[] },
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
      include: { messages: true },
    })
    await createAuditLog(createdBy, AUDIT_ACTIONS.CREATE_SMS_CAMPAIGN, 'SmsCampaign', campaign.id, {
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
 * Today's admin flow: one SMS is a one-day campaign. The text is composed from the English and
 * Bengali fields the way the send language says; the day is the Bangladesh day of `scheduledFor`
 * (an ISO instant), or the next free day from tomorrow when none is given.
 */
export async function createOneDayCampaign(
  createdBy: string,
  input: {
    message: string
    messageBn?: string
    scheduledFor?: string
    sendLanguage?: SmsSendLanguage
    now: Date
  },
) {
  const body = composeSms(input.message, input.messageBn, input.sendLanguage ?? 'BOTH')
  let day: string
  if (input.scheduledFor) {
    const when = new Date(input.scheduledFor)
    if (Number.isNaN(when.getTime())) throw new Error('Invalid schedule date')
    day = bangladeshDayOf(when)
  } else {
    day = await nextFreeDay(addDaysToDay(bangladeshDayOf(input.now), 1))
  }
  return planCampaign(createdBy, { name: campaignNameFor(body, day), messages: [{ day, body }] })
}

/**
 * Create one one-day campaign per draft (line parser or CSV). Dated drafts go out on their own
 * date, undated ones one per day from `startDate` (or tomorrow). Every draft is validated and
 * every day checked before anything is written.
 */
export async function createOneDayCampaignsBulk(
  createdBy: string,
  rows: SmsDraft[],
  opts: { startDate?: string; sendLanguage?: SmsSendLanguage; now: Date },
) {
  const lang = opts.sendLanguage ?? 'BOTH'
  const bodies = rows.map((r) => composeSms(r.messageEn, r.messageBn, lang))
  const days = scheduleDrafts(rows, opts.startDate, opts.now).map(bangladeshDayOf)
  bodies.forEach(assertBody)
  await assertDaysFree(days)

  return prisma.$transaction(async (tx) => {
    const created = []
    for (let i = 0; i < rows.length; i++) {
      created.push(
        await tx.smsCampaign.create({
          data: {
            name: campaignNameFor(bodies[i], days[i]),
            createdBy,
            messages: { create: [{ day: dayToStoredDate(days[i]), body: bodies[i] }] },
          },
          include: { messages: true },
        }),
      )
    }
    await tx.adminAuditLog.createMany({
      data: created.map((c) => ({
        adminId: createdBy,
        action: AUDIT_ACTIONS.CREATE_SMS_CAMPAIGN,
        targetType: 'SmsCampaign',
        targetId: c.id,
        metadata: { name: c.name, days: 1 },
      })),
    })
    return created
  })
}

// ── Editing and deleting ───────────────────────────────────────────────────────

async function loadEditable(messageId: string) {
  const m = await prisma.smsCampaignMessage.findUnique({ where: { id: messageId } })
  if (!m) throw new Error('Message not found')
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

/**
 * Edit an unsent message's text. A FAILED message goes back to PLANNED (its error cleared) when
 * its day is still free.
 */
export async function updateCampaignMessage(messageId: string, adminUserId: string, input: { body: string }) {
  const m = await loadEditable(messageId)
  assertBody(input.body)
  if (m.status === 'FAILED') await assertDaysFree([storedDateToDay(m.day)], m.id)

  const updated = await prisma.smsCampaignMessage.update({
    where: { id: messageId },
    data: {
      body: input.body,
      ...(m.status === 'FAILED' ? { status: 'PLANNED', lastError: null, sendAttempts: 0 } : {}),
    },
  })
  await createAuditLog(adminUserId, AUDIT_ACTIONS.UPDATE_SMS_MESSAGE, 'SmsCampaignMessage', messageId, {
    campaignId: m.campaignId,
  })
  return updated
}

/** Move an unsent message to another Bangladesh day (refused on a clash). Resets a FAILED one. */
export async function rescheduleCampaignMessage(messageId: string, adminUserId: string, day: string) {
  assertDay(day)
  const m = await loadEditable(messageId)
  await assertDaysFree([day], m.id)

  try {
    const updated = await prisma.smsCampaignMessage.update({
      where: { id: messageId },
      data: { day: dayToStoredDate(day), status: 'PLANNED', lastError: null, sendAttempts: 0 },
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
}

/**
 * Campaigns newest first, across all statuses unless `status` narrows it. Each campaign carries
 * its derived `status`, its creator and its messages (by day).
 */
export async function listCampaigns(params: CampaignListParams = {}) {
  const { page = 1, pageSize = 20, status } = params
  const wanted = status && status !== 'all' ? status : null

  const include = { creator: creatorSelect, messages: { orderBy: { day: 'asc' as const } } }
  const withStatus = <T extends { cancelledAt: Date | null; messages: { status: string }[] }>(c: T) => ({
    ...c,
    status: deriveCampaignStatus(c, c.messages),
  })

  let rows
  let total: number
  if (wanted) {
    // The status is derived, so filter after loading. A campaign list stays small.
    const all = (await prisma.smsCampaign.findMany({ include, orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }] })).map(withStatus)
    const matching = all.filter((c) => c.status === wanted)
    total = matching.length
    rows = matching.slice((page - 1) * pageSize, page * pageSize)
  } else {
    const [found, count] = await Promise.all([
      prisma.smsCampaign.findMany({
        include,
        orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.smsCampaign.count(),
    ])
    total = count
    rows = found.map(withStatus)
  }

  return {
    campaigns: rows,
    total,
    /** All campaigns regardless of filter: tells "none yet" from "no filter match". */
    overallTotal: wanted ? await prisma.smsCampaign.count() : total,
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
