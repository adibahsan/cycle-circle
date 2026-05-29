import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/app/queries/auth-queries'
import { getProfiles } from '@/app/queries/profile-queries'
import { getCalendarData } from '@/app/queries/tracking-queries'
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
  const profileId = params.profileId || profiles[0].id
  const now = new Date()
  const month =
    params.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const calendarDays = await getCalendarData(profileId, month)

  return (
    <CalendarClient
      profiles={profiles}
      activeProfileId={profileId}
      month={month}
      days={calendarDays}
    />
  )
}
