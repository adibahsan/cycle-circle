'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
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
import { LatePeriodFullScreenAlert } from '@/components/modals/LatePeriodFullScreenAlert';
import { GOAL_ICON_COMPONENTS, GOAL_I18N_KEYS } from '@/lib/goal-display';
import { goalAccentVar, normalizeGoal } from '@vesta/shared/utils/goal';
import { isTrialExpired } from '@vesta/shared/utils/trial';
import { TrialExpiredLock } from '@/components/TrialExpiredLock';

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
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, setTheme, activeProfileName } = useAppStore();
  const { toast, show: showToast } = useToast();

  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionStatus, setCompletionStatus] = useState<ProfileCompletionStatus | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [logging, setLogging] = useState<{ goal: string | null; loggedToday: boolean; isPeriodLate: boolean; daysLate: number } | null>(null);
  const [showLateAlert, setShowLateAlert] = useState(false);
  const [trialUser, setTrialUser] = useState<{
    authMethod?: string | null;
    subscriptionStatus?: string | null;
    emailTrialExpiresAt?: string | null;
  } | null>(null);
  const [authStatusLoaded, setAuthStatusLoaded] = useState(false);

  const activeGoal = normalizeGoal(logging?.goal);

  // Tracks the previous completion percent to detect increases (for progress toast).
  // Initialised to -1 so the very first load does NOT fire the progress toast.
  const prevPercentRef = useRef<number>(-1);

  // ── Auth status fetch — populates user for tour gating + trial lock ─────
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/status')
      .then((r) => {
        if (r.status === 401) { window.location.assign('/login'); return null }
        return r.ok ? r.json() : null
      })
      .then((data: {
        user?: {
          onboardingTourCompletedAt?: string | null;
          authMethod?: string | null;
          subscriptionStatus?: string | null;
          emailTrialExpiresAt?: string | null;
        }
      } | null) => {
        if (cancelled) return;
        const user = data?.user;

        // Capture trial-relevant fields for the lock overlay
        if (user) {
          setTrialUser({
            authMethod: user.authMethod,
            subscriptionStatus: user.subscriptionStatus,
            emailTrialExpiresAt: user.emailTrialExpiresAt,
          });
        }
        setAuthStatusLoaded(true);

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
      .catch(() => {
        setAuthStatusLoaded(true); // unblock on error — don't permanently show lock
      });

    return () => { cancelled = true; };
  }, [pathname]);

  // ── Logging status fetch ─────────────────────────────────────────────────
  const refreshLogging = useCallback(() => {
    const controller = new AbortController();

    fetch('/api/tracking/logging-status', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { goal: string | null; loggedToday: boolean; isPeriodLate: boolean; daysLate: number } | null) => {
        if (!data) return;
        setLogging(data);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      });

    return () => controller.abort();
  }, []);

  // ── Profile completion status fetch ──────────────────────────────────────
  // Stable callback so it can be called from multiple triggers without
  // re-creating event listeners. Each call creates its own AbortController so
  // that overlapping refreshes cancel the previous in-flight request instead of
  // racing to call setCompletionStatus out-of-order.
  const refreshCompletion = useCallback(() => {
    const controller = new AbortController();

    fetch('/api/profile/completion', { signal: controller.signal })
      .then((r) => {
        if (r.status === 401) { window.location.assign('/login'); return null }
        return r.ok ? r.json() : null
      })
      .then((data: ProfileCompletionStatus | null) => {
        if (!data) return;
        setCompletionStatus((prev) => {
          const prevPercent = prevPercentRef.current;
          const nextPercent = data.percent;

          // Fire a progress toast when percent has genuinely increased and the
          // profile is not yet fully complete. Skip on the initial load
          // (prevPercent === -1) to avoid a spurious toast at mount.
          if (prevPercent !== -1 && nextPercent > prevPercent && !data.complete) {
            showToast(t('toast.completionProgress', { percent: nextPercent }));
          }

          prevPercentRef.current = nextPercent;
          return data;
        });
      })
      .catch((err: unknown) => {
        // Ignore AbortError from overlapping refreshes; silently ignore others.
        if (err instanceof DOMException && err.name === 'AbortError') return;
      });

    return () => controller.abort();
  }, [showToast, t]);

  // Run on mount and whenever the pathname changes (e.g. Settings → Dashboard).
  useEffect(() => {
    const cleanupCompletion = refreshCompletion();
    const cleanupLogging = refreshLogging();
    return () => {
      cleanupCompletion?.();
      cleanupLogging?.();
    };
  }, [refreshCompletion, refreshLogging, pathname]);

  // Re-fetch when Settings/Modal/Profiles dispatch 'vesta:profile-updated'
  // (covers same-page updates where pathname does not change).
  useEffect(() => {
    const handler = () => {
      refreshCompletion();
      refreshLogging();
    };
    window.addEventListener('vesta:profile-updated', handler);
    return () => window.removeEventListener('vesta:profile-updated', handler);
  }, [refreshCompletion, refreshLogging]);

  // ── Late period full-screen alert (once per day) ─────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!logging?.isPeriodLate) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `vesta_late_alert_seen_${today}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, '1');
      setShowLateAlert(true);
    }
  }, [logging?.isPeriodLate]);

  const handleLateClose = useCallback(() => setShowLateAlert(false), []);
  const handleLateLogPeriod = useCallback(() => {
    setShowLateAlert(false);
    if (pathname === '/dashboard') {
      window.dispatchEvent(new CustomEvent('vesta:open-period-log'));
    } else {
      sessionStorage.setItem('vesta_open_period_log', '1');
      router.push('/dashboard');
    }
  }, [pathname, router]);

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
    <div
      className="app-shell min-h-screen bg-[var(--color-bg-primary)] flex flex-col md:flex-row relative"
      style={{ ['--goal-accent' as string]: goalAccentVar(logging?.goal) } as React.CSSProperties}
    >
      {/* ── Trial expired lock overlay — renders only after auth status resolves ── */}
      {authStatusLoaded && trialUser && isTrialExpired(trialUser) && (
        <TrialExpiredLock />
      )}

      {/* ── Desktop Sidebar (md+) ── */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:sticky md:top-0 md:h-screen md:shrink-0 glass border-r border-[var(--color-border)] z-40" aria-label="Sidebar navigation">
        {/* Sidebar header / branding */}
        <div className="px-5 py-5 flex items-center gap-3">
          <VestaLogo size={28} animate={false} />
          <h1 className="text-xl font-bold text-[var(--goal-accent)]">Vesta</h1>
        </div>

        {/* Profile switcher */}
        <div className="px-4 mb-4">
          <Link
            href="/profiles"
            prefetch={true}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm font-medium hover:border-[var(--goal-accent)] transition-colors"
          >
            <Users size={14} aria-hidden="true" />
            <span className="truncate">{activeProfileName || 'Profile'}</span>
          </Link>
          {activeGoal && (
            <div className="mt-1.5 px-1 flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--goal-accent)' }}>
              <span className="inline-flex items-center [&_svg]:w-3.5 [&_svg]:h-3.5" aria-hidden="true">{GOAL_ICON_COMPONENTS[activeGoal]}</span>
              <span className="truncate">{t(GOAL_I18N_KEYS[activeGoal])}</span>
            </div>
          )}
        </div>

        {/* Main navigation */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto" aria-label="Main navigation">
          <p className="px-3 mb-2 text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
            {t('nav.menu')}
          </p>
          {NAV_ITEMS.map(({ href, icon: Icon, labelKey, tourKey }) => {
            const isActive = pathname === href;
            const isSymptoms = href === '/symptoms';
            const showDot = isSymptoms && logging?.loggedToday === false;
            return (
              <Link
                key={href}
                href={href}
                prefetch={true}
                {...(tourKey ? { 'data-tour': tourKey } : {})}
                {...(showDot ? { 'aria-label': `${t(labelKey)} — ${t('nav.notLoggedToday')}` } : {})}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                  isActive
                    ? ''
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                }`}
                style={isActive ? { color: 'var(--goal-accent)', backgroundColor: 'color-mix(in srgb, var(--goal-accent) 10%, transparent)' } : undefined}
              >
                {showDot && (
                  <span
                    aria-hidden="true"
                    className="animate-attn-glow pointer-events-none absolute inset-0 rounded-xl"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--goal-accent) 28%, transparent)' }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-3">
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 1.5} aria-hidden="true" />
                  <span className="text-sm font-semibold" style={showDot && !isActive ? { color: 'var(--goal-accent)' } : undefined}>{t(labelKey)}</span>
                </span>
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
                    ? ''
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                }`}
                style={isActive ? { color: 'var(--goal-accent)', backgroundColor: 'color-mix(in srgb, var(--goal-accent) 10%, transparent)' } : undefined}
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
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-bg-primary)] hover:border-[var(--goal-accent)] transition-colors w-full"
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
            <h1 className="text-xl font-bold text-[var(--goal-accent)]">Vesta</h1>
            <Link
              href="/profiles"
              prefetch={true}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-xs font-medium hover:border-[var(--goal-accent)] transition-colors"
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
              className="p-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-primary)] hover:border-[var(--goal-accent)] transition-colors"
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
            const isSymptoms = href === '/symptoms';
            const showDot = isSymptoms && logging?.loggedToday === false;
            return (
              <Link
                key={href}
                href={href}
                prefetch={true}
                {...(tourKey ? { 'data-tour': tourKey } : {})}
                {...(showDot ? { 'aria-label': `${t(labelKey)} — ${t('nav.notLoggedToday')}` } : {})}
                className={`relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                  isActive
                    ? ''
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
                style={isActive ? { color: 'var(--goal-accent)' } : undefined}
              >
                {showDot && (
                  <span
                    aria-hidden="true"
                    className="animate-attn-glow pointer-events-none absolute inset-0 rounded-xl"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--goal-accent) 28%, transparent)' }}
                  />
                )}
                <span className="relative z-10 flex flex-col items-center gap-0.5">
                  <span className="relative">
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5} aria-hidden="true" />
                  </span>
                  <span className="text-[11px] font-medium" style={showDot && !isActive ? { color: 'var(--goal-accent)' } : undefined}>{t(labelKey)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Profile Completion Modal ── */}
      <ProfileCompletionModal
        open={showCompletionModal}
        onClose={handleModalClose}
        percent={completionStatus?.percent}
        items={completionStatus?.items}
        onCompleted={() => showToast(t('toast.completionDone'))}
      />

      {/* ── Onboarding spotlight tour ── */}
      <OnboardingTour
        open={tourOpen}
        steps={tourSteps}
        onClose={handleTourClose}
      />

      {/* ── Late period full-screen alert ── */}
      <LatePeriodFullScreenAlert
        open={showLateAlert}
        onClose={handleLateClose}
        daysLate={logging?.daysLate ?? 0}
        goal={logging?.goal ?? null}
        onLogPeriod={handleLateLogPeriod}
      />

      {/* ── Layout-level toast ── */}
      <Toast toast={toast} />
    </div>
  );
}
