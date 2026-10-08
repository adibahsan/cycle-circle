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
      className="relative min-h-dvh flex flex-col items-center justify-center px-4 py-24 text-center"
      aria-label={t('app.name')}
    >
      {/* Dot-grid pattern */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle, var(--color-text-primary) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center gap-6">
        {/* Full circular logo */}
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.8 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <BrandLogo size={160} className="h-32 w-32 sm:h-40 sm:w-40" />
        </motion.div>

        {/* Hero headline — split-word staggered animation */}
        {/* Solid high-contrast headline. Note: a gradient bg-clip-text fill cannot be
            used here — the per-word entrance animation applies a `transform`, and
            `background-clip: text` renders as a filled box on transformed elements.
            The brand gradient lives on the CTA button and closing panel instead. */}
        <h1 className="text-fluid-2xl font-bold text-[var(--color-text-primary)]">
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

      {/* Scroll indicator */}
      <motion.div
        initial={prefersReducedMotion ? undefined : { opacity: 0 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        aria-hidden="true"
      >
        <motion.div
          animate={prefersReducedMotion ? undefined : { y: [0, 6, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="w-5 h-8 rounded-full border-2 border-[var(--color-border)] flex items-start justify-center pt-1.5"
        >
          <div className="w-1 h-2 rounded-full bg-[var(--goal-accent)] opacity-70" />
        </motion.div>
      </motion.div>
    </section>
  );
}
