'use client';

import { useAppStore } from '@/lib/store';
import { useTranslation } from 'react-i18next';

export function LanguageToggle() {
  const { language, setLanguage } = useAppStore();
  const { i18n } = useTranslation();

  const toggle = () => {
    const newLang = language === 'en' ? 'bn' : 'en';
    setLanguage(newLang);
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm font-medium hover:border-[var(--color-primary)] transition-colors"
    >
      <span className={language === 'en' ? 'font-bold text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}>EN</span>
      <span className="text-[var(--color-text-muted)]">/</span>
      <span className={language === 'bn' ? 'font-bold text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}>BN</span>
    </button>
  );
}
