'use client';

import { useLanguage } from '@/lib/use-language';
import { useChangeLanguage } from '@/lib/use-change-language';
import { useTranslation } from 'react-i18next';

export function LanguageToggle() {
  const language = useLanguage();
  const changeLanguage = useChangeLanguage();
  const { t } = useTranslation();

  const toggle = () => {
    changeLanguage(language === 'en' ? 'bn' : 'en');
  };

  return (
    <button
      onClick={toggle}
      aria-label={t('nav.switchLanguage')}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm font-medium hover:border-[var(--goal-accent)] transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
    >
      <span className={language === 'en' ? 'font-bold text-[var(--goal-accent)]' : 'text-[var(--color-text-muted)]'}>{t('nav.langShortEn')}</span>
      <span className="text-[var(--color-text-muted)]">/</span>
      <span className={language === 'bn' ? 'font-bold text-[var(--goal-accent)]' : 'text-[var(--color-text-muted)]'}>{t('nav.langShortBn')}</span>
    </button>
  );
}
