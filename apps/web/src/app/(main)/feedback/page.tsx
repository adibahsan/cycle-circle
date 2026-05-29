import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/app/queries/auth-queries'
import { prisma } from '@vesta/shared'
import { FeedbackClient } from './FeedbackClient'

export default async function FeedbackPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const feedbackHistory = await prisma.feedback.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return <FeedbackClient user={user} feedbackHistory={feedbackHistory} />
}
