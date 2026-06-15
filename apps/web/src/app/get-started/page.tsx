import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/queries/auth-queries';
import { getProfiles } from '@/app/queries/profile-queries';
import { GetStartedClient } from './GetStartedClient';

export default async function GetStartedPage() {
  const user = await getCurrentUser();
  if (user) {
    const profiles = await getProfiles();
    redirect(profiles.length > 0 ? '/dashboard' : '/onboarding');
  }
  return <GetStartedClient />;
}
