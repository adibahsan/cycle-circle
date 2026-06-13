'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/lib/store';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import VestaLogo from '@/components/ui/VestaLogo';
import { ProfileCompletionModal } from '@/components/ProfileCompletionModal';
import {
  Home,
  CalendarDays,
  Activity,
  BookOpen,
  Settings,
  MessageSquare,
  Users,
  CreditCard,
  Sun,
  Moon,
} from 'lucide-react';

const PROFILE_MODAL_DISMISSED_KEY = 'vesta_profile_modal_dismissed';

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
  const pathname = usePathname();
  const { t } = useTranslation();
  const { theme, setTheme, activeProfileName } = useAppStore();

  const [showCompletionModal, setShowCompletionModal] = useState(false);

  useEffect(() => {
    // Only show once per browser session — if already dismissed, skip the fetch entirely
    if (sessionStorage.getItem(PROFILE_MODAL_DISMISSED_KEY)) return;

    let cancelled = false;
    fetch('/api/auth/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { user?: { profileCompleted?: boolean; authMethod?: string } } | null) => {
        if (cancelled) return;
        const user = data?.user;
        if (user && user.profileCompleted === false && user.authMethod === 'EMAIL') {
          setShowCompletionModal(true);
        }
      })
      .catch(() => {/* silently ignore — modal is non-critical */});

    return () => { cancelled = true; };
  }, []);

  function handleModalClose() {
    setShowCompletionModal(false);
    sessionStorage.setItem(PROFILE_MODAL_DISMISSED_KEY, '1');
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex flex-col md:flex-row relative">
      {/* ── Desktop Sidebar (md+) ── */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:sticky md:top-0 md:h-screen md:shrink-0 glass border-r border-[var(--color-border)] z-40" aria-label="Sidebar navigation">
        {/* Sidebar header / branding */}
        <div className="px-5 py-5 flex items-center gap-3">
          <VestaLogo size={28} animate={false} />
          <h1 className="text-xl font-bold text-[var(--color-primary)]">Vesta</h1>
        </div>

        {/* Profile switcher */}
        <div className="px-4 mb-4">
          <Link
            href="/profiles"
            prefetch={true}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm font-medium hover:border-[var(--color-primary)] transition-colors"
          >
            <Users size={14} aria-hidden="true" />
            <span className="truncate">{activeProfileName || 'Profile'}</span>
          </Link>
        </div>

        {/* Main navigation */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto" aria-label="Main navigation">
          <p className="px-3 mb-2 text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
            {t('nav.menu')}
          </p>
          {NAV_ITEMS.map(({ href, icon: Icon, labelKey }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                prefetch={true}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.5} aria-hidden="true" />
                <span className="text-sm font-semibold">{t(labelKey)}</span>
              </Link>
            );
          })}

          {/* Divider */}
          <div className="my-3 border-t border-[var(--color-border)]" />

          <p className="px-3 mb-2 text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
            {t('nav.more')}
          </p>
          {SIDEBAR_EXTRA_ITEMS.map(({ href, icon: Icon, labelKey }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                prefetch={true}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                  isActive
                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                }`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.5} aria-hidden="true" />
                <span className="text-sm font-semibold">{t(labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer — theme + language toggles */}
        <div className="px-4 py-4 border-t border-[var(--color-border)] flex flex-col gap-2">
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-bg-primary)] hover:border-[var(--color-primary)] transition-colors w-full"
          >
            {theme === 'dark' ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
            <span>{theme === 'dark' ? t('settings.lightMode') : t('settings.darkMode')}</span>
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
            <h1 className="text-xl font-bold text-[var(--color-primary)]">Vesta</h1>
            <Link
              href="/profiles"
              prefetch={true}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-xs font-medium hover:border-[var(--color-primary)] transition-colors"
            >
              <Users size={12} aria-hidden="true" />
              <span className="truncate">{activeProfileName || 'Profile'}</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-primary)] hover:border-[var(--color-primary)] transition-colors"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
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
      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-[var(--color-border)] z-40 md:hidden" aria-label="Mobile navigation">
        <div className="flex items-center justify-around py-2 max-w-md mx-auto">
          {NAV_ITEMS.map(({ href, icon: Icon, labelKey }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                prefetch={true}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                  isActive
                    ? 'text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} aria-hidden="true" />
                <span className="text-[11px] font-medium">{t(labelKey)}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Profile Completion Modal ── */}
      <ProfileCompletionModal
        open={showCompletionModal}
        onClose={handleModalClose}
      />
    </div>
  );
}
