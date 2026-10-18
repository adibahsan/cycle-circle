'use client';

import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useLanguage } from '@/lib/use-language';

/** Icon-only language switch for the collapsed sidebar rail (same behaviour as LanguageToggle). */
export function SidebarLanguageButton() {
  const language = useLanguage();
  const setLanguage = useAppStore((s) => s.setLanguage);
  const { i18n, t } = useTranslation();
  const label = t('nav.switchLanguage');
  return (
    <button
      type="button"
      onClick={() => {
        const next = language === 'en' ? 'bn' : 'en';
        setLanguage(next);
        i18n.changeLanguage(next);
      }}
      aria-label={label}
      title={label}
      className="flex h-11 w-full items-center justify-center rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--goal-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]"
    >
      <Languages size={16} aria-hidden="true" />
    </button>
  );
}
