import { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { bangladeshToday, dayToStoredDate, storedDateToDay, bangladeshDayOf } from '../../utils/dhaka-date'
import { AUDIT_ACTIONS } from './audit-actions'
import { createAuditLog } from './audit-service'

// The Pro price (ADR 0011): an amount in taka and a period, kept as a history. Days are Bangladesh days.

export const PRO_PRICE_PERIODS = ['DAILY', 'WEEKLY', 'MONTHLY'] as const
export type ProPricePeriod = (typeof PRO_PRICE_PERIODS)[number]

export interface ProPriceEntry {
  id: string
  /** Taka. */
  amount: number
  period: ProPricePeriod
  /** First Bangladesh day the price applies, `YYYY-MM-DD`. */
  effectiveFrom: string
  /** The admin who set it; null for the seeded first entry. */
  createdBy: string | null
  /** That admin's name (or email); null for the seeded first entry. */
  createdByName: string | null
  createdAt: Date
}

/** Largest price an admin can set, in taka. A typo guard, not a business rule. */
export const MAX_PRO_PRICE = 100_000

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

function toEntry(r: {
  id: string
  amount: Prisma.Decimal
  period: ProPricePeriod
  effectiveFrom: Date
  createdBy: string | null
  createdAt: Date
  creator?: { fullName: string | null; email: string | null } | null
}): ProPriceEntry {
  return {
    id: r.id,
    amount: r.amount.toNumber(),
    period: r.period,
    effectiveFrom: storedDateToDay(r.effectiveFrom),
    createdBy: r.createdBy,
    createdByName: r.creator ? (r.creator.fullName ?? r.creator.email) : null,
    createdAt: r.createdAt,
  }
}

/** Whether `day` is a real `YYYY-MM-DD` calendar day (2045-02-31 is not). */
function isRealDay(day: unknown): day is string {
  if (typeof day !== 'string' || !DAY_RE.test(day)) return false
  const d = dayToStoredDate(day)
  return !Number.isNaN(d.getTime()) && storedDateToDay(d) === day
}

/** The price in effect on a Bangladesh day: the latest entry on or before it (newest wins a tie). */
export async function getProPriceOn(day: string): Promise<ProPriceEntry | null> {
  if (!isRealDay(day)) throw new Error('Day must be a real YYYY-MM-DD date')
  const row = await prisma.proPrice.findFirst({
    where: { effectiveFrom: { lte: dayToStoredDate(day) } },
    orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    include: { creator: { select: { fullName: true, email: true } } },
  })
  return row ? toEntry(row) : null
}

/** The price in effect now (the Bangladesh day `now` falls on). */
export function getCurrentProPrice(now: Date): Promise<ProPriceEntry | null> {
  return getProPriceOn(bangladeshDayOf(now))
}

/** Every entry, newest effective day first (then newest set first). */
export async function listProPriceHistory(): Promise<ProPriceEntry[]> {
  const rows = await prisma.proPrice.findMany({
    orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    include: { creator: { select: { fullName: true, email: true } } },
  })
  return rows.map(toEntry)
}

export interface SetProPriceInput {
  /** Taka, more than 0, at most two decimals. */
  amount: number
  period: ProPricePeriod
  /** Bangladesh day, today or later. Defaults to today. */
  effectiveFrom?: string
}

/**
 * Set a new Pro price from a Bangladesh day (today or later). Appends to the history and writes an
 * audit row. Does not change what BDApps charges.
 */
export async function setProPrice(
  adminId: string,
  input: SetProPriceInput,
  now: Date,
): Promise<ProPriceEntry> {
  const { amount, period } = input
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('Price must be a number greater than 0')
  }
  if (amount > MAX_PRO_PRICE) throw new Error(`Price must be at most ${MAX_PRO_PRICE} taka`)
  if (Math.round(amount * 100) / 100 !== amount) throw new Error('Price can have at most two decimal places')
  if (!PRO_PRICE_PERIODS.includes(period)) throw new Error('Period must be daily, weekly or monthly')

  const today = bangladeshToday(now)
  const day = input.effectiveFrom ?? today
  if (!isRealDay(day)) throw new Error('Effective day must be a real date written YYYY-MM-DD')
  if (day < today) throw new Error('Effective day cannot be in the past')

  const previous = await getProPriceOn(day)
  const row = await prisma.proPrice.create({
    data: { amount: new Prisma.Decimal(amount), period, effectiveFrom: dayToStoredDate(day), createdBy: adminId },
    include: { creator: { select: { fullName: true, email: true } } },
  })
  const entry = toEntry(row)
  await createAuditLog(adminId, AUDIT_ACTIONS.PRO_PRICE_SET, 'ProPrice', entry.id, {
    from: previous && { amount: previous.amount, period: previous.period, effectiveFrom: previous.effectiveFrom },
    to: { amount: entry.amount, period: entry.period, effectiveFrom: entry.effectiveFrom },
  })
  return entry
}
