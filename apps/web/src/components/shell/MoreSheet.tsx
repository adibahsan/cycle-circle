'use client';

import { useId } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { BookOpen, Settings, MessageSquare, Users, CreditCard, Sun, Moon, type LucideIcon } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { MORE_ITEMS, isNavActive, type NavIconKey } from '@/components/shell/nav-config';

const ICONS: Partial<Record<NavIconKey, LucideIcon>> = {
  content: BookOpen,
  profiles: Users,
  subscription: CreditCard,
  feedback: MessageSquare,
  settings: Settings,
};

/** Phone "More" sheet: the destinations that left the bottom nav, plus theme and language. */
export function MoreSheet({
  open,
  onClose,
  pathname,
  theme,
  onToggleTheme,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string | null;
  theme: 'light' | 'dark' | string;
  onToggleTheme: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dark = theme === 'dark';

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId={titleId}
      header={
        <h2 id={titleId} className="px-5 pt-5 pb-2 pr-14 text-lg font-bold text-[var(--color-text-primary)]">
          {t('nav.more')}
        </h2>
      }
    >
      <ul className="flex flex-col gap-1 px-3 pb-2">
        {MORE_ITEMS.map(({ href, icon, labelKey }) => {
          const Icon = ICONS[icon]!;
          const active = isNavActive(href, pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onClose}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)] ${
                  active ? '' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                }`}
                style={active ? { color: 'var(--goal-accent)', backgroundColor: 'color-mix(in srgb, var(--goal-accent) 12%, transparent)' } : undefined}
              >
                <Icon size={18} aria-hidden="true" />
                {t(labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex flex-col gap-3 border-t border-[var(--color-border)] px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-[var(--color-text-secondary)]">{t('nav.theme')}</span>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={dark ? t('nav.switchToLight') : t('nav.switchToDark')}
            className="flex items-center gap-2 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]"
          >
            {dark ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
            <span>{dark ? t('settings.lightMode') : t('settings.darkMode')}</span>
          </button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-[var(--color-text-secondary)]">{t('nav.language')}</span>
          <LanguageToggle />
        </div>
      </div>
    </Modal>
  );
}
