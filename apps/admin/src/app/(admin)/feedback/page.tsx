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
      minRating: params.minRating ? Number(params.minRating) : undefined,
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
