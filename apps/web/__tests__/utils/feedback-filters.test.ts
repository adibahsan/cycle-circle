import { describe, it, expect } from 'vitest'
import {
  feedbackFiltersFromParams,
  ratingFilterFromValue,
  ratingFilterToValue,
  ratingFilterToParams,
  toFeedbackQuery,
} from '@vesta/shared/utils/feedback-filters'

const src = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null })

describe('feedback filters', () => {
  it('reads URL params, exact rating wins, invalid values are dropped', () => {
    expect(feedbackFiltersFromParams(src({ rating: '4', minRating: '2', category: 'BUG', q: ' hi ' }))).toEqual({
      category: 'BUG',
      rating: { mode: 'eq', stars: 4 },
      search: 'hi',
      dateFrom: undefined,
      dateTo: undefined,
    })
    expect(feedbackFiltersFromParams(src({ minRating: '9', category: 'all' }))).toMatchObject({
      category: undefined,
      rating: undefined,
    })
  })

  it('rating select value and URL params round-trip', () => {
    const r = ratingFilterFromValue('min-3')
    expect(r).toEqual({ mode: 'min', stars: 3 })
    expect(ratingFilterToValue(r)).toBe('min-3')
    expect(ratingFilterToParams(r)).toEqual({ rating: '', minRating: '3' })
    expect(ratingFilterToParams(ratingFilterFromValue('eq-5'))).toEqual({ rating: '5', minRating: '' })
    expect(ratingFilterFromValue('all')).toBeUndefined()
    expect(ratingFilterToValue(undefined)).toBe('all')
  })

  it('builds the service query with Dhaka day bounds', () => {
    const q = toFeedbackQuery({ rating: { mode: 'min', stars: 4 }, dateFrom: '2026-03-10', dateTo: '2026-03-10' })
    expect(q).toMatchObject({ rating: undefined, minRating: 4 })
    expect(q.dateFrom?.toISOString()).toBe('2026-03-09T18:00:00.000Z')
    expect(q.dateTo?.toISOString()).toBe('2026-03-10T17:59:59.999Z')
  })
})
