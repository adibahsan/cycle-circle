'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/lib/store';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { Home, CalendarDays, Activity, BookOpen, Settings, MessageSquare, Users, Crown } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', icon: Home, labelKey: 'nav.dashboard' },
  { href: '/calendar', icon: CalendarDays, labelKey: 'nav.calendar' },
  { href: '/symptoms', icon: Activity, labelKey: 'nav.symptoms' },
  { href: '/content', icon: BookOpen, labelKey: 'nav.content' },
  { href: '/settings', icon: Settings, labelKey: 'nav.settings' },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { isAuthenticated, user, profiles, activeProfileId, setActiveProfile } = useAppStore();

  useEffect(() => {
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex flex-col max-w-md mx-auto relative">
      {/* Top header */}
      <header className="sticky top-0 z-40 glass px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold gradient-primary bg-clip-text text-transparent">Vesta</h1>
          {/* Profile switcher chip */}
          <Link
            href="/profiles"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-xs font-medium hover:border-[var(--color-primary)] transition-colors"
          >
            <Users size={12} />
            <span>{activeProfile?.name ?? 'Profile'}</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {user?.subscriptionStatus === 'pro' && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
              <Crown size={10} /> PRO
            </span>
          )}
          <LanguageToggle />
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 px-4 pb-24 pt-2">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md glass border-t border-[var(--color-border)] z-40">
        <div className="flex items-center justify-around py-2">
          {NAV_ITEMS.map(({ href, icon: Icon, labelKey }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                  isActive
                    ? 'text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="text-[10px] font-medium">{t(labelKey)}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
