'use client';

import { useAppStore } from '@/lib/store';
import { useLanguage } from '@/lib/use-language';
import { useTranslation } from 'react-i18next';

export function LanguageToggle() {
  const language = useLanguage();
  const setLanguage = useAppStore((s) => s.setLanguage);
  const { i18n, t } = useTranslation();

  const toggle = () => {
    const newLang = language === 'en' ? 'bn' : 'en';
    setLanguage(newLang);
    i18n.changeLanguage(newLang);
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
