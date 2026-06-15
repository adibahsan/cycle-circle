'use client';

import { useTranslation } from 'react-i18next';
import { RevealOnScroll } from '@/components/motion/RevealOnScroll';

const PHASES = [
  { labelKey: 'dashboard.menstrual', colorVar: '--color-menstrual', fallback: '#E8476C', delay: 0 },
  { labelKey: 'dashboard.follicular', colorVar: '--color-follicular', fallback: '#9B7FD4', delay: 0.15 },
  { labelKey: 'dashboard.ovulation', colorVar: '--color-ovulation', fallback: '#FF8C6B', delay: 0.3 },
  { labelKey: 'dashboard.luteal', colorVar: '--color-luteal', fallback: '#9B7FD4', delay: 0.45 },
] as const;

export function PhaseShowcaseSection() {
  const { t } = useTranslation();

  return (
    <section
      className="relative py-16 px-4"
      aria-labelledby="phases-heading"
    >
      <div className="max-w-3xl mx-auto">
        <RevealOnScroll className="text-center mb-10">
          <h2
            id="phases-heading"
            className="text-fluid-md font-semibold text-[var(--color-text-secondary)]"
          >
            {t('dashboard.cycleOverview')}
          </h2>
        </RevealOnScroll>

        <div className="flex flex-wrap items-center justify-center gap-8">
          {PHASES.map(({ labelKey, colorVar, fallback, delay }) => (
            <RevealOnScroll key={labelKey} delay={delay}>
              <div className="flex flex-col items-center gap-3">
                {/* Decorative phase circle */}
                <div
                  aria-hidden="true"
                  className="animate-breathe w-16 h-16 rounded-full shadow-soft"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, var(${colorVar}, ${fallback}), var(${colorVar}, ${fallback}))`,
                    opacity: 0.85,
                    animationDelay: `${delay}s`,
                  }}
                />
                {/* Phase label */}
                <span className="text-sm font-medium text-[var(--color-text-secondary)] capitalize">
                  {t(labelKey)}
                </span>
              </div>
            </RevealOnScroll>
          ))}
        </div>

        {/* Connecting line decoration (desktop) */}
        <div aria-hidden="true" className="hidden md:block mt-6 mx-auto max-w-sm">
          <div className="h-px bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" />
        </div>
      </div>
    </section>
  );
}
