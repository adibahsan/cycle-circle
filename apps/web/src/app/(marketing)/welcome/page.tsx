import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/app/queries/auth-queries';
import { getProfiles } from '@/app/queries/profile-queries';
import { getProPrice } from '@/app/queries/pro-price-queries';
import { LandingClient } from './LandingClient';

export default async function WelcomePage() {
  const user = await getCurrentUser();
  if (user) {
    const profiles = await getProfiles();
    redirect(profiles.length > 0 ? '/dashboard' : '/onboarding');
  }
  return <LandingClient price={await getProPrice()} />;
}
