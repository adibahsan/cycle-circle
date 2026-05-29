export const dynamic = 'force-dynamic'

import { requireAdminUser } from '@/app/queries/auth-queries'
import { getFeedbackList } from '@/app/queries/feedback-queries'
import { FeedbackClient } from './FeedbackClient'

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  await requireAdminUser()
  const params = await searchParams
  const data = await getFeedbackList({
    page: Number(params.page) || 1,
    pageSize: Number(params.pageSize) || 20,
    category: params.category,
    minRating: params.minRating ? Number(params.minRating) : undefined,
  })
  return <FeedbackClient data={data} />
}
