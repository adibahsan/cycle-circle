import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/app/queries/auth-queries'
import { getProfiles, getActiveProfileId } from '@/app/queries/profile-queries'
import { getDashboardData, getEngagementSummary } from '@/app/queries/tracking-queries'
import { getProfileCompletionStatus } from '@vesta/shared/server/services'
import { DashboardClient } from './DashboardClient'

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
    />
  )
}
