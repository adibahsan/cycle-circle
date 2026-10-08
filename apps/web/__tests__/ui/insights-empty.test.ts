import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { hasAnyInsightsData } from '@/lib/insights-data'

const none = {
  cycleLengthTrend: [],
  symptomFrequency: [],
  periodRegularity: { mean: 0, stdDev: 0, regular: false, sampleSize: 0 },
  fertileWindowHistory: [],
}

describe('hasAnyInsightsData', () => {
  it('is false when every series is empty', () => {
    expect(hasAnyInsightsData(none)).toBe(false)
  })
  it('is false when symptom rows exist but all counts are zero', () => {
    expect(hasAnyInsightsData({ ...none, symptomFrequency: [{ symptom: 'x', count: 0 }] as never })).toBe(false)
  })
  it('is true with any cycle length point', () => {
    expect(hasAnyInsightsData({ ...none, cycleLengthTrend: [{ cycleStart: '2026-01-01', length: 28 }] as never })).toBe(true)
  })
  it('is true when the regularity sample exists', () => {
    expect(hasAnyInsightsData({ ...none, periodRegularity: { ...none.periodRegularity, sampleSize: 3 } })).toBe(true)
  })
  it('is true with fertile window history', () => {
    expect(hasAnyInsightsData({ ...none, fertileWindowHistory: [{}] as never })).toBe(true)
  })
})

describe('insights chart text', () => {
  it('axis ticks are at least 11px', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../src/app/(main)/insights/InsightsClient.tsx'), 'utf8')
    expect(src).not.toMatch(/fontSize:\s*(\d|10)\b(?!\d)/)
  })
})
