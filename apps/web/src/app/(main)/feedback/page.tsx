import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/app/queries/auth-queries'
import { listUserFeedback } from '@vesta/shared/server/services'
import { FeedbackClient } from './FeedbackClient'

export default async function FeedbackPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const feedbackHistory = await listUserFeedback(user.id)

  return <FeedbackClient user={user} feedbackHistory={feedbackHistory} />
}
