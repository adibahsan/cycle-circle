'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react';
import { BOTTOM_NAV_ITEMS, NAV_ACTIVE, isMoreActive, isNavActive } from '@/components/shell/nav-config';
import { NAV_ICONS } from '@/components/shell/nav-icons';

const SLOT =
  'relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--goal-accent)]';

const IDLE = 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]';
const ACTIVE = 'text-[var(--color-text-primary)]';

/** Icon pill: filled with the goal accent on the active slot, tinted on hover otherwise. */
function Pill({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`relative flex h-7 w-12 items-center justify-center rounded-full transition-colors ${active ? '' : 'group-hover:bg-[var(--color-bg-secondary)]'}`}
      style={active ? NAV_ACTIVE : undefined}
    >
      {children}
    </span>
  );
}

/** Phone bottom nav: 4 link slots + More, equal width. Height comes from --bottom-nav-h. */
export function BottomNav({
  pathname,
  notLoggedToday,
  moreOpen,
  onToggleMore,
}: {
  pathname: string | null;
  notLoggedToday: boolean;
  moreOpen: boolean;
  onToggleMore: () => void;
}) {
  const { t } = useTranslation();
  const moreActive = isMoreActive(pathname);

  return (
    <nav
      data-bottom-nav
      aria-label={t('nav.mobileNav')}
      className="fixed bottom-0 left-0 right-0 bg-[var(--color-bg-card)] border-t border-[var(--color-border)] z-40 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5 gap-0.5 px-1 py-1" style={{ height: 'var(--bottom-nav-h)' }}>
        {BOTTOM_NAV_ITEMS.map(({ href, icon, labelKey, tourKey }) => {
          const Icon = NAV_ICONS[icon];
          const active = isNavActive(href, pathname);
          const showDot = href === '/symptoms' && notLoggedToday;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              {...(tourKey ? { 'data-tour': tourKey } : {})}
              className={`group ${SLOT} ${active ? ACTIVE : IDLE}`}
            >
              <Pill active={active}>
                <Icon size={20} strokeWidth={active ? 2.25 : 1.5} aria-hidden="true" />
                {showDot && (
                  <span
                    data-testid="symptoms-dot"
                    aria-hidden="true"
                    className="absolute right-2.5 top-0.5 h-2 w-2 rounded-full bg-[var(--color-primary)] ring-2 ring-[var(--color-bg-card)]"
                  />
                )}
              </Pill>
              <span className={`max-w-full text-[11px] leading-tight ${active ? 'font-bold' : 'font-medium'}`}>{t(labelKey)}</span>
              {showDot && <span className="sr-only">{t('nav.notLoggedToday')}</span>}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onToggleMore}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={`group ${SLOT} ${moreActive ? ACTIVE : IDLE}`}
        >
          <Pill active={moreActive}>
            <Menu size={20} strokeWidth={moreActive ? 2.25 : 1.5} aria-hidden="true" />
          </Pill>
          <span className={`max-w-full text-[11px] leading-tight ${moreActive ? 'font-bold' : 'font-medium'}`}>{t('nav.more')}</span>
        </button>
      </div>
    </nav>
  );
}
