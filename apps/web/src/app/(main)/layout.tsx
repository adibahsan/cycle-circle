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
import { ProfileCompletionTracker, type ProfileCompletionStatus } from '@/components/ProfileCompletionTracker';
import type { TourStep } from '@/components/onboarding/OnboardingTour';
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
  type LucideIcon,
} from 'lucide-react';
import { BottomNav } from '@/components/shell/BottomNav';
import { MoreSheet } from '@/components/shell/MoreSheet';
import { ProfileChip } from '@/components/shell/ProfileChip';
import {
  SIDEBAR_MENU_ITEMS,
  SIDEBAR_MORE_ITEMS,
  isNavActive,
  type NavIconKey,
} from '@/components/shell/nav-config';
import { Z_CLASS } from '@/components/ui/popup-core';
import { LatePeriodFullScreenAlert } from '@/components/modals/LatePeriodFullScreenAlert';
import { GOAL_ICON_COMPONENTS, GOAL_I18N_KEYS } from '@/lib/goal-display';
import { goalAccentVar, normalizeGoal } from '@vesta/shared/utils/goal';
import { isTrialExpired } from '@vesta/shared/utils/trial';
import {
  AutoPromptProvider,
  useAutoPrompt,
  useAutoPromptCandidate,
  useAutoPromptExpect,
} from '@/components/prompts/AutoPromptProvider';
import type { CandidateState } from '@/lib/auto-prompt';
import dynamic from 'next/dynamic';

const ProfileCompletionModal = dynamic(
  () => import('@/components/ProfileCompletionModal').then((m) => m.ProfileCompletionModal),
  { ssr: false },
)
const OnboardingTour = dynamic(
  () => import('@/components/onboarding/OnboardingTour').then((m) => m.OnboardingTour),
  { ssr: false },
)
const TrialExpiredLock = dynamic(
  () => import('@/components/TrialExpiredLock').then((m) => m.TrialExpiredLock),
  { ssr: false },
)
const TrialCountdownPill = dynamic(
  () => import('@/components/TrialCountdownPill').then((m) => m.TrialCountdownPill),
  { ssr: false },
)

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
      className={`fixed top-4 left-1/2 -translate-x-1/2 ${Z_CLASS.toast} w-full max-w-xs px-4 pointer-events-none`}
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key="layout-toast-bar"
            initial={{ opacity: 0, y: -16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.94 }}
            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
            className="grid rounded-xl bg-[var(--color-text-primary)] text-[var(--color-bg-primary)] text-sm font-medium px-4 py-3 shadow-glow text-center"
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

// SRS FR-AUTH: the profile-completion popup appears ~1 minute after login.
const PROFILE_COMPLETION_PROMPT_DELAY_MS = 60_000;
const TOUR_REPLAY_KEY = 'vesta_replay_tour';

const tourSteps: TourStep[] = [
  { titleKey: 'tour.welcomeTitle', descKey: 'tour.welcomeDesc' },
  { targetSelector: '[data-tour="log-button"]', titleKey: 'tour.logTitle', descKey: 'tour.logDesc' },
  { targetSelector: '[data-tour="nav-calendar"]', titleKey: 'tour.calendarTitle', descKey: 'tour.calendarDesc' },
  { targetSelector: '[data-tour="nav-insights"]', titleKey: 'tour.insightsTitle', descKey: 'tour.insightsDesc' },
  { targetSelector: '[data-tour="profile-ring"]', titleKey: 'tour.profileTitle', descKey: 'tour.profileDesc' },
];

const SIDEBAR_ICONS: Record<NavIconKey, LucideIcon> = {
  home: Home,
  calendar: CalendarDays,
  symptoms: Activity,
  insights: TrendingUp,
  content: BookOpen,
  settings: Settings,
  profiles: Users,
  feedback: MessageSquare,
  subscription: CreditCard,
};

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AutoPromptProvider>
      <MainLayoutInner>{children}</MainLayoutInner>
    </AutoPromptProvider>
  );
}

function MainLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, setTheme, activeProfileName } = useAppStore();
  const prompt = useAutoPrompt();
  const setAccount = prompt.setAccount;
  const claimPrompt = prompt.claim;
  const { toast, show: showToast } = useToast();

  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionStatus, setCompletionStatus] = useState<ProfileCompletionStatus | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [logging, setLogging] = useState<{ profileId?: string | null; goal: string | null; loggedToday: boolean; isPeriodLate: boolean; daysLate: number } | null>(null);
  const [loggingLoaded, setLoggingLoaded] = useState(false);
  const [completionLoaded, setCompletionLoaded] = useState(false);
  const [profileDelayDone, setProfileDelayDone] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [trialUser, setTrialUser] = useState<{
    authMethod?: string | null;
    subscriptionStatus?: string | null;
    emailTrialExpiresAt?: string | null;
  } | null>(null);
  const [authStatusLoaded, setAuthStatusLoaded] = useState(false);
  // First-run tour eligibility, captured once from /api/auth/status (logged-in
  // user who hasn't completed the tour). Flipped off when the tour is closed so
  // returning to /dashboard in the same session doesn't re-open it.
  const [tourEligible, setTourEligible] = useState(false);

  const activeGoal = normalizeGoal(logging?.goal);

  // Tracks the previous completion percent to detect increases (for progress toast).
  // Initialised to -1 so the very first load does NOT fire the progress toast.
  const prevPercentRef = useRef<number>(-1);

  // ── Auth status fetch — trial lock + tour eligibility ────────────────────
  // Stable callback so it can be called both on mount and from the
  // 'vesta:profile-updated' event handler to refresh subscription state after
  // a billing upgrade or profile change.
  const refreshAuthStatus = useCallback(() => {
    const controller = new AbortController();

    fetch('/api/auth/status', { cache: 'no-store', signal: controller.signal })
      .then((r) => {
        if (r.status === 401) { window.location.assign('/login'); return null }
        return r.ok ? r.json() : null
      })
      .then((data: {
        user?: {
          id?: string;
          createdAt?: string | null;
          onboardingTourCompletedAt?: string | null;
          authMethod?: string | null;
          subscriptionStatus?: string | null;
          emailTrialExpiresAt?: string | null;
        }
      } | null) => {
        const user = data?.user;

        // Capture trial-relevant fields for the lock overlay
        if (user) {
          const createdAt = Date.parse(user.createdAt ?? '');
          if (user.id && Number.isFinite(createdAt)) setAccount({ id: user.id, createdAt });
          setTrialUser({
            authMethod: user.authMethod,
            subscriptionStatus: user.subscriptionStatus,
            emailTrialExpiresAt: user.emailTrialExpiresAt,
          });
        }
        // Eligible for the first-run tour = logged-in user who hasn't finished it.
        setTourEligible(!!user && !user.onboardingTourCompletedAt);
        setAuthStatusLoaded(true);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setAuthStatusLoaded(true); // unblock on error — don't permanently show lock
      });

    return () => controller.abort();
  }, [setAccount]);

  // Call once on mount. Navigating between in-app routes must NOT re-hit this
  // endpoint; pathname-dependent tour gating uses the captured `tourEligible`
  // flag without a network request (see effect below).
  useEffect(() => {
    const cleanup = refreshAuthStatus();
    return cleanup;
  }, [refreshAuthStatus]);

  // ── Tour replay (user-opened, bypasses the arbiter) ───────────────────────
  // Settings sets a sessionStorage flag and navigates here. A replay is an explicit
  // user action, so it opens directly (never over the trial lock).
  useEffect(() => {
    if (!authStatusLoaded || pathname !== '/dashboard') return;
    if (sessionStorage.getItem(TOUR_REPLAY_KEY) !== '1') return;
    sessionStorage.removeItem(TOUR_REPLAY_KEY);
    if (prompt.locked) return;
    claimPrompt('tour'); // no auto-prompt may open over (or after) the replay this page load
    setTourOpen(true);
  }, [pathname, authStatusLoaded, prompt.locked, claimPrompt]);

  // ── Logging status fetch ─────────────────────────────────────────────────
  const refreshLogging = useCallback(() => {
    const controller = new AbortController();

    fetch('/api/tracking/logging-status', { cache: 'no-store', signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { profileId?: string | null; goal: string | null; loggedToday: boolean; isPeriodLate: boolean; daysLate: number } | null) => {
        if (!data) return;
        setLogging(data);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      })
      .finally(() => setLoggingLoaded(true));

    return () => controller.abort();
  }, []);

  // ── Profile completion status fetch ──────────────────────────────────────
  // Stable callback so it can be called from multiple triggers without
  // re-creating event listeners. Each call creates its own AbortController so
  // that overlapping refreshes cancel the previous in-flight request instead of
  // racing to call setCompletionStatus out-of-order.
  const refreshCompletion = useCallback(() => {
    const controller = new AbortController();

    fetch('/api/profile/completion', { cache: 'no-store', signal: controller.signal })
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
      })
      .finally(() => setCompletionLoaded(true));

    return () => controller.abort();
  }, [showToast, t]);

  // Run once on mount. Completion + logging status only change after a mutation,
  // which dispatches 'vesta:profile-updated' (handled below) — so they must NOT
  // re-fetch on every in-app navigation (that was 2 round-trips per screen).
  useEffect(() => {
    const cleanupCompletion = refreshCompletion();
    const cleanupLogging = refreshLogging();
    return () => {
      cleanupCompletion?.();
      cleanupLogging?.();
    };
  }, [refreshCompletion, refreshLogging]);

  // Re-fetch when Settings/Modal/Profiles dispatch 'vesta:profile-updated'
  // (covers same-page updates where pathname does not change).
  // refreshAuthStatus is included so subscription/trial state also refreshes
  // after a billing upgrade or phone-add without a full page reload.
  useEffect(() => {
    const handler = () => {
      refreshCompletion();
      refreshLogging();
      refreshAuthStatus();
    };
    window.addEventListener('vesta:profile-updated', handler);
    return () => window.removeEventListener('vesta:profile-updated', handler);
  }, [refreshCompletion, refreshLogging, refreshAuthStatus]);

  // ── Auto-prompt candidates (the arbiter picks at most one per page load) ───
  // SRS FR-AUTH: the profile prompt only becomes a candidate ~1 minute after load.
  useEffect(() => {
    const id = setTimeout(() => setProfileDelayDone(true), PROFILE_COMPLETION_PROMPT_DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  const trialLockState: CandidateState = !authStatusLoaded
    ? 'pending'
    : trialUser && isTrialExpired(trialUser) && pathname !== '/subscription'
      ? 'yes'
      : 'no';
  const lateState: CandidateState = !loggingLoaded ? 'pending' : logging?.isPeriodLate ? 'yes' : 'no';
  const tourState: CandidateState = !authStatusLoaded
    ? 'pending'
    : pathname === '/dashboard' && tourEligible
      ? 'yes'
      : 'no';
  const profileState: CandidateState = !completionLoaded
    ? 'pending'
    : !completionStatus || completionStatus.complete
      ? 'no'
      : profileDelayDone
        ? 'yes'
        : 'pending';
  useAutoPromptCandidate('trial-lock', trialLockState);
  // A late period belongs to the active profile, so its daily cadence is per profile.
  useAutoPromptCandidate('late-alert', lateState, { scope: logging?.profileId ?? null });
  useAutoPromptCandidate('tour', tourState);
  useAutoPromptCandidate('profile', profileState);
  // The check-in is reported by the dashboard, which owns its data; hold lower prompts until it does.
  useAutoPromptExpect('check-in', pathname === '/dashboard');

  const handleLateClose = useCallback(() => prompt.close('late-alert'), [prompt]);
  const handleLateLogPeriod = useCallback(() => {
    prompt.close('late-alert');
    if (pathname === '/dashboard') {
      window.dispatchEvent(new CustomEvent('vesta:open-period-log'));
    } else {
      sessionStorage.setItem('vesta_open_period_log', '1');
      router.push('/dashboard');
    }
  }, [pathname, router, prompt]);

  const handlePhoneAdded = useCallback(() => {
    setTrialUser((prev) =>
      prev ? { ...prev, emailTrialExpiresAt: null, subscriptionStatus: 'PRO' } : prev,
    );
    // Refresh RSC (account page, etc.) and re-fetch the client-side completion /
    // logging status so the ring updates from 83% → 100% without a reload.
    router.refresh();
    window.dispatchEvent(new Event('vesta:profile-updated'));
  }, [router]);

  function handleModalClose() {
    setShowCompletionModal(false);
    prompt.close('profile');
  }

  function handleTourClose() {
    setTourOpen(false);
    prompt.close('tour');
    setTourEligible(false); // don't re-open on return to /dashboard this session
    void completeOnboardingTour();
  }

  // The More sheet is for navigating: close it when the route changes.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const profileModalOpen = !prompt.locked && (showCompletionModal || prompt.isActive('profile'));
  const tourIsOpen = !prompt.locked && (tourOpen || prompt.isActive('tour'));

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div
      className="app-shell min-h-screen bg-[var(--color-bg-primary)] flex flex-col md:flex-row relative"
      style={{ ['--goal-accent' as string]: goalAccentVar(logging?.goal) } as React.CSSProperties}
    >
      {/* ── Trial expired lock overlay — renders only after auth status resolves ── */}
      {prompt.locked && (
        <TrialExpiredLock />
      )}

      {/* ── Desktop Sidebar (md+) ── */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:sticky md:top-0 md:h-screen md:shrink-0 glass border-r border-[var(--color-border)] z-40" aria-label="Sidebar navigation">
        {/* Sidebar header / branding */}
        <div className="px-5 py-5 flex items-center gap-3">
          <VestaLogo size={28} animate={false} />
          <span className="text-xl font-extrabold text-[var(--color-text-primary)]">Cycle Circle</span>
        </div>

        {/* Profile chip */}
        <div className="px-4 mb-4">
          <ProfileChip
            name={activeProfileName}
            status={completionStatus}
            onOpenCompletion={() => setShowCompletionModal(true)}
          />
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
          {SIDEBAR_MENU_ITEMS.map(({ href, icon, labelKey, tourKey }) => {
            const Icon = SIDEBAR_ICONS[icon];
            const isActive = isNavActive(href, pathname);
            const showDot = href === '/symptoms' && logging?.loggedToday === false;
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                {...(tourKey ? { 'data-tour': tourKey } : {})}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)] ${
                  isActive
                    ? ''
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                }`}
                style={isActive ? { color: 'var(--goal-accent)', backgroundColor: 'color-mix(in srgb, var(--goal-accent) 12%, transparent)' } : undefined}
              >
                <span className="relative">
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 1.5} aria-hidden="true" />
                  {showDot && (
                    <span
                      data-testid="symptoms-dot"
                      aria-hidden="true"
                      className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-[var(--goal-accent)] ring-2 ring-[var(--color-bg-card)]"
                    />
                  )}
                </span>
                <span className="text-sm font-semibold">{t(labelKey)}</span>
                {showDot && <span className="sr-only">{t('nav.notLoggedToday')}</span>}
              </Link>
            );
          })}

          {/* Divider */}
          <div className="my-3 border-t border-[var(--color-border)]" />

          <p className="px-3 mb-2 text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
            {t('nav.more')}
          </p>
          {SIDEBAR_MORE_ITEMS.map(({ href, icon, labelKey }) => {
            const Icon = SIDEBAR_ICONS[icon];
            const isActive = isNavActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)] ${
                  isActive
                    ? ''
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                }`}
                style={isActive ? { color: 'var(--goal-accent)', backgroundColor: 'color-mix(in srgb, var(--goal-accent) 12%, transparent)' } : undefined}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.5} aria-hidden="true" />
                <span className="text-sm font-semibold">{t(labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer — theme + language toggles */}
        <div className="px-4 py-4 border-t border-[var(--color-border)] flex flex-col gap-2">
          {authStatusLoaded && (
            <TrialCountdownPill trialUser={trialUser} onPhoneAdded={handlePhoneAdded} />
          )}
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--color-bg-secondary)] text-sm font-medium hover:bg-[var(--color-bg-primary)] transition-colors w-full"
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
        {/* Opaque, not .glass: Tailwind v4 (Lightning CSS) compiles .glass to only -webkit-backdrop-filter, so Chromium gets no blur and content shows through. */}
        <header className="sticky top-0 z-40 bg-[var(--color-bg-card)] border-b border-[var(--color-border)] px-4 py-2.5 flex items-center justify-between gap-3 md:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <VestaLogo size={26} animate={false} />
            <ProfileChip
              name={activeProfileName}
              status={completionStatus}
              onOpenCompletion={() => setShowCompletionModal(true)}
            />
          </div>
          {authStatusLoaded && (
            <div className="shrink-0">
              <TrialCountdownPill trialUser={trialUser} onPhoneAdded={handlePhoneAdded} />
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+1.5rem)] md:pb-8">
          {/* Profile completion pill — shown on all main pages */}
          {completionStatus && (
            <div className="w-full max-w-4xl px-4 md:px-8 pt-4">
              <ProfileCompletionTracker
                variant="pill"
                status={completionStatus}
                onComplete={() => setShowCompletionModal(true)}
              />
            </div>
          )}
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Navigation (< md) ── */}
      <BottomNav
        pathname={pathname}
        notLoggedToday={logging?.loggedToday === false}
        moreOpen={moreOpen}
        onToggleMore={() => setMoreOpen((v) => !v)}
      />
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        pathname={pathname}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* ── Profile Completion Modal ── */}
      {profileModalOpen && (
        <ProfileCompletionModal
          open={profileModalOpen}
          onClose={handleModalClose}
          percent={completionStatus?.percent}
          items={completionStatus?.items}
          onCompleted={() => showToast(t('toast.completionDone'))}
        />
      )}

      {/* ── Onboarding spotlight tour ── */}
      {tourIsOpen && (
        <OnboardingTour
          open={tourIsOpen}
          steps={tourSteps}
          onClose={handleTourClose}
        />
      )}

      {/* ── Late period full-screen alert ── */}
      <LatePeriodFullScreenAlert
        open={prompt.isActive('late-alert')}
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
