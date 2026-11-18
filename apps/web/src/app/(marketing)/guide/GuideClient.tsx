'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { LegalPageShell } from '@/components/legal/LegalPageShell';
import { LegalSection } from '@/components/legal/LegalSection';
import { GUIDE_STEPS } from '@/lib/guide-steps';

export function GuideClient() {
  const { t } = useTranslation();

  return (
    <LegalPageShell title={t('guide.title')} intro={t('guide.intro')}>
      {GUIDE_STEPS.map(({ key, icon }) => (
        <LegalSection key={key} icon={icon} title={t(`guide.steps.${key}.title`)}>
          <p>{t(`guide.steps.${key}.body`)}</p>
        </LegalSection>
      ))}
      <p>
        <Link
          href="/terms#bdapps"
          className="inline-flex items-center gap-1 text-[var(--color-secondary)] hover:underline font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 rounded"
        >
          {t('landing.charges.termsLink')} →
        </Link>
      </p>
    </LegalPageShell>
  );
}
