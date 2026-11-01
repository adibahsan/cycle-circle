import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/app/queries/auth-queries'
import { getPublishedArticles, getPublishedCategories } from '@/app/queries/content-queries'
import { getProfiles, getActiveProfileId } from '@/app/queries/profile-queries'
import { getDashboardData } from '@/app/queries/tracking-queries'
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

  const [{ articles }, categories, profiles] = await Promise.all([
    getPublishedArticles(phase),
    getPublishedCategories(),
    getProfiles(),
  ])

  let currentPhase: string | null = null
  if (profiles.length > 0) {
    const profileId = await getActiveProfileId(profiles, params.profileId)
    const dashboard = await getDashboardData(profileId)
    currentPhase = dashboard?.currentPhase ? dashboard.currentPhase.toUpperCase() : null
  }

  return <ContentClient articles={articles} categories={categories} activePhase={phase} currentPhase={currentPhase} />
}
