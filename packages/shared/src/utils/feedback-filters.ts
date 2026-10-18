// Client-safe (no server imports): admin feedback filters shared by the page, client and CSV export.
import { parseDhakaDay } from './dhaka-date'

/** At least `stars` (`min`) or exactly `stars` (`eq`). */
export type RatingFilter = { mode: 'min' | 'eq'; stars: number }

/** Filters as they live in the URL: dates are `YYYY-MM-DD` Asia/Dhaka days. */
export type FeedbackFilters = {
  category?: string
  rating?: RatingFilter
  search?: string
  dateFrom?: string
  dateTo?: string
}

type ParamSource = { get(key: string): string | null | undefined }

const STARS = /^[1-5]$/

/** URL params for a rating filter: `rating=N` (exact) or `minRating=N` (at least). */
export function ratingFilterToParams(r: RatingFilter | undefined): { rating: string; minRating: string } {
  return {
    rating: r?.mode === 'eq' ? String(r.stars) : '',
    minRating: r?.mode === 'min' ? String(r.stars) : '',
  }
}

/** Opaque `<select>` value for a rating filter (`all` for none). Round-trips with `ratingFilterFromValue`. */
export function ratingFilterToValue(r: RatingFilter | undefined): string {
  return r ? `${r.mode}-${r.stars}` : 'all'
}

export function ratingFilterFromValue(value: string): RatingFilter | undefined {
  const [mode, stars] = value.split('-')
  if ((mode !== 'min' && mode !== 'eq') || !STARS.test(stars ?? '')) return undefined
  return { mode, stars: Number(stars) }
}

/** Read the filters out of URL search params; invalid values are dropped. Exact rating wins over at-least. */
export function feedbackFiltersFromParams(p: ParamSource): FeedbackFilters {
  const exact = p.get('rating')
  const atLeast = p.get('minRating')
  const rating: RatingFilter | undefined =
    exact && STARS.test(exact)
      ? { mode: 'eq', stars: Number(exact) }
      : atLeast && STARS.test(atLeast)
        ? { mode: 'min', stars: Number(atLeast) }
        : undefined
  const category = p.get('category')
  return {
    category: category && category !== 'all' ? category : undefined,
    rating,
    search: p.get('q')?.trim() || undefined,
    dateFrom: p.get('dateFrom') || undefined,
    dateTo: p.get('dateTo') || undefined,
  }
}

/** The service query for these filters (dates become inclusive Asia/Dhaka day bounds). */
export function toFeedbackQuery(f: FeedbackFilters) {
  return {
    category: f.category,
    rating: f.rating?.mode === 'eq' ? f.rating.stars : undefined,
    minRating: f.rating?.mode === 'min' ? f.rating.stars : undefined,
    search: f.search,
    dateFrom: parseDhakaDay(f.dateFrom),
    dateTo: parseDhakaDay(f.dateTo, true),
  }
}
