import { describe, it, expect } from 'vitest'
import { computePredictionMaeByTier } from '@vesta/shared/server/services'

// FR-ANALYTICS: prediction-accuracy MAE backtest.
// Pure-function tests — no DB required.

const DAY = 86_400_000
const t0 = Date.UTC(2026, 0, 1)

describe('computePredictionMaeByTier', () => {
  it('hand example: mixed 28/32/30 cycle history produces correct AVERAGE MAE', () => {
    // series: 4 period starts, gaps: 28d, 32d, 30d
    // c = [28, 32, 30]
    // j=2: history=[28], predictLen=28, predictedStart=t0+56d, actual=t0+60d, err=4  → AVERAGE
    // j=3: history=[28,32], weights=[1,2], weightedSum=28+64=92, round(92/3)=31
    //       predictedStart=t0+60d+31d=t0+91d, actual=t0+90d, err=1  → AVERAGE
    // AVERAGE: maeDays = round((4+1)/2 * 10)/10 = 2.5, sampleSize=2
    // ARIMA:   maeDays = null, sampleSize=0
    const result = computePredictionMaeByTier([
      [t0, t0 + 28 * DAY, t0 + 60 * DAY, t0 + 90 * DAY],
    ])

    const avg = result.find((r) => r.tier === 'AVERAGE')
    const arima = result.find((r) => r.tier === 'ARIMA')

    expect(avg).toBeDefined()
    expect(avg!.maeDays).toBe(2.5)
    expect(avg!.sampleSize).toBe(2)

    expect(arima).toBeDefined()
    expect(arima!.maeDays).toBeNull()
    expect(arima!.sampleSize).toBe(0)
  })

  it('perfect-prediction: constant 28d cycle → AVERAGE maeDays === 0', () => {
    // c = [28, 28, 28]
    // j=2: history=[28], predictLen=28, predictedStart=t0+56d, actual=t0+56d, err=0
    // j=3: history=[28,28], weights=[1,2], weighted=round((28+56)/3)=28, start=t0+84d, actual=t0+84d, err=0
    // AVERAGE: maeDays=0, sampleSize=2
    const result = computePredictionMaeByTier([
      [t0, t0 + 28 * DAY, t0 + 56 * DAY, t0 + 84 * DAY],
    ])

    const avg = result.find((r) => r.tier === 'AVERAGE')
    expect(avg!.maeDays).toBe(0)
    expect(avg!.sampleSize).toBe(2)
  })

  it('too-short series (< 3 starts) is ignored → AVERAGE sampleSize === 0', () => {
    const result = computePredictionMaeByTier([[t0, t0 + 28 * DAY]])

    const avg = result.find((r) => r.tier === 'AVERAGE')
    const arima = result.find((r) => r.tier === 'ARIMA')

    expect(avg!.sampleSize).toBe(0)
    expect(avg!.maeDays).toBeNull()
    expect(arima!.sampleSize).toBe(0)
    expect(arima!.maeDays).toBeNull()
  })

  it('empty input → both tiers have null maeDays and sampleSize 0', () => {
    const result = computePredictionMaeByTier([])

    expect(result).toHaveLength(2)
    for (const row of result) {
      expect(row.maeDays).toBeNull()
      expect(row.sampleSize).toBe(0)
    }
  })

  it('result always contains exactly AVERAGE and ARIMA rows', () => {
    const result = computePredictionMaeByTier([])
    const tiers = result.map((r) => r.tier).sort()
    expect(tiers).toEqual(['ARIMA', 'AVERAGE'])
  })
})
