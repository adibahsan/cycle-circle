import { recordSignedInActivity } from '@/app/queries/activity-queries'

// Onboarding sits outside (main), and a profile-less user is redirected here before the
// (main) layout's recording can be relied on, so it records the day's activity itself.
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await recordSignedInActivity()
  return children
}
