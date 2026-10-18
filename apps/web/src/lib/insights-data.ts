import type {
  CycleLengthPoint,
  SymptomFrequencyPoint,
  PeriodRegularity,
  FertileWindowPoint,
} from '@vesta/shared/server/services/insights-service'
import { appLocale, type Lang } from './language'

export interface InsightsSeries {
  cycleLengthTrend: CycleLengthPoint[]
  symptomFrequency: SymptomFrequencyPoint[]
  periodRegularity: PeriodRegularity
  fertileWindowHistory: FertileWindowPoint[]
}

/** True when at least one insight has something to chart. */
export function hasAnyInsightsData(s: InsightsSeries): boolean {
  return (
    s.cycleLengthTrend.length > 0 ||
    s.symptomFrequency.some((d) => d.count > 0) ||
    s.periodRegularity.sampleSize > 0 ||
    s.fertileWindowHistory.length > 0
  )
}

export type InsightKey = 'cycleLengthTrend' | 'symptomFrequency' | 'periodRegularity' | 'fertileWindowHistory'

/** Splits the four insights, in page order, into those with data and those without. */
export function groupInsights(s: InsightsSeries): { present: InsightKey[]; missing: InsightKey[] } {
  const has: Record<InsightKey, boolean> = {
    cycleLengthTrend: s.cycleLengthTrend.length > 0,
    symptomFrequency: s.symptomFrequency.some((d) => d.count > 0),
    periodRegularity: s.periodRegularity.sampleSize > 0,
    fertileWindowHistory: s.fertileWindowHistory.length > 0,
  }
  const keys = Object.keys(has) as InsightKey[]
  return { present: keys.filter((k) => has[k]), missing: keys.filter((k) => !has[k]) }
}

// ─── Language-aware formatting (Intl, never the browser locale) ───────────────

/** 28 → "28" / "২৮"; at most one decimal place. */
export function formatInsightNumber(n: number, lang: Lang): string {
  return new Intl.NumberFormat(appLocale(lang), { maximumFractionDigits: 1 }).format(n)
}

/** "2026-01-15" → "Jan 26" / "জানু ২৬". Reads the date as UTC so the month never shifts. */
export function formatMonthTick(ymd: string, lang: Lang): string {
  const d = new Date(`${ymd.slice(0, 10)}T00:00:00Z`)
  const month = new Intl.DateTimeFormat(appLocale(lang), { month: 'short', timeZone: 'UTC' }).format(d)
  const year = new Intl.NumberFormat(appLocale(lang), { minimumIntegerDigits: 2, useGrouping: false }).format(
    d.getUTCFullYear() % 100,
  )
  return `${month} ${year}`
}

/** Text-summary figures for the cycle length chart; null when there are no cycles. */
export function summarizeCycleLengths(
  data: CycleLengthPoint[],
): { count: number; shortest: number; longest: number; latest: number } | null {
  if (data.length === 0) return null
  const lengths = data.map((d) => d.cycleLength)
  return {
    count: lengths.length,
    shortest: Math.min(...lengths),
    longest: Math.max(...lengths),
    latest: lengths[lengths.length - 1],
  }
}

/** Text-summary figures for the symptom chart; null when nothing was logged. */
export function summarizeSymptoms(
  data: SymptomFrequencyPoint[],
): { top: string; topCount: number; total: number } | null {
  const total = data.reduce((s, d) => s + d.count, 0)
  if (total === 0) return null
  const top = data.reduce((a, b) => (b.count > a.count ? b : a))
  return { top: top.category, topCount: top.count, total }
}

// ─── Chart colours (#80) ──────────────────────────────────────────────────────

/** Series colours from the pastel accent tokens; each has a dark value. Never the goal accent. */
export const INSIGHTS_CHART_COLORS = {
  cycleLength: 'var(--color-accent-pink)',
  symptoms: 'var(--color-accent-lavender)',
  fertileWindow: 'var(--color-accent-mint)',
} as const
