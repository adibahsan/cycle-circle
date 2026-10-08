'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Home, CalendarDays, Activity, TrendingUp, Menu } from 'lucide-react';
import { BOTTOM_NAV_ITEMS, isMoreActive, isNavActive, type NavIconKey } from '@/components/shell/nav-config';

const ICONS: Partial<Record<NavIconKey, typeof Home>> = {
  home: Home,
  calendar: CalendarDays,
  symptoms: Activity,
  insights: TrendingUp,
};

const SLOT =
  'relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--goal-accent)]';

function slotStyle(active: boolean): React.CSSProperties | undefined {
  return active
    ? { color: 'var(--goal-accent)', backgroundColor: 'color-mix(in srgb, var(--goal-accent) 12%, transparent)' }
    : undefined;
}

const IDLE = 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]';

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
      aria-label="Mobile navigation"
      className="fixed bottom-0 left-0 right-0 glass border-t border-[var(--color-border)] z-40 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5 gap-0.5 px-1 py-1" style={{ height: 'var(--bottom-nav-h)' }}>
        {BOTTOM_NAV_ITEMS.map(({ href, icon, labelKey, tourKey }) => {
          const Icon = ICONS[icon]!;
          const active = isNavActive(href, pathname);
          const showDot = href === '/symptoms' && notLoggedToday;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              {...(tourKey ? { 'data-tour': tourKey } : {})}
              className={`${SLOT} ${active ? '' : IDLE}`}
              style={slotStyle(active)}
            >
              <span className="relative">
                <Icon size={20} strokeWidth={active ? 2.5 : 1.5} aria-hidden="true" />
                {showDot && (
                  <span
                    data-testid="symptoms-dot"
                    aria-hidden="true"
                    className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-[var(--goal-accent)] ring-2 ring-[var(--color-bg-card)]"
                  />
                )}
              </span>
              <span className="max-w-full text-[11px] font-medium leading-tight">{t(labelKey)}</span>
              {showDot && <span className="sr-only">{t('nav.notLoggedToday')}</span>}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onToggleMore}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={`${SLOT} ${moreActive ? '' : IDLE}`}
          style={slotStyle(moreActive)}
        >
          <Menu size={20} strokeWidth={moreActive ? 2.5 : 1.5} aria-hidden="true" />
          <span className="max-w-full text-[11px] font-medium leading-tight">{t('nav.more')}</span>
        </button>
      </div>
    </nav>
  );
}
