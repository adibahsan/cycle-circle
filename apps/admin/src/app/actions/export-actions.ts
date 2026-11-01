'use server'

import { requireAdminAuth } from '@vesta/shared/server/auth'
import { toFeedbackQuery, type FeedbackFilters } from '@vesta/shared/utils/feedback-filters'
import { parseDateRange } from '@vesta/shared/utils/date-range'
import { generateFeedbackCsv, generateTableCsv, generateUsersCsv } from '@vesta/shared/server/services'

export async function exportFeedbackCsv(filters: FeedbackFilters = {}) {
  const jwt = await requireAdminAuth()
  return generateFeedbackCsv(jwt.sub, toFeedbackQuery(filters))
}

const USER_STATUSES = ['all', 'active', 'suspended', 'deleted'] as const

export async function exportUsersCsv(filters: { search?: string; status?: string } = {}) {
  const jwt = await requireAdminAuth()
  const status = USER_STATUSES.find((s) => s === filters.status)
  return generateUsersCsv(jwt.sub, { search: filters.search, status })
}

const EXPORTABLE_TABLES = ['subscriptions', 'sms-campaigns', 'emails'] as const

/**
 * CSV of a dashboard table for the page's shared range (`range` or `from`/`to` in `params`),
 * with the same filters the page shows. The server re-parses the range, so the client only
 * forwards the URL params.
 */
export async function exportTableCsv(
  table: string,
  params: Record<string, string> = {},
): Promise<{ csv: string; rangeKey: string }> {
  const jwt = await requireAdminAuth()
  const wanted = EXPORTABLE_TABLES.find((t) => t === table)
  if (!wanted) throw new Error('Unknown table')
  const range = parseDateRange(params, new Date())
  const csv = await generateTableCsv(jwt.sub, wanted, {
    range,
    status: params.status,
    search: params.search,
    q: params.q,
    type: params.type,
    deliveryStatus: params.deliveryStatus,
  })
  return { csv, rangeKey: range.key }
}
