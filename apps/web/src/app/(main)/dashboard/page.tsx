import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/app/queries/auth-queries'
import { getProfiles, getActiveProfileId } from '@/app/queries/profile-queries'
import { getDashboardData, getEngagementSummary } from '@/app/queries/tracking-queries'
import { getPublishedArticles } from '@/app/queries/content-queries'
import { getProfileCompletionStatus } from '@vesta/shared/server/services'
import { normalizeCyclePhase } from '@vesta/shared/utils/cycle-utils'
import { DashboardClient } from './DashboardClient'
import type { PhaseArticle } from './DashboardToolkit'

/** "Read for your phase": published articles tagged with the current phase (standard mode only). */
async function articlesForPhase(phase: string | null): Promise<PhaseArticle[]> {
  if (!phase) return []
  const { articles } = await getPublishedArticles(normalizeCyclePhase(phase).toUpperCase())
  return articles.map((a) => ({ id: a.id, titleEn: a.titleEn, titleBn: a.titleBn ?? null }))
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ profileId?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profiles = await getProfiles()
  if (profiles.length === 0) redirect('/onboarding')

  const params = await searchParams
  const profileId = await getActiveProfileId(profiles, params.profileId)

  const [dashboardData, completion, engagement] = await Promise.all([
    getDashboardData(profileId),
    getProfileCompletionStatus(user.id, profileId),
    getEngagementSummary(profileId),
  ])

  const phaseArticles = await articlesForPhase(
    dashboardData?.mode === 'standard' ? dashboardData.currentPhase : null,
  )

  const activeProfile = profiles.find((p) => p.id === profileId) ?? profiles[0]

  return (
    <DashboardClient
      profiles={profiles}
      user={user}
      activeProfileId={profileId}
      dashboardData={dashboardData}
      completion={completion}
      lastSymptomLogDate={dashboardData?.lastSymptomLogDate ?? null}
      goal={activeProfile?.goal ?? null}
      engagement={engagement}
      phaseArticles={phaseArticles}
    />
  )
}
