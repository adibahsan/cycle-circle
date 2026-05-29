import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/app/queries/auth-queries'
import { getProfiles } from '@/app/queries/profile-queries'
import { getDashboardData } from '@/app/queries/tracking-queries'
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
  const profileId = params.profileId || profiles[0].id
  const dashboardData = await getDashboardData(profileId)

  return (
    <DashboardClient
      profiles={profiles}
      user={user}
      activeProfileId={profileId}
      dashboardData={dashboardData}
    />
  )
}
