import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/app/queries/auth-queries'
import { getPublishedArticles } from '@/app/queries/content-queries'
import { ContentClient } from './ContentClient'

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const phase = params.phase || undefined
  const { articles } = await getPublishedArticles(phase)

  return <ContentClient articles={articles} activePhase={phase} />
}
