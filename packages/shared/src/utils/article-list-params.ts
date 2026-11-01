/**
 * Admin article list: the typed filter/sort options and the ONE place URL search params are parsed
 * into them. Later tickets extend the unions/fields here (bulk actions, "scheduled" status, sort by
 * views) and the parser, nothing else.
 */

import { parseDhakaDay } from './dhaka-date'

export const ARTICLE_STATUS_FILTERS = ['DRAFT', 'PUBLISHED', 'scheduled', 'ARCHIVED'] as const
export type ArticleStatusFilter = (typeof ARTICLE_STATUS_FILTERS)[number]

export const ARTICLE_PHASES = ['MENSTRUAL', 'FOLLICULAR', 'OVULATION', 'LUTEAL'] as const
export type ArticlePhase = (typeof ARTICLE_PHASES)[number]

export const ARTICLE_SORTS = ['newest', 'title', 'views'] as const
export type ArticleSort = (typeof ARTICLE_SORTS)[number]

export const ARTICLE_SORT_DIRS = ['asc', 'desc'] as const
export type ArticleSortDir = (typeof ARTICLE_SORT_DIRS)[number]

export const ARTICLE_DEFAULT_PAGE_SIZE = 20
export const ARTICLE_MAX_PAGE_SIZE = 100
/** `categoryId` value meaning "articles with no category". */
export const ARTICLE_NO_CATEGORY = 'none'

/** Everything the list can be narrowed or ordered by. Absent key = no restriction. */
export interface ListArticlesOptions {
  /** Case-insensitive substring of the English or Bangla title. */
  q?: string
  status?: ArticleStatusFilter
  /** A category id, or `ARTICLE_NO_CATEGORY`. */
  categoryId?: string
  phase?: ArticlePhase
  /** Bangla title or body missing. */
  missingBangla?: boolean
  sort?: ArticleSort
  /** Direction of the views sort: desc (most read first, default) or asc (least read first). */
  sortDir?: ArticleSortDir
  /** Bangladesh days (`YYYY-MM-DD`, inclusive) that the views count and views sort cover. Absent = all time. */
  viewsFrom?: string
  viewsTo?: string
  page?: number
  pageSize?: number
}

/** A real `YYYY-MM-DD` day, else undefined. */
function validDay(v: unknown): string | undefined {
  return typeof v === 'string' && parseDhakaDay(v) && v.length === 10 ? v : undefined
}

const isOneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (list as readonly string[]).includes(v)

/** Clamp to a whole number in [1, max]; junk falls back to `fallback`. */
export function clampInt(v: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  if (n < 1) return fallback
  return Math.min(max, Math.floor(n))
}

/** Normalise paging + enum fields on any caller-supplied options (URL or direct). */
export function normalizeListOptions(o: ListArticlesOptions = {}) {
  return {
    q: typeof o.q === 'string' && o.q.trim() ? o.q.trim() : undefined,
    status: isOneOf(ARTICLE_STATUS_FILTERS, o.status) ? o.status : undefined,
    categoryId: o.categoryId && o.categoryId !== 'all' ? o.categoryId : undefined,
    phase: isOneOf(ARTICLE_PHASES, o.phase) ? o.phase : undefined,
    missingBangla: o.missingBangla === true,
    sort: isOneOf(ARTICLE_SORTS, o.sort) ? o.sort : ('newest' as ArticleSort),
    sortDir: o.sortDir === 'asc' ? ('asc' as ArticleSortDir) : ('desc' as ArticleSortDir),
    viewsFrom: validDay(o.viewsFrom),
    viewsTo: validDay(o.viewsTo),
    page: clampInt(o.page, 1),
    pageSize: clampInt(o.pageSize, ARTICLE_DEFAULT_PAGE_SIZE, ARTICLE_MAX_PAGE_SIZE),
  }
}

type RawParams = Record<string, string | string[] | undefined>

/** Parse admin `/content` search params. Junk is dropped; only meaningful keys are returned. */
export function parseArticleListParams(raw: RawParams): ListArticlesOptions {
  const first = (k: string) => (Array.isArray(raw[k]) ? raw[k]![0] : (raw[k] as string | undefined))
  const out: ListArticlesOptions = {}
  const q = first('q')?.trim()
  if (q) out.q = q
  const status = first('status')
  if (isOneOf(ARTICLE_STATUS_FILTERS, status)) out.status = status
  const categoryId = first('categoryId')
  if (categoryId && categoryId !== 'all') out.categoryId = categoryId
  const phase = first('phase')
  if (isOneOf(ARTICLE_PHASES, phase)) out.phase = phase
  if (first('missingBangla') === '1') out.missingBangla = true
  const sort = first('sort')
  if (isOneOf(ARTICLE_SORTS, sort)) out.sort = sort
  const sortDir = first('sortDir')
  if (isOneOf(ARTICLE_SORT_DIRS, sortDir)) out.sortDir = sortDir
  const viewsFrom = validDay(first('viewsFrom'))
  if (viewsFrom) out.viewsFrom = viewsFrom
  const viewsTo = validDay(first('viewsTo'))
  if (viewsTo) out.viewsTo = viewsTo
  out.page = clampInt(first('page'), 1)
  out.pageSize = clampInt(first('pageSize'), ARTICLE_DEFAULT_PAGE_SIZE, ARTICLE_MAX_PAGE_SIZE)
  return out
}
