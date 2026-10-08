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
