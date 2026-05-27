'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/lib/store';
import { useDummyData } from '@/lib/config';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import VestaLogo from '@/components/ui/VestaLogo';
import {
  Home,
  CalendarDays,
  Activity,
  BookOpen,
  Settings,
  MessageSquare,
  Users,
  Crown,
  CreditCard,
  Sun,
  Moon,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', icon: Home, labelKey: 'nav.dashboard' },
  { href: '/calendar', icon: CalendarDays, labelKey: 'nav.calendar' },
  { href: '/symptoms', icon: Activity, labelKey: 'nav.symptoms' },
  { href: '/content', icon: BookOpen, labelKey: 'nav.content' },
  { href: '/settings', icon: Settings, labelKey: 'nav.settings' },
];

const SIDEBAR_EXTRA_ITEMS = [
  { href: '/profiles', icon: Users, labelKey: 'nav.profiles' },
  { href: '/feedback', icon: MessageSquare, labelKey: 'nav.feedback' },
  { href: '/subscription', icon: CreditCard, labelKey: 'nav.subscription' },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { isAuthenticated, isHydrating, user, profiles, activeProfileId, setActiveProfile, theme, setTheme } = useAppStore();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  if (!useDummyData && isHydrating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <p className="text-sm text-[var(--color-text-muted)]">Loading your data…</p>
      </div>
    );
  }

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex flex-col md:flex-row relative">
      {/* ── Desktop Sidebar (md+) ── */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:sticky md:top-0 md:h-screen md:shrink-0 glass border-r border-[var(--color-border)] z-40">
        {/* Sidebar header / branding */}
        <div className="px-5 py-5 flex items-center gap-3">
          <VestaLogo size={28} animate={false} />
          <h1 className="text-xl font-bold gradient-primary bg-clip-text text-transparent">Vesta</h1>
          {user?.subscriptionStatus === 'pro' && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
              <Crown size={10} /> PRO
            </span>
          )}
        </div>

        {/* Profile switcher */}
        <div className="px-4 mb-4">
          <Link
            href="/profiles"
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm font-medium hover:border-[var(--color-primary)] transition-colors"
          >
            <Users size={14} />
            <span className="truncate">{activeProfile?.name ?? 'Profile'}</span>
          </Link>
        </div>

        {/* Main navigation */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          <p className="px-3 mb-2 text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
            Menu
          </p>
          {NAV_ITEMS.map(({ href, icon: Icon, labelKey }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="text-sm font-semibold">{t(labelKey)}</span>
              </Link>
            );
          })}

          {/* Divider */}
          <div className="my-3 border-t border-[var(--color-border)]" />

          <p className="px-3 mb-2 text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
            More
          </p>
          {SIDEBAR_EXTRA_ITEMS.map(({ href, icon: Icon, labelKey }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.5} />
                <span className="text-sm font-semibold">{t(labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer — theme + language toggles */}
        <div className="px-4 py-4 border-t border-[var(--color-border)] flex flex-col gap-2">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-bg-primary)] hover:border-[var(--color-primary)] transition-colors w-full"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
          <LanguageToggle />
        </div>
      </aside>

      {/* ── Main content column ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header — mobile only; sidebar handles desktop navigation */}
        <header className="sticky top-0 z-40 glass px-4 py-3 flex items-center justify-between md:hidden">
          <div className="flex items-center gap-3">
            <VestaLogo size={24} animate={false} />
            <h1 className="text-xl font-bold gradient-primary bg-clip-text text-transparent">Vesta</h1>
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
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-primary)] hover:border-[var(--color-primary)] transition-colors"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <LanguageToggle />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 pb-24 pt-2 md:pb-8 md:max-w-4xl md:mx-auto md:w-full md:px-8">
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Navigation (< md) ── */}
      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-[var(--color-border)] z-40 md:hidden">
        <div className="flex items-center justify-around py-2 max-w-md mx-auto">
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
