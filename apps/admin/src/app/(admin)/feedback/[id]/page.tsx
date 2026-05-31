import { notFound } from 'next/navigation'
import { getFeedbackDetail } from '@/app/queries/feedback-queries'
import { FeedbackDetailClient } from './FeedbackDetailClient'

export default async function FeedbackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const feedback = await getFeedbackDetail(id)
  if (!feedback) notFound()
  return <FeedbackDetailClient feedback={feedback} />
}
