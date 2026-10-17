'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { SplitWords } from '@/components/motion/SplitWords';
import { useHasMounted } from '@/components/motion/useHasMounted';
import { Button } from '@/components/ui/Button';
import { BrandLogo } from '@/components/ui/BrandLogo';

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function HeroSection() {
  const { t } = useTranslation();
  // Gate the reduced-motion value on mount so the server and the first client render
  // agree (both render the animated version); avoids a hydration mismatch for
  // reduced-motion users. After mount, looping/entrance motion is suppressed.
  const reduceRaw = useReducedMotion();
  const mounted = useHasMounted();
  const prefersReducedMotion = mounted && reduceRaw;

  return (
    <section
      className="relative flex flex-col items-center justify-center px-4 pt-20 pb-8 md:pt-28 md:pb-12 text-center md:text-left"
      aria-label={t('app.name')}
    >
      <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center md:items-start gap-6">
        {/* Full circular logo */}
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.8 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <BrandLogo size={128} className="h-24 w-24 sm:h-32 sm:w-32" />
        </motion.div>

        {/* Hero headline — split-word staggered animation */}
        {/* Solid high-contrast headline. Note: a gradient bg-clip-text fill cannot be
            used here — the per-word entrance animation applies a `transform`, and
            `background-clip: text` renders as a filled box on transformed elements.
            The brand gradient lives on the CTA button and closing panel instead. */}
        <h1 className="text-fluid-2xl font-bold text-[var(--color-text-primary)] text-balance max-w-[14ch]">
          <SplitWords
            text={t('landing.heroTitle')}
            startDelay={0.2}
            staggerDelay={0.07}
          />
        </h1>

        {/* Subtitle — fade in after headline */}
        <motion.p
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.55, ease: EASE }}
          className="text-fluid-md text-[var(--color-text-secondary)] max-w-xl leading-relaxed"
        >
          {t('landing.heroSubtitle')}
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.72, ease: EASE }}
          className="flex flex-col sm:flex-row items-center gap-3 mt-2"
        >
          <Link href="/get-started">
            <Button variant="primary" size="lg" className="font-bold min-w-[160px]">
              {t('landing.ctaPrimary')}
            </Button>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-7 py-3.5 text-lg font-semibold rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] min-w-[160px]"
          >
            {t('landing.ctaSecondary')}
          </Link>
        </motion.div>
      </div>

    </section>
  );
}
