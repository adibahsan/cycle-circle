'use client';

import { useTranslation } from 'react-i18next';
import { CalendarHeart, Sparkles, ShieldCheck, Users } from 'lucide-react';
import { LANDING_CONTAINER, LANDING_SECTION } from './layout';
import { RevealOnScroll } from '@/components/motion/RevealOnScroll';
import { Card } from '@/components/ui/Card';

const FEATURES = [
  {
    key: 'tracking' as const,
    icon: CalendarHeart,
    accentVar: '--color-menstrual',
    fallbackColor: 'var(--color-primary)',
  },
  {
    key: 'predictions' as const,
    icon: Sparkles,
    accentVar: '--color-ovulation',
    fallbackColor: 'var(--color-secondary)',
  },
  {
    key: 'privacy' as const,
    icon: ShieldCheck,
    accentVar: '--color-follicular',
    fallbackColor: 'var(--color-accent)',
  },
  {
    key: 'profiles' as const,
    icon: Users,
    accentVar: '--color-luteal',
    fallbackColor: 'var(--color-secondary)',
  },
] as const;

export function FeaturesSection() {
  const { t } = useTranslation();

  return (
    <section
      className={LANDING_SECTION}
      aria-labelledby="features-heading"
    >
      <div className={LANDING_CONTAINER}>
        <RevealOnScroll className="text-center mb-12">
          <h2
            id="features-heading"
            className="text-fluid-lg font-bold text-[var(--color-text-primary)]"
          >
            {t('landing.featuresTitle')}
          </h2>
        </RevealOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {FEATURES.map(({ key, icon: Icon, accentVar, fallbackColor }) => (
            <RevealOnScroll key={key}>
              <Card hover padding="lg" className="h-full">
                <div className="flex flex-col gap-4">
                  {/* Icon with phase-color accent */}
                  <div
                    className="relative w-11 h-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                  >
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 rounded-xl opacity-15"
                      style={{ background: `var(${accentVar}, ${fallbackColor})` }}
                    />
                    <Icon
                      size={22}
                      aria-hidden="true"
                      style={{ color: `var(${accentVar}, ${fallbackColor})` }}
                    />
                  </div>

                  <div>
                    <h3 className="text-fluid-md font-bold text-[var(--color-text-primary)] mb-1.5">
                      {t(`landing.features.${key}.title`)}
                    </h3>
                    <p className="text-[var(--color-text-secondary)] leading-relaxed">
                      {t(`landing.features.${key}.body`)}
                    </p>
                  </div>
                </div>
              </Card>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
