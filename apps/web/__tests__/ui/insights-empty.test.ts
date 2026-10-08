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

import { groupInsights } from '@/lib/insights-data'

describe('groupInsights', () => {
  it('lists every chart as missing when nothing has data', () => {
    const g = groupInsights(none)
    expect(g.present).toEqual([])
    expect(g.missing).toEqual(['cycleLengthTrend', 'symptomFrequency', 'periodRegularity', 'fertileWindowHistory'])
  })
  it('splits charts with data from empty ones, keeping page order', () => {
    const g = groupInsights({
      ...none,
      cycleLengthTrend: [{ cycleStart: '2026-01-01', length: 28 }] as never,
      fertileWindowHistory: [{}] as never,
    })
    expect(g.present).toEqual(['cycleLengthTrend', 'fertileWindowHistory'])
    expect(g.missing).toEqual(['symptomFrequency', 'periodRegularity'])
  })
  it('treats all-zero symptom counts as missing', () => {
    expect(groupInsights({ ...none, symptomFrequency: [{ symptom: 'x', count: 0 }] as never }).present).toEqual([])
  })
  it('has no missing charts when everything has data', () => {
    const g = groupInsights({
      cycleLengthTrend: [{}] as never,
      symptomFrequency: [{ symptom: 'x', count: 2 }] as never,
      periodRegularity: { mean: 28, stdDev: 1, regular: true, sampleSize: 4 },
      fertileWindowHistory: [{}] as never,
    })
    expect(g.missing).toEqual([])
  })
})
