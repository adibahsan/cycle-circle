import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/app/queries/auth-queries'
import { getProfiles, getActiveProfileId } from '@/app/queries/profile-queries'
import {
  getCycleLengthTrend,
  getSymptomFrequency,
  getPeriodRegularity,
  getFertileWindowHistory,
} from '@/app/queries/insights-queries'
import { InsightsClient } from './InsightsClient'

export default async function InsightsPage({
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

  const [cycleLengthTrend, symptomFrequency, periodRegularity, fertileWindowHistory] =
    await Promise.all([
      getCycleLengthTrend(profileId),
      getSymptomFrequency(profileId),
      getPeriodRegularity(profileId),
      getFertileWindowHistory(profileId),
    ])

  const activeProfile = profiles.find((p) => p.id === profileId) ?? profiles[0]

  return (
    <InsightsClient
      profiles={profiles}
      activeProfileId={profileId}
      cycleLengthTrend={cycleLengthTrend}
      symptomFrequency={symptomFrequency}
      periodRegularity={periodRegularity}
      fertileWindowHistory={fertileWindowHistory}
      goal={activeProfile?.goal ?? null}
    />
  )
}
