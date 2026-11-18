'use client';

import Link from 'next/link';
import { Trans, useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { LANDING_CONTAINER, LANDING_SECTION } from './landing-layout';
import { RevealOnScroll } from '@/components/motion/RevealOnScroll';
import { useProPriceVars } from '@/components/ProPriceProvider';
import type { CustomerProPrice } from '@/app/queries/pro-price-queries';

const STRONG = <strong className="font-semibold text-[var(--color-text-primary)]" />;

export function SubscriptionChargesSection({ price }: { price: CustomerProPrice | null }) {
  const { t } = useTranslation();
  const vars = useProPriceVars(price);

  return (
    <section className={LANDING_SECTION} aria-labelledby="charges-heading">
      <div className={LANDING_CONTAINER}>
        <RevealOnScroll className="mb-8">
          <h2
            id="charges-heading"
            className="text-fluid-lg font-bold text-[var(--color-text-primary)] max-w-xl text-balance"
          >
            {t('landing.charges.title')}
          </h2>
        </RevealOnScroll>

        <RevealOnScroll>
          <div className="space-y-3 border-t border-[var(--color-border)] pt-6 text-[var(--color-text-secondary)] leading-relaxed max-w-[60ch]">
            <p>
              <Trans
                i18nKey={vars ? 'landing.charges.charge' : 'landing.charges.chargeNoPrice'}
                values={vars ?? undefined}
                components={{ strong: STRONG }}
              />
            </p>
            <p>{vars ? t('landing.charges.renewal', vars) : t('landing.charges.renewalNoPrice')}</p>
            <p>{t('landing.charges.unsubscribe')}</p>
            <p className="pt-2">
              <Link
                href="/terms#bdapps"
                className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-primary)] hover:text-[var(--color-text-primary)] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] rounded"
              >
                {t('landing.charges.termsLink')}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </p>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
