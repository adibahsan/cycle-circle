'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { LANDING_CONTAINER, LANDING_SECTION } from './landing-layout';
import { RevealOnScroll } from '@/components/motion/RevealOnScroll';
import { GUIDE_STEPS } from '@/lib/guide-steps';

export function HowItWorksSection() {
  const { t } = useTranslation();

  return (
    <section className={LANDING_SECTION} aria-labelledby="how-heading">
      <div className={LANDING_CONTAINER}>
        <RevealOnScroll className="mb-10 md:mb-12">
          <h2
            id="how-heading"
            className="text-fluid-lg font-bold text-[var(--color-text-primary)] max-w-xl text-balance"
          >
            {t('landing.how.title')}
          </h2>
        </RevealOnScroll>

        <ol className="grid grid-cols-1 md:grid-cols-2 md:gap-x-12 list-none p-0 m-0">
          {GUIDE_STEPS.map(({ key, icon: Icon }) => (
            <li key={key} className="border-t border-[var(--color-border)] py-6">
              <RevealOnScroll>
                <h3 className="flex items-center gap-2.5 text-fluid-md font-bold text-[var(--color-text-primary)] mb-2">
                  <Icon size={20} strokeWidth={2} aria-hidden="true" className="shrink-0 text-[var(--color-primary)]" />
                  {t(`landing.how.steps.${key}.title`)}
                </h3>
                <p className="text-[var(--color-text-secondary)] leading-relaxed max-w-[48ch]">
                  {t(`landing.how.steps.${key}.body`)}
                </p>
              </RevealOnScroll>
            </li>
          ))}
        </ol>

        <p className="mt-6 border-t border-[var(--color-border)] pt-6">
          <Link
            href="/guide"
            className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-primary)] hover:text-[var(--color-text-primary)] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] rounded"
          >
            {t('landing.how.guideLink')}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </p>
      </div>
    </section>
  );
}
