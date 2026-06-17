import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/app/queries/auth-queries'
import { getProfiles, getActiveProfileId } from '@/app/queries/profile-queries'
import { getSymptomLogs } from '@/app/queries/symptom-queries'
import { SymptomsClient } from './SymptomsClient'

export default async function SymptomsPage({
  searchParams,
}: {
  searchParams: Promise<{ profileId?: string; date?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profiles = await getProfiles()
  if (profiles.length === 0) redirect('/onboarding')

  const params = await searchParams
  const profileId = await getActiveProfileId(profiles, params.profileId)
  const today = new Date().toISOString().slice(0, 10)
  const date = params.date || today
  const symptomLogs = await getSymptomLogs(profileId, date)

  const activeProfile = profiles.find((p) => p.id === profileId) ?? profiles[0]

  return (
    <SymptomsClient
      profiles={profiles}
      activeProfileId={profileId}
      date={date}
      symptomLogs={symptomLogs}
      goal={activeProfile?.goal ?? null}
    />
  )
}
