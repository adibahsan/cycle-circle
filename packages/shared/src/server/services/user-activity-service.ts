import { prisma } from '../db'
import { bangladeshDayOf, dayToStoredDate, storedDateToDay } from '../../utils/dhaka-date'
import type { DayWindow } from '../../utils/date-range'
import { fillDaySeries } from '../../utils/day-series'

// Per-process memo of "already recorded today": makes the call cheap enough for every request.
const recorded = new Map<string, string>()
const MEMO_LIMIT = 50_000

/**
 * Record that `userId` opened the app on the Bangladesh day containing `now`.
 * Idempotent (one row per user per day). Suspended and deleted users are never recorded.
 */
export async function recordUserActivity(userId: string, now: Date): Promise<void> {
  const day = bangladeshDayOf(now)
  if (recorded.get(userId) === day) return

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { suspendedAt: true, deletedAt: true },
  })
  if (!user || user.suspendedAt || user.deletedAt) return

  await prisma.userActivity.createMany({
    data: [{ userId, day: dayToStoredDate(day) }],
    skipDuplicates: true,
  })
  if (recorded.size >= MEMO_LIMIT) recorded.clear()
  recorded.set(userId, day)
}

/** The first Bangladesh day anyone was recorded, or null before recording began. */
export async function getFirstActivityDay(): Promise<string | null> {
  const first = await prisma.userActivity.aggregate({ _min: { day: true } })
  return first._min.day ? storedDateToDay(first._min.day) : null
}

/**
 * Daily active users: distinct users who opened the app per Bangladesh day of the shared range,
 * gap-filled with zeros. Users suspended or deleted now are excluded. History starts on the
 * recording date (`getFirstActivityDay`).
 */
export async function getDailyActiveUsers(
  range: Pick<DayWindow, 'fromDay' | 'toDay'>,
): Promise<{ date: string; count: number }[]> {
  const { fromDay, toDay } = range
  const grouped = await prisma.userActivity.groupBy({
    by: ['day'],
    where: {
      day: { gte: dayToStoredDate(fromDay), lte: dayToStoredDate(toDay) },
      user: { suspendedAt: null, deletedAt: null },
    },
    _count: { userId: true },
  })
  const counts = new Map(grouped.map((g) => [storedDateToDay(g.day), g._count.userId]))
  return fillDaySeries(fromDay, toDay, counts)
}
