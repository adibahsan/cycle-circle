import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/app/queries/auth-queries'
import { getProfiles } from '@/app/queries/profile-queries'
import { bangladeshToday } from '@vesta/shared/utils/dhaka-date'
import OnboardingClient from './OnboardingClient'

export default async function OnboardingPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const profiles = await getProfiles()
  if (profiles.length > 0) redirect('/dashboard')

  return <OnboardingClient user={{ phone: user.phone ?? null, email: user.email ?? null, fullName: user.fullName ?? null }} today={bangladeshToday()} />
}
