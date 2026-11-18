'use client';

import { useTranslation } from 'react-i18next';
import { LANDING_CONTAINER, LANDING_SECTION } from './landing-layout';
import { RevealOnScroll } from '@/components/motion/RevealOnScroll';
import { COMPARISON_FEATURE_KEYS } from '@/lib/plan-features';

const TAG_BASE = 'shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold';
const TAG_FREE = `${TAG_BASE} border-[var(--color-primary)] text-[var(--color-primary)]`;
const TAG_PRO = `${TAG_BASE} border-[var(--color-gold-ink)] text-[var(--color-gold-ink)]`;

export function FeaturesSection() {
  const { t } = useTranslation();

  return (
    <section
      className={LANDING_SECTION}
      aria-labelledby="features-heading"
    >
      <div className={LANDING_CONTAINER}>
        <RevealOnScroll className="mb-10 md:mb-12">
          <h2
            id="features-heading"
            className="text-fluid-lg font-bold text-[var(--color-text-primary)] max-w-xl text-balance"
          >
            {t('landing.featuresTitle')}
          </h2>
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{t('landing.featuresPlanNote')}</p>
        </RevealOnScroll>

        {/* Ruled two-column list: every feature, tagged with the plan it starts in. */}
        <ul className="grid grid-cols-1 md:grid-cols-2 md:gap-x-12">
          {COMPARISON_FEATURE_KEYS.map(({ key, labelKey, free }) => (
            <li key={key} className="border-t border-[var(--color-border)] py-4">
              <RevealOnScroll className="flex items-center justify-between gap-3">
                <span className="font-semibold text-[var(--color-text-primary)]">{t(labelKey)}</span>
                <span className={free ? TAG_FREE : TAG_PRO}>{free ? t('subscription.free') : t('subscription.pro')}</span>
              </RevealOnScroll>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
