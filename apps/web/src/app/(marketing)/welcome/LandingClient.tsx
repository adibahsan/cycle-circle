'use client';

import '@vesta/shared/utils/i18n';
import { ParallaxBlobs } from '@/components/motion/ParallaxBlobs';
import { HeroSection } from './sections/HeroSection';
import { FeaturesSection } from './sections/FeaturesSection';
import { PhaseShowcaseSection } from './sections/PhaseShowcaseSection';
import { SocialProofSection } from './sections/SocialProofSection';
import { CTASection } from './sections/CTASection';
import { LandingFooter } from './sections/LandingFooter';

export function LandingClient() {
  return (
    <main className="relative overflow-hidden">
      {/* Single shared parallax blob layer behind all sections */}
      <ParallaxBlobs />

      {/* Grain texture overlay */}
      <div className="grain-overlay" aria-hidden="true" />

      <HeroSection />
      <FeaturesSection />
      <PhaseShowcaseSection />
      <SocialProofSection />
      <CTASection />
      <LandingFooter />
    </main>
  );
}
