import { prisma } from '../db'
import { addDaysToDay, bangladeshToday } from '../../utils/dhaka-date'
import type { DateRange, DayWindow } from '../../utils/date-range'
import { averageSince } from '../../utils/day-series'
import { getDailyActiveUsers, getFirstActivityDay } from './user-activity-service'
import {
  CHURN_REASONS,
  countProUsers,
  getChurnSummary,
  getProSnapshots,
  type ChurnReasonValue,
} from './churn-service'
import { listProPriceHistory, type ProPriceEntry } from './pro-price-service'

/**
 * The Overview's headline numbers (GLOSSARY: Active user, Churn, Estimated revenue, Pro price).
 * `getOverviewMetrics(range, now)` is the one source for the admin Overview and the emailed reports.
 */

/** A number with the same figure for the previous period of equal length. `null` means unavailable. */
export interface Metric {
  value: number | null
  previous: number | null
  /** % change against the previous period, one decimal. Null when either side is unavailable or the previous was 0. */
  change: number | null
}

export interface OverviewMetrics {
  range: Pick<DayWindow, 'fromDay' | 'toDay' | 'days'>
  previousRange: Pick<DayWindow, 'fromDay' | 'toDay' | 'days'>
  /** Live users at the end of the period. */
  totalUsers: Metric
  /** Users who signed up during the period, including any deleted since. */
  newSignups: Metric
  activeUsers: {
    /** Mean of the daily active users over the days on or after the first recorded day. Unavailable when the period lies wholly before recording. */
    average: Metric
    /** Active users on the period's last day. */
    latest: Metric
    series: { date: string; count: number }[]
  }
  /** Pro subscribers at the end of the period (nightly snapshot; the live count for today). */
  proSubscribers: Metric
  churn: {
    byReason: Record<ChurnReasonValue, Metric>
    /** Everything except admin revokes. */
    churned: Metric
    /** churned / Pro subscribers at the start of the period, as a fraction (0.1 = 10%). */
    rate: Metric
  }
  /** Estimated, never billed: Pro subscribers each day x the daily equivalent of the price in effect. Taka. */
  revenue: {
    /** The headline: average per day over the days that have a snapshot and a price. `change` compares these averages. */
    dailyAverage: Metric
    /** Sum over the same days: the secondary figure. Null when no day qualifies. */
    total: number | null
    previousTotal: number | null
    unavailableDays: number
    previousUnavailableDays: number
    /** `amount` is null for a day without a snapshot (or without a price): unavailable, not zero. */
    series: { date: string; amount: number | null }[]
  }
}

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp

/** % change from `previous` to `value`; null when it can't be said (a side is unavailable, or previous is 0 and value isn't). */
export function percentChange(value: number | null, previous: number | null): number | null {
  if (value === null || previous === null) return null
  if (previous === 0) return value === 0 ? 0 : null
  return round(((value - previous) / previous) * 100, 1)
}

const roundOrNull = (n: number | null, dp: number) => (n === null ? null : round(n, dp))

const metric = (value: number | null, previous: number | null, changeOn?: [number | null, number | null]): Metric => ({
  value,
  previous,
  change: percentChange(...(changeOn ?? [value, previous])),
})

function daysIn(w: Pick<DayWindow, 'fromDay' | 'toDay'>): string[] {
  const out: string[] = []
  for (let d = w.fromDay; d <= w.toDay; d = addDaysToDay(d, 1)) out.push(d)
  return out
}

function daysInMonth(day: string): number {
  const [y, m] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Taka per day for a price on a given Bangladesh day: weekly / 7, monthly / days in that month. */
export function dailyEquivalent(price: Pick<ProPriceEntry, 'amount' | 'period'>, day: string): number {
  if (price.period === 'WEEKLY') return price.amount / 7
  if (price.period === 'MONTHLY') return price.amount / daysInMonth(day)
  return price.amount
}

interface Shared {
  now: Date
  today: string
  liveProCount: number
  /** First Bangladesh day with a recorded active user; null before recording began. */
  firstActivityDay: string | null
  /** Newest effective day first, as listProPriceHistory returns it. */
  prices: ProPriceEntry[]
}

async function figures(w: DayWindow, s: Shared) {
  const [totalUsers, newSignups, dau, snapshots, churn] = await Promise.all([
    prisma.user.count({
      where: { createdAt: { lte: w.to }, OR: [{ deletedAt: null }, { deletedAt: { gt: w.to } }] },
    }),
    prisma.user.count({ where: { createdAt: { gte: w.from, lte: w.to } } }),
    getDailyActiveUsers(w),
    getProSnapshots(w),
    getChurnSummary(w, s.now),
  ])

  const proByDay = new Map(snapshots.map((r) => [r.day, r.proCount]))
  const proOn = (day: string) => (day === s.today ? s.liveProCount : (proByDay.get(day) ?? null))

  const revenue = daysIn(w).map((date) => {
    const pro = proOn(date)
    const price = s.prices.find((p) => p.effectiveFrom <= date)
    return { date, amount: pro === null || !price ? null : pro * dailyEquivalent(price, date) }
  })
  const available = revenue.filter((d) => d.amount !== null).map((d) => d.amount as number)
  const revenueTotal = available.length ? available.reduce((a, b) => a + b, 0) : null

  return {
    totalUsers,
    newSignups,
    dau,
    dauAverage: roundOrNull(averageSince(dau, s.firstActivityDay), 2),
    dauLatest: dau.length && s.firstActivityDay !== null && w.toDay >= s.firstActivityDay ? dau[dau.length - 1].count : null,
    pro: proOn(w.toDay),
    churn,
    revenue,
    revenueTotal,
    revenuePerDay: revenueTotal === null ? null : revenueTotal / available.length,
    unavailableDays: revenue.length - available.length,
  }
}

/** The Overview's headline numbers for `range`, each against the previous period of equal length. */
export async function getOverviewMetrics(range: DateRange, now: Date): Promise<OverviewMetrics> {
  const [prices, liveProCount, firstActivityDay] = await Promise.all([listProPriceHistory(), countProUsers(), getFirstActivityDay()])
  const shared: Shared = { now, today: bangladeshToday(now), liveProCount, firstActivityDay, prices }
  const [cur, prev] = await Promise.all([figures(range, shared), figures(range.previous, shared)])

  const reason = (r: ChurnReasonValue) => metric(cur.churn.byReason[r], prev.churn.byReason[r])
  const money = (n: number | null) => (n === null ? null : round(n, 2))

  return {
    range: { fromDay: range.fromDay, toDay: range.toDay, days: range.days },
    previousRange: { fromDay: range.previous.fromDay, toDay: range.previous.toDay, days: range.previous.days },
    totalUsers: metric(cur.totalUsers, prev.totalUsers),
    newSignups: metric(cur.newSignups, prev.newSignups),
    activeUsers: {
      average: metric(cur.dauAverage, prev.dauAverage),
      latest: metric(cur.dauLatest, prev.dauLatest),
      series: cur.dau,
    },
    proSubscribers: metric(cur.pro, prev.pro),
    churn: {
      byReason: Object.fromEntries(CHURN_REASONS.map((r) => [r, reason(r)])) as Record<ChurnReasonValue, Metric>,
      churned: metric(cur.churn.churned, prev.churn.churned),
      rate: metric(cur.churn.rate, prev.churn.rate),
    },
    revenue: {
      dailyAverage: metric(money(cur.revenuePerDay), money(prev.revenuePerDay), [cur.revenuePerDay, prev.revenuePerDay]),
      total: money(cur.revenueTotal),
      previousTotal: money(prev.revenueTotal),
      unavailableDays: cur.unavailableDays,
      previousUnavailableDays: prev.unavailableDays,
      series: cur.revenue.map((d) => ({ date: d.date, amount: money(d.amount) })),
    },
  }
}
