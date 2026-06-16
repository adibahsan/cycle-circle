import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/app/queries/auth-queries'
import { getProfiles } from '@/app/queries/profile-queries'
import { listNotificationPrefs } from '@vesta/shared/server/services'
import { SettingsClient } from './SettingsClient'

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profiles = await getProfiles()

  const notifPrefs = await listNotificationPrefs(profiles.map(p => p.id))

  return (
    <SettingsClient
      user={user}
      profiles={profiles}
      notifPrefs={notifPrefs}
      completionRemindersOptOut={user.profileReminderOptOut}
    />
  )
}
