import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/app/queries/auth-queries'
import { getProfiles } from '@/app/queries/profile-queries'
import { bangladeshToday } from '@vesta/shared/utils/dhaka-date'
import { ProfilesClient } from './ProfilesClient'

export default async function ProfilesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profiles = await getProfiles()
  return <ProfilesClient profiles={profiles} today={bangladeshToday()} />
}
