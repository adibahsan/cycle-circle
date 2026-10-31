import { requireAdminUser } from '@/app/queries/auth-queries'
import {
  getFeedbackList,
  getFeedbackVolume,
  getFeedbackCategories,
  getFeedbackRatings,
} from '@/app/queries/feedback-queries'
import { feedbackFiltersFromParams, toFeedbackQuery } from '@vesta/shared/utils/feedback-filters'
import { parseDateRange } from '@vesta/shared/utils/date-range'
import { FeedbackClient } from './FeedbackClient'

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAdminUser()
  const params = await searchParams
  const range = parseDateRange(params, new Date())
  const one = (k: string) => (typeof params[k] === 'string' ? (params[k] as string) : undefined)

  const [data, volume, categories, ratings] = await Promise.all([
    getFeedbackList({
      page: Number(params.page) || 1,
      pageSize: Number(params.pageSize) || 20,
      ...toFeedbackQuery(feedbackFiltersFromParams({ get: (k) => one(k) })),
    }),
    getFeedbackVolume(range),
    getFeedbackCategories(range),
    getFeedbackRatings(range),
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
