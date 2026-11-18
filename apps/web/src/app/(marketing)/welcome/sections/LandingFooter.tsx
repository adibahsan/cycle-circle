'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { LANDING_CONTAINER, LANDING_FOOTER } from './landing-layout';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { ContactBlock } from '@/components/legal/ContactBlock';

export function LandingFooter() {
  const { t } = useTranslation();

  return (
    <footer className={LANDING_FOOTER}>
      <div className={`${LANDING_CONTAINER} flex flex-col sm:flex-row items-center justify-between gap-5`}>
        {/* Logo + wordmark */}
        <div className="flex items-center gap-2.5">
          <BrandLogo size={36} alt="" />
          <span className="font-extrabold text-[var(--color-text-primary)] text-lg">
            {t('app.name')}
          </span>
        </div>

        {/* Nav links */}
        <nav aria-label={t('nav.footerNav')}>
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 list-none p-0 m-0">
            <li>
              <Link
                href="/privacy"
                className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] rounded"
              >
                {t('landing.footer.privacy')}
              </Link>
            </li>
            <li>
              <Link
                href="/terms"
                className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] rounded"
              >
                {t('landing.footer.terms')}
              </Link>
            </li>
            <li>
              <Link
                href="/guide"
                className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] rounded"
              >
                {t('landing.footer.guide')}
              </Link>
            </li>
            <li>
              <Link
                href="/terms#bdapps"
                className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] rounded"
              >
                {t('landing.footer.bdappsTerms')}
              </Link>
            </li>
            <li>
              <Link
                href="/login"
                className="text-sm font-semibold text-[var(--color-primary)] hover:text-[var(--color-text-primary)] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] rounded"
              >
                {t('landing.footer.login')}
              </Link>
            </li>
          </ul>
        </nav>

        {/* Contact */}
        <ContactBlock showHeading className="w-full sm:w-auto" />
      </div>

      {/* Rights / copyright */}
      <p className="mt-8 text-center text-xs text-[var(--color-text-muted)]">
        {t('landing.footer.rights')}
      </p>
    </footer>
  );
}
