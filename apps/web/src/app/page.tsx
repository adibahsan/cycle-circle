import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/app/queries/auth-queries'
import { getProfiles } from '@/app/queries/profile-queries'

export default async function RootPage() {
  const user = await getCurrentUser()

  if (!user) redirect('/welcome')

  const profiles = await getProfiles()
  redirect(profiles.length > 0 ? '/dashboard' : '/onboarding')
}
