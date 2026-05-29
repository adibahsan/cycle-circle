import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/app/queries/auth-queries'
import { getProfiles } from '@/app/queries/profile-queries'
import { prisma } from '@vesta/shared'
import { SettingsClient } from './SettingsClient'

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profiles = await getProfiles()

  // Fetch notification prefs for all profiles in one query
  const notifPrefs = await prisma.notificationPreference.findMany({
    where: { profileId: { in: profiles.map(p => p.id) } },
  })

  return <SettingsClient user={user} profiles={profiles} notifPrefs={notifPrefs} />
}
