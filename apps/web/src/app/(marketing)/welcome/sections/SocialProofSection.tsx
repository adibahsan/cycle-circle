'use client';

import { useTranslation } from 'react-i18next';
import { Languages, Lock, MapPin } from 'lucide-react';
import { LANDING_CONTAINER, LANDING_SECTION } from './landing-layout';
import { RevealOnScroll } from '@/components/motion/RevealOnScroll';

const PROOF_ITEMS = [
  { key: 'bilingual' as const, icon: Languages },
  { key: 'encrypted' as const, icon: Lock },
  { key: 'forBd' as const, icon: MapPin },
] as const;

export function SocialProofSection() {
  const { t } = useTranslation();

  return (
    <section
      className={LANDING_SECTION}
      aria-labelledby="proof-heading"
    >
      <div className={LANDING_CONTAINER}>
        <div>
          <h2 id="proof-heading" className="sr-only">
            {t('app.tagline')}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {PROOF_ITEMS.map(({ key, icon: Icon }) => (
              <RevealOnScroll key={key}>
                <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-soft">
                  <Icon
                    size={15}
                    className="text-[var(--color-primary)] shrink-0"
                    aria-hidden="true"
                  />
                  <span className="text-sm font-semibold text-[var(--color-text-primary)] whitespace-nowrap">
                    {t(`landing.proof.${key}`)}
                  </span>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
