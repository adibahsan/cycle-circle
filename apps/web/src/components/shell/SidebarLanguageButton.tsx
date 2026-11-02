'use client';

import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { useLanguage } from '@/lib/use-language';
import { useChangeLanguage } from '@/lib/use-change-language';

/** Icon-only language switch for the collapsed sidebar rail (same behaviour as LanguageToggle). */
export function SidebarLanguageButton() {
  const language = useLanguage();
  const changeLanguage = useChangeLanguage();
  const { t } = useTranslation();
  const label = t('nav.switchLanguage');
  return (
    <button
      type="button"
      onClick={() => changeLanguage(language === 'en' ? 'bn' : 'en')}
      aria-label={label}
      title={label}
      className="flex h-11 w-full items-center justify-center rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--goal-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]"
    >
      <Languages size={16} aria-hidden="true" />
    </button>
  );
}
