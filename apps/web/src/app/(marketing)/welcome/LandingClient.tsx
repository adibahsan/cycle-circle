'use client';

import '@vesta/shared/utils/i18n';
import { HeroSection } from './sections/HeroSection';
import { FeaturesSection } from './sections/FeaturesSection';
import { PhaseShowcaseSection } from './sections/PhaseShowcaseSection';
import { SocialProofSection } from './sections/SocialProofSection';
import { CTASection } from './sections/CTASection';
import { LandingFooter } from './sections/LandingFooter';

export function LandingClient() {
  return (
    <main className="relative overflow-hidden">
      <HeroSection />
      <FeaturesSection />
      <PhaseShowcaseSection />
      <SocialProofSection />
      <CTASection />
      <LandingFooter />
    </main>
  );
}
