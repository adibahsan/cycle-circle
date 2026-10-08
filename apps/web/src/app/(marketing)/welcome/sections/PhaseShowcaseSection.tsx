'use client';

import { useTranslation } from 'react-i18next';
import { LANDING_CONTAINER, LANDING_SECTION } from './layout';
import { RevealOnScroll } from '@/components/motion/RevealOnScroll';

const PHASES = [
  { labelKey: 'dashboard.menstrual', colorVar: '--color-menstrual', delay: 0 },
  { labelKey: 'dashboard.follicular', colorVar: '--color-follicular', delay: 0.15 },
  { labelKey: 'dashboard.ovulation', colorVar: '--color-ovulation', delay: 0.3 },
  { labelKey: 'dashboard.luteal', colorVar: '--color-luteal', delay: 0.45 },
] as const;

export function PhaseShowcaseSection() {
  const { t } = useTranslation();

  return (
    <section
      className={LANDING_SECTION}
      aria-labelledby="phases-heading"
    >
      <div className={LANDING_CONTAINER}>
        <RevealOnScroll className="text-center mb-10">
          <h2
            id="phases-heading"
            className="text-fluid-md font-semibold text-[var(--color-text-secondary)]"
          >
            {t('dashboard.cycleOverview')}
          </h2>
        </RevealOnScroll>

        <div className="flex flex-wrap items-center justify-center gap-8">
          {PHASES.map(({ labelKey, colorVar, delay }) => (
            <RevealOnScroll key={labelKey}>
              <div className="flex flex-col items-center gap-3">
                {/* Decorative phase circle */}
                <div
                  aria-hidden="true"
                  className="animate-breathe w-16 h-16 rounded-full shadow-soft"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, var(${colorVar}), color-mix(in srgb, var(${colorVar}) 80%, var(--color-bg-primary)))`,
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
