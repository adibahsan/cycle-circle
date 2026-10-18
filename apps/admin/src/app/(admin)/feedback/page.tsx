import { requireAdminUser } from '@/app/queries/auth-queries'
import {
  getFeedbackList,
  getFeedbackVolume,
  getFeedbackCategories,
  getFeedbackRatings,
} from '@/app/queries/feedback-queries'
import { FeedbackClient } from './FeedbackClient'

const RANGE_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
}

/** `YYYY-MM-DD` from the date inputs; dateTo covers the whole day (UTC). */
function parseDate(value: string | undefined, endOfDay = false): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const d = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
  return Number.isNaN(d.getTime()) ? undefined : d
}

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  await requireAdminUser()
  const params = await searchParams
  const range = params.range && RANGE_DAYS[params.range] ? params.range : '30d'
  const days = RANGE_DAYS[range]

  const [data, volume, categories, ratings] = await Promise.all([
    getFeedbackList({
      page: Number(params.page) || 1,
      pageSize: Number(params.pageSize) || 20,
      category: params.category,
      rating: params.rating ? Number(params.rating) : undefined,
      minRating: params.minRating ? Number(params.minRating) : undefined,
      search: params.q?.trim() || undefined,
      dateFrom: parseDate(params.dateFrom),
      dateTo: parseDate(params.dateTo, true),
    }),
    getFeedbackVolume(days),
    getFeedbackCategories(days),
    getFeedbackRatings(days),
  ])

  return (
    <FeedbackClient
      data={data}
      range={range}
      volumeData={volume}
      categoryData={categories}
      ratingData={ratings}
    />
  )
}
