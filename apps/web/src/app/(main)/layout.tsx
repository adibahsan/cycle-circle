'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '@/lib/store';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import VestaLogo from '@/components/ui/VestaLogo';
import { ProfileCompletionModal } from '@/components/ProfileCompletionModal';
import { ProfileCompletionTracker, type ProfileCompletionStatus } from '@/components/ProfileCompletionTracker';
import { OnboardingTour, type TourStep } from '@/components/onboarding/OnboardingTour';
import { completeOnboardingTour } from '@/app/actions/user-actions';
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
  TrendingUp,
} from 'lucide-react';

// ── Toast (single-slot, same pattern as SettingsClient) ───────────────────────

interface ToastState {
  text: string;
  seq: number;
}

function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string) => {
    setToast((prev) => ({ text, seq: (prev?.seq ?? 0) + 1 }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { toast, show };
}

function Toast({ toast }: { toast: ToastState | null }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] w-full max-w-xs px-4 pointer-events-none"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key="layout-toast-bar"
            initial={{ opacity: 0, y: -16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.94 }}
            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
            className="grid rounded-xl bg-[var(--color-text-primary)] text-white text-sm font-medium px-4 py-3 shadow-glow text-center"
          >
            <AnimatePresence>
              <motion.span
                key={toast.seq}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="col-start-1 row-start-1"
              >
                {toast.text}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const PROFILE_MODAL_DISMISSED_KEY = 'vesta_profile_modal_dismissed';
const TOUR_REPLAY_KEY = 'vesta_replay_tour';

const tourSteps: TourStep[] = [
  { titleKey: 'tour.welcomeTitle', descKey: 'tour.welcomeDesc' },
  { targetSelector: '[data-tour="log-button"]', titleKey: 'tour.logTitle', descKey: 'tour.logDesc' },
  { targetSelector: '[data-tour="nav-calendar"]', titleKey: 'tour.calendarTitle', descKey: 'tour.calendarDesc' },
  { targetSelector: '[data-tour="nav-insights"]', titleKey: 'tour.insightsTitle', descKey: 'tour.insightsDesc' },
  { targetSelector: '[data-tour="profile-ring"]', titleKey: 'tour.profileTitle', descKey: 'tour.profileDesc' },
];

const NAV_ITEMS = [
  { href: '/dashboard', icon: Home, labelKey: 'nav.dashboard', tourKey: undefined },
  { href: '/calendar', icon: CalendarDays, labelKey: 'nav.calendar', tourKey: 'nav-calendar' },
  { href: '/symptoms', icon: Activity, labelKey: 'nav.symptoms', tourKey: undefined },
  { href: '/insights', icon: TrendingUp, labelKey: 'nav.insights', tourKey: 'nav-insights' },
  { href: '/content', icon: BookOpen, labelKey: 'nav.content', tourKey: undefined },
  { href: '/settings', icon: Settings, labelKey: 'nav.settings', tourKey: undefined },
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
  const { toast, show: showToast } = useToast();

  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionStatus, setCompletionStatus] = useState<ProfileCompletionStatus | null>(null);
  const [tourOpen, setTourOpen] = useState(false);

  // ── Auth status fetch — populates user for tour gating ──────────────────
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { user?: { onboardingTourCompletedAt?: string | null } } | null) => {
        if (cancelled) return;
        const user = data?.user;
        if (pathname !== '/dashboard') return;

        // Check for a replay request set by the settings page
        const replayRequested = sessionStorage.getItem(TOUR_REPLAY_KEY) === '1';
        if (replayRequested) {
          sessionStorage.removeItem(TOUR_REPLAY_KEY);
        }

        if (replayRequested || (user && !user.onboardingTourCompletedAt)) {
          setTourOpen(true);
        }
      })
      .catch(() => {/* silently ignore — tour is non-critical */});

    return () => { cancelled = true; };
  }, [pathname]);

  // ── Profile completion status fetch ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch('/api/profile/completion')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ProfileCompletionStatus | null) => {
        if (cancelled || !data) return;
        setCompletionStatus(data);
      })
      .catch(() => {/* silently ignore */});

    return () => { cancelled = true; };
  }, []);

  function handleModalClose() {
    setShowCompletionModal(false);
    sessionStorage.setItem(PROFILE_MODAL_DISMISSED_KEY, '1');
  }

  function handleTourClose() {
    setTourOpen(false);
    void completeOnboardingTour();
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
          {NAV_ITEMS.map(({ href, icon: Icon, labelKey, tourKey }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                prefetch={true}
                {...(tourKey ? { 'data-tour': tourKey } : {})}
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
          {completionStatus && !completionStatus.complete && (
            <div data-tour="profile-ring">
              <ProfileCompletionTracker
                status={completionStatus}
                variant="header"
                onComplete={() => setShowCompletionModal(true)}
                className="w-full"
              />
            </div>
          )}
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
            {completionStatus && !completionStatus.complete && (
              <div data-tour="profile-ring">
                <ProfileCompletionTracker
                  status={completionStatus}
                  variant="header"
                  onComplete={() => setShowCompletionModal(true)}
                />
              </div>
            )}
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
          {/* Profile completion pill — shown on all main pages */}
          {completionStatus && (
            <ProfileCompletionTracker
              variant="pill"
              status={completionStatus}
              onComplete={() => setShowCompletionModal(true)}
              className="mb-4"
            />
          )}
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Navigation (< md) ── */}
      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-[var(--color-border)] z-40 md:hidden" aria-label="Mobile navigation">
        <div className="flex items-center justify-around py-2 max-w-md mx-auto">
          {NAV_ITEMS.map(({ href, icon: Icon, labelKey, tourKey }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                prefetch={true}
                {...(tourKey ? { 'data-tour': tourKey } : {})}
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
        onCompleted={() => showToast(t('toast.completionDone'))}
      />

      {/* ── Onboarding spotlight tour ── */}
      <OnboardingTour
        open={tourOpen}
        steps={tourSteps}
        onClose={handleTourClose}
      />

      {/* ── Layout-level toast ── */}
      <Toast toast={toast} />
    </div>
  );
}
