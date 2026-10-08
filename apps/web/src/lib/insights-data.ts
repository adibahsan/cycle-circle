import type {
  CycleLengthPoint,
  SymptomFrequencyPoint,
  PeriodRegularity,
  FertileWindowPoint,
} from '@vesta/shared/server/services/insights-service'

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
