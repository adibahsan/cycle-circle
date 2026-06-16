import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/app/queries/auth-queries'
import { getProfiles, getActiveProfileId } from '@/app/queries/profile-queries'
import { getCalendarData, getPeriodLogs } from '@/app/queries/tracking-queries'
import { getSymptomLogs } from '@/app/queries/symptom-queries'
import { CalendarClient } from './CalendarClient'

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ profileId?: string; month?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profiles = await getProfiles()
  if (profiles.length === 0) redirect('/onboarding')

  const params = await searchParams
  const profileId = await getActiveProfileId(profiles, params.profileId)
  const now = new Date()
  const month =
    params.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [calendarDays, symptomLogs, periodLogs] = await Promise.all([
    getCalendarData(profileId, month),
    getSymptomLogs(profileId),
    getPeriodLogs(profileId),
  ])

  const activeProfile = profiles.find((p) => p.id === profileId) ?? profiles[0]

  return (
    <CalendarClient
      profiles={profiles}
      activeProfileId={profileId}
      month={month}
      days={calendarDays}
      symptomLogs={symptomLogs}
      periodLogs={periodLogs}
      goal={activeProfile?.goal ?? null}
    />
  )
}
