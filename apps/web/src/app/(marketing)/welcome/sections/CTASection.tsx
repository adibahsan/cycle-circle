'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { RevealOnScroll } from '@/components/motion/RevealOnScroll';
import { Button } from '@/components/ui/Button';

export function CTASection() {
  const { t } = useTranslation();

  return (
    <section className="relative py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <RevealOnScroll y={32}>
          <div className="gradient-primary rounded-[var(--radius-xl)] shadow-glow p-10 md:p-14 flex flex-col items-center text-center gap-6">
            <h2 className="text-fluid-lg font-bold text-white">
              {t('landing.finalCtaTitle')}
            </h2>
            <p className="text-fluid-md text-white/80 max-w-md leading-relaxed">
              {t('landing.finalCtaSubtitle')}
            </p>
            <Link href="/get-started">
              <Button
                variant="secondary"
                size="lg"
                className="rounded-2xl font-bold min-w-[180px] bg-white text-[var(--color-primary)] hover:bg-white/90 border-0 shadow-soft"
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
