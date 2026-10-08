'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { LANDING_CONTAINER, LANDING_SECTION } from './layout';
import { RevealOnScroll } from '@/components/motion/RevealOnScroll';
import { Button } from '@/components/ui/Button';

export function CTASection() {
  const { t } = useTranslation();

  return (
    <section className={LANDING_SECTION}>
      <div className={LANDING_CONTAINER}>
        <RevealOnScroll y={32}>
          <div className="bg-[var(--color-action)] rounded-[var(--radius-xl)] shadow-glow p-10 md:p-14 flex flex-col items-center text-center gap-6">
            <h2 className="text-fluid-lg font-bold text-[var(--color-on-action)]">
              {t('landing.finalCtaTitle')}
            </h2>
            <p className="text-fluid-md text-[var(--color-on-action)] max-w-md leading-relaxed">
              {t('landing.finalCtaSubtitle')}
            </p>
            <Link href="/get-started">
              <Button
                variant="secondary"
                size="lg"
                className="font-bold min-w-[180px] bg-[var(--color-bg-card)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-primary)] border-0 shadow-soft"
              >
                {t('landing.ctaPrimary')}
              </Button>
            </Link>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
