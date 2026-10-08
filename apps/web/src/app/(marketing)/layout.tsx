'use client';

import { Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/lib/store';
import { LanguageToggle } from '@/components/ui/LanguageToggle';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { theme, setTheme } = useAppStore();
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <div className="min-h-dvh bg-[var(--color-bg-primary)]">
      {/* Floating top-right controls: theme + language toggle */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <LanguageToggle />
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-soft hover:border-[var(--color-primary)] transition-colors duration-200 active:scale-95 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500"
          aria-label={theme === 'dark' ? t('nav.switchToLight') : t('nav.switchToDark')}
        >
          {theme === 'dark' ? (
            <Sun size={18} className="text-[var(--color-text-primary)]" aria-hidden="true" />
          ) : (
            <Moon size={18} className="text-[var(--color-text-primary)]" aria-hidden="true" />
          )}
        </button>
      </div>
      {children}
    </div>
  );
}
