'use client';

import '@vesta/shared/utils/i18n';
import { HeroSection } from './sections/HeroSection';
import { FeaturesSection } from './sections/FeaturesSection';
import { PhaseShowcaseSection } from './sections/PhaseShowcaseSection';
import { HowItWorksSection } from './sections/HowItWorksSection';
import { SubscriptionChargesSection } from './sections/SubscriptionChargesSection';
import { SocialProofSection } from './sections/SocialProofSection';
import { CTASection } from './sections/CTASection';
import { LandingFooter } from './sections/LandingFooter';
import type { CustomerProPrice } from '@/app/queries/pro-price-queries';

export function LandingClient({ price }: { price: CustomerProPrice | null }) {
  return (
    <main className="relative overflow-hidden">
      <HeroSection />
      <FeaturesSection />
      <PhaseShowcaseSection />
      <HowItWorksSection />
      <SubscriptionChargesSection price={price} />
      <SocialProofSection />
      <CTASection />
      <LandingFooter />
    </main>
  );
}
