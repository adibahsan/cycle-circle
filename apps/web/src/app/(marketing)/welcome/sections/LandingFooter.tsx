'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { VestaLogoSVG } from '@/components/ui/VestaLogo';

export function LandingFooter() {
  const { t } = useTranslation();

  return (
    <footer className="relative py-10 px-4 border-t border-[var(--color-border)]">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-5">
        {/* Logo + wordmark */}
        <div className="flex items-center gap-2.5">
          <VestaLogoSVG size={28} />
          <span className="font-bold text-[var(--color-primary)] text-lg tracking-wide">
            {t('app.name')}
          </span>
        </div>

        {/* Nav links */}
        <nav aria-label="Footer navigation">
          <ul className="flex items-center gap-6 list-none p-0 m-0">
            <li>
              <Link
                href="/privacy"
                className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 rounded"
              >
                {t('landing.footer.privacy')}
              </Link>
            </li>
            <li>
              <Link
                href="/terms"
                className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 rounded"
              >
                {t('landing.footer.terms')}
              </Link>
            </li>
            <li>
              <Link
                href="/login"
                className="text-sm font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 rounded"
              >
                {t('landing.footer.login')}
              </Link>
            </li>
          </ul>
        </nav>

        {/* Rights / copyright */}
        <p className="text-xs text-[var(--color-text-muted)]">
          {t('landing.footer.rights')}
        </p>
      </div>
    </footer>
  );
}
