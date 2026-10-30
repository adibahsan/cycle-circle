import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/app/queries/auth-queries'
import { getProfiles, getActiveProfileId } from '@/app/queries/profile-queries'
import { getCalendarData, getPeriodLogs } from '@/app/queries/tracking-queries'
import { getSymptomLogs } from '@/app/queries/symptom-queries'
import { bangladeshToday } from '@vesta/shared/utils/dhaka-date'
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
  const today = bangladeshToday()
  const month = params.month || today.slice(0, 7)

  // Fertile windows can straddle a month boundary, so the "This Cycle" panel
  // picks its window from the previous, visible and next months together.
  const [y, m] = month.split('-').map(Number)
  const adjacent = (offset: number) => {
    const d = new Date(y, m - 1 + offset, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  const [calendarDays, prevDays, nextDays, symptomLogs, periodLogs] = await Promise.all([
    getCalendarData(profileId, month),
    getCalendarData(profileId, adjacent(-1)),
    getCalendarData(profileId, adjacent(1)),
    getSymptomLogs(profileId),
    getPeriodLogs(profileId),
  ])

  const activeProfile = profiles.find((p) => p.id === profileId) ?? profiles[0]

  return (
    <CalendarClient
      profiles={profiles}
      activeProfileId={profileId}
      month={month}
      today={today}
      days={calendarDays}
      windowDays={[...(prevDays ?? []), ...(calendarDays ?? []), ...(nextDays ?? [])]}
      symptomLogs={symptomLogs}
      periodLogs={periodLogs}
      goal={activeProfile?.goal ?? null}
    />
  )
}
