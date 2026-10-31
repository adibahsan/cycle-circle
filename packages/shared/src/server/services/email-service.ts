import type { DeliveryStatus, EmailType } from '@prisma/client'
import { prisma } from '../db'
import { bangladeshToday, parseDhakaDay } from '../../utils/dhaka-date'

// ── List ───────────────────────────────────────────────────────────────────────

export interface EmailLogListParams {
  page?: number
  pageSize?: number
  type?: string
  status?: string
  deliveryStatus?: string
  userId?: string
  search?: string
  /** Shared dashboard range: mails sent from `dateFrom` to `dateTo` inclusive. */
  dateFrom?: Date
  dateTo?: Date
}

export async function listEmailLogs(params: EmailLogListParams = {}) {
  const {
    page = 1,
    pageSize = 20,
    type,
    status,
    deliveryStatus,
    userId,
    search,
    dateFrom,
    dateTo,
  } = params

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}

  if (type) where.type = type
  if (status) where.status = status
  if (deliveryStatus) where.deliveryStatus = deliveryStatus
  if (userId) where.userId = userId
  if (dateFrom || dateTo) where.sentAt = { ...(dateFrom && { gte: dateFrom }), ...(dateTo && { lte: dateTo }) }
  if (search) {
    where.OR = [
      { to: { contains: search, mode: 'insensitive' } },
      { subject: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [items, total] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        profile: { select: { id: true, name: true } },
      },
      orderBy: { sentAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.emailLog.count({ where }),
  ])

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

// ── Stats ──────────────────────────────────────────────────────────────────────

/** Counts of logged mails; with `dateFrom`/`dateTo` only those sent inside the shared range. */
export async function getEmailLogStats(range: { dateFrom?: Date; dateTo?: Date } = {}) {
  const where = range.dateFrom || range.dateTo
    ? { sentAt: { ...(range.dateFrom && { gte: range.dateFrom }), ...(range.dateTo && { lte: range.dateTo }) } }
    : {}
  const [total, byTypeRows, byStatusRows, byProviderRows] = await Promise.all([
    prisma.emailLog.count({ where }),
    prisma.emailLog.groupBy({ by: ['type'], where, _count: { _all: true } }),
    prisma.emailLog.groupBy({ by: ['status'], where, _count: { _all: true } }),
    prisma.emailLog.groupBy({ by: ['provider'], where, _count: { _all: true } }),
  ])

  const byType: Record<string, number> = {}
  for (const row of byTypeRows) {
    byType[row.type] = row._count._all
  }

  const byStatus: Record<string, number> = {}
  for (const row of byStatusRows) {
    byStatus[row.status] = row._count._all
  }

  const byProvider: Record<string, number> = {}
  for (const row of byProviderRows) {
    byProvider[row.provider] = row._count._all
  }

  return { total, byType, byStatus, byProvider }
}

// ── Get by ID ──────────────────────────────────────────────────────────────────

export async function getEmailLogById(id: string) {
  return prisma.emailLog.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, fullName: true, email: true, language: true } },
      profile: { select: { id: true, name: true } },
    },
  })
}

// "Today" is the Bangladesh day: the window opens at 00:00 Bangladesh (18:00 UTC the day before).
// ── Dedup helper (used by cron) ────────────────────────────────────────────────

export async function wasEmailSentToday(
  type: EmailType,
  profileId: string,
  now: Date,
): Promise<boolean> {
  const today = parseDhakaDay(bangladeshToday(now))
  const existing = await prisma.emailLog.findFirst({
    where: { type, profileId, sentAt: { gte: today }, status: 'SENT' },
  })
  return !!existing
}

// ── Dedup helper (user-level, used by cron for user-scoped reminders) ──────────

/**
 * Returns true if an email of the given type was already sent today for the
 * given userId (regardless of profileId). Used for user-level reminder dedup
 * where there is no associated profile (e.g. profile-completion reminders).
 */
export async function wasEmailSentTodayForUser(
  type: EmailType,
  userId: string,
  now: Date,
): Promise<boolean> {
  const today = parseDhakaDay(bangladeshToday(now))
  const existing = await prisma.emailLog.findFirst({
    where: { type, userId, sentAt: { gte: today }, status: 'SENT' },
  })
  return !!existing
}

// ── Webhook delivery update ────────────────────────────────────────────────────

export async function updateEmailDeliveryStatus(
  resendId: string,
  deliveryStatus: DeliveryStatus,
): Promise<void> {
  await prisma.emailLog.updateMany({
    where: { resendId },
    data: { deliveryStatus },
  })
}
