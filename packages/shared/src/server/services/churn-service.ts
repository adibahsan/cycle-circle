import { prisma } from '../db'
import type { DayWindow } from '../../utils/date-range'
import {
  addDaysToDay,
  bangladeshDayOf,
  dayToStoredDate,
  parseDhakaDay,
  storedDateToDay,
} from '../../utils/dhaka-date'

/** Why a Pro user became non-Pro (GLOSSARY: Churn). */
export const CHURN_REASONS = ['DAILY_CHECK', 'BDAPPS_UNSUBSCRIBE', 'ADMIN_REVOKE', 'ACCOUNT_DELETED'] as const
export type ChurnReasonValue = (typeof CHURN_REASONS)[number]

/** The part of the shared range (utils/date-range) the churn functions read: inclusive Bangladesh days. */
export type ChurnRange = Pick<DayWindow, 'fromDay' | 'toDay'>

/**
 * Record that a Pro user stopped being Pro. `at` defaults to the database clock; callers that
 * have `now` (ADR 0009) pass it.
 */
export async function recordChurnEvent(userId: string, reason: ChurnReasonValue, at?: Date) {
  await prisma.churnEvent.create({ data: { userId, reason, ...(at && { occurredAt: at }) } })
}

/** Remove a user's latest ACCOUNT_DELETED churn event (a restored account did not churn). No-op when there is none. */
export async function removeLatestAccountDeletedChurn(userId: string): Promise<void> {
  const latest = await prisma.churnEvent.findFirst({
    where: { userId, reason: 'ACCOUNT_DELETED' },
    orderBy: { occurredAt: 'desc' },
    select: { id: true },
  })
  if (latest) await prisma.churnEvent.delete({ where: { id: latest.id } })
}

export interface ChurnSummary {
  range: ChurnRange
  byReason: Record<ChurnReasonValue, number>
  /** Events that count toward the churn rate: everything except admin revokes. */
  churned: number
  /** Pro subscribers at the end of the day before `range.fromDay` (snapshot); null if none was stored. */
  proAtStart: number | null
  /** churned / proAtStart; null when proAtStart is missing or zero. */
  rate: number | null
}

/**
 * Churn in a range of Bangladesh days: counts by reason, and the churn rate with admin revokes
 * left out. The range end is capped at today (`now`).
 */
export async function getChurnSummary(range: ChurnRange, now: Date): Promise<ChurnSummary> {
  const today = bangladeshDayOf(now)
  const to = range.toDay > today ? today : range.toDay
  const byReason = Object.fromEntries(CHURN_REASONS.map((r) => [r, 0])) as Record<ChurnReasonValue, number>
  const proAtStart = (
    await prisma.proSnapshot.findUnique({ where: { day: dayToStoredDate(addDaysToDay(range.fromDay, -1)) } })
  )?.proCount ?? null

  if (to >= range.fromDay) {
    const rows = await prisma.churnEvent.groupBy({
      by: ['reason'],
      where: { occurredAt: { gte: parseDhakaDay(range.fromDay)!, lte: parseDhakaDay(to, true)! } },
      _count: { _all: true },
    })
    for (const r of rows) byReason[r.reason] = r._count._all
  }
  const churned = CHURN_REASONS.filter((r) => r !== 'ADMIN_REVOKE').reduce((n, r) => n + byReason[r], 0)
  return {
    range: { fromDay: range.fromDay, toDay: to },
    byReason,
    churned,
    proAtStart,
    rate: proAtStart ? churned / proAtStart : null,
  }
}

/**
 * The Pro subscriber count every admin page shows: users on the Pro plan who are not deleted.
 * Counts users, never subscription rows, so a deleted user's leftover row can't inflate it.
 */
export async function countProUsers(): Promise<number> {
  return prisma.user.count({ where: { subscriptionStatus: 'PRO', deletedAt: null } })
}

/**
 * Store the Pro subscriber count for the Bangladesh day `now` falls on (re-runs the same day
 * overwrite). Counts users who are Pro and not deleted. Run it late in the day.
 */
export async function snapshotProCount(now: Date): Promise<{ day: string; proCount: number }> {
  const day = bangladeshDayOf(now)
  const proCount = await countProUsers()
  await prisma.proSnapshot.upsert({
    where: { day: dayToStoredDate(day) },
    create: { day: dayToStoredDate(day), proCount },
    update: { proCount, computedAt: now },
  })
  return { day, proCount }
}

/** Stored Pro counts for the range, oldest first. Days with no snapshot are absent. */
export async function getProSnapshots(range: ChurnRange): Promise<{ day: string; proCount: number }[]> {
  const rows = await prisma.proSnapshot.findMany({
    where: { day: { gte: dayToStoredDate(range.fromDay), lte: dayToStoredDate(range.toDay) } },
    orderBy: { day: 'asc' },
  })
  return rows.map((r) => ({ day: storedDateToDay(r.day), proCount: r.proCount }))
}
