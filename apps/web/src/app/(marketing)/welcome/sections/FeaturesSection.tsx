'use client';

import { useTranslation } from 'react-i18next';
import { CalendarHeart, Sparkles, ShieldCheck, Users } from 'lucide-react';
import { LANDING_CONTAINER, LANDING_SECTION } from './landing-layout';
import { RevealOnScroll } from '@/components/motion/RevealOnScroll';

const FEATURES = [
  { key: 'tracking' as const, icon: CalendarHeart, color: 'var(--color-menstrual)' },
  { key: 'predictions' as const, icon: Sparkles, color: 'var(--color-gold-ink)' },
  { key: 'privacy' as const, icon: ShieldCheck, color: 'var(--color-primary)' },
  { key: 'profiles' as const, icon: Users, color: 'var(--color-luteal)' },
] as const;

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
        </RevealOnScroll>

        {/* Ruled two-column list: the content carries the section, not a card grid. */}
        <ul className="grid grid-cols-1 md:grid-cols-2 md:gap-x-12">
          {FEATURES.map(({ key, icon: Icon, color }) => (
            <li key={key} className="border-t border-[var(--color-border)] py-6">
              <RevealOnScroll>
                <h3 className="flex items-center gap-2.5 text-fluid-md font-bold text-[var(--color-text-primary)] mb-2">
                  <Icon size={20} strokeWidth={2} aria-hidden="true" style={{ color }} className="shrink-0" />
                  {t(`landing.features.${key}.title`)}
                </h3>
                <p className="text-[var(--color-text-secondary)] leading-relaxed max-w-[48ch]">
                  {t(`landing.features.${key}.body`)}
                </p>
              </RevealOnScroll>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
