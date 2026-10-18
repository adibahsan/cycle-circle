'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import VestaLogo from '@/components/ui/VestaLogo';
import type { ProfileCompletionStatus } from '@/lib/profile-completion';
import type { TourStep } from '@/components/onboarding/OnboardingTour';
import { completeOnboardingTour } from '@/app/actions/user-actions';
import { Sun, Moon } from 'lucide-react';
import { SidebarToggle } from '@/components/shell/SidebarToggle';
import { SidebarLanguageButton } from '@/components/shell/SidebarLanguageButton';
import { useSidebarCollapsed } from '@/components/shell/sidebar-collapsed';
import { NAV_ICONS } from '@/components/shell/nav-icons';
import { BottomNav } from '@/components/shell/BottomNav';
import { MoreSheet } from '@/components/shell/MoreSheet';
import { ProfileChip } from '@/components/shell/ProfileChip';
import {
  SIDEBAR_MENU_ITEMS,
  SIDEBAR_MORE_ITEMS,
  NAV_ACTIVE,
  isNavActive,
} from '@/components/shell/nav-config';
import { LatePeriodFullScreenAlert } from '@/components/modals/LatePeriodFullScreenAlert';
import { GOAL_ICON_COMPONENTS, GOAL_I18N_KEYS } from '@/lib/goal-display';
import { goalAccentVar, normalizeGoal } from '@vesta/shared/utils/goal';
import { isTrialExpired } from '@vesta/shared/utils/trial';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import {
  AutoPromptProvider,
  useAutoPrompt,
  useAutoPromptCandidate,
  useAutoPromptExpect,
} from '@/components/prompts/AutoPromptProvider';
import { OPEN_COMPLETION_EVENT } from '@/components/prompts/CompletionRow';
import type { CandidateState } from '@/lib/auto-prompt';
import type { ShellInitial } from '@/lib/shell-initial';
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

export function MainShell({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial?: Promise<ShellInitial | null>;
}) {
  return (
    <ToastProvider>
      <AutoPromptProvider>
        <MainLayoutInner initial={initial}>{children}</MainLayoutInner>
      </AutoPromptProvider>
    </ToastProvider>
  );
}

function MainLayoutInner({ children, initial }: { children: React.ReactNode; initial?: Promise<ShellInitial | null> }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const { theme, setTheme, activeProfileName } = useAppStore(useShallow((s) => ({ theme: s.theme, setTheme: s.setTheme, activeProfileName: s.activeProfileName })));
  const prompt = useAutoPrompt();
  const setAccount = prompt.setAccount;
  const claimPrompt = prompt.claim;
  const { show: showToast } = useToast();

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
  // Active profile name streamed with the page, so the chip is right before the dashboard sets the store.
  const [shellProfileName, setShellProfileName] = useState('');
  // First-run tour eligibility, captured once from /api/auth/status (logged-in
  // user who hasn't completed the tour). Flipped off when the tour is closed so
  // returning to /dashboard in the same session doesn't re-open it.
  const [tourEligible, setTourEligible] = useState(false);

  const activeGoal = normalizeGoal(logging?.goal);
  const chipName = activeProfileName || shellProfileName;
  const chipPending = !chipName && !authStatusLoaded;

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

  // Mount: apply the data the server layout streamed with the page (no round trips). Without
  // `initial`, or if it fails, fall back to the three fetches. Navigating between in-app routes must
  // NOT re-hit these; completion + logging only change after a mutation, which dispatches
  // 'vesta:profile-updated' (handled below).
  useEffect(() => {
    let cancelled = false;
    const cleanups: Array<() => void> = [];
    const fallbackFetchAll = () => {
      if (cancelled) return;
      cleanups.push(refreshAuthStatus(), refreshCompletion(), refreshLogging());
    };
    if (!initial) {
      fallbackFetchAll();
    } else {
      initial.then(
        (data) => {
          if (cancelled) return;
          if (!data) return fallbackFetchAll();
          const { user } = data;
          if (user) {
            const createdAt = Date.parse(user.createdAt ?? '');
            if (Number.isFinite(createdAt)) setAccount({ id: user.id, createdAt });
            setTrialUser({
              authMethod: user.authMethod,
              subscriptionStatus: user.subscriptionStatus,
              emailTrialExpiresAt: user.emailTrialExpiresAt,
            });
          }
          setTourEligible(!!user && !user.onboardingTourCompletedAt);
          setAuthStatusLoaded(true);
          setLogging(data.logging);
          setLoggingLoaded(true);
          if (data.completion) {
            prevPercentRef.current = data.completion.percent;
            setCompletionStatus(data.completion);
          }
          setCompletionLoaded(true);
          setShellProfileName(data.activeProfile?.name ?? '');
        },
        fallbackFetchAll,
      );
    }
    return () => {
      cancelled = true;
      cleanups.forEach((c) => c());
    };
  }, [initial, refreshAuthStatus, refreshCompletion, refreshLogging, setAccount]);

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

  // The dashboard completion row asks the layout (which owns the pop-up) to open it.
  useEffect(() => {
    const open = () => setShowCompletionModal(true);
    window.addEventListener(OPEN_COMPLETION_EVENT, open);
    return () => window.removeEventListener(OPEN_COMPLETION_EVENT, open);
  }, []);

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

  const handlePhoneAdded = useCallback((status?: string) => {
    setTrialUser((prev) =>
      prev ? { ...prev, emailTrialExpiresAt: null, subscriptionStatus: status ?? 'PRO' } : prev,
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

  const sidebar = useSidebarCollapsed();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div
      className="app-shell min-h-dvh bg-[var(--color-bg-primary)] flex flex-col md:flex-row relative"
      style={{ ['--goal-accent' as string]: goalAccentVar(logging?.goal) } as React.CSSProperties}
    >
      {/* ── Skip link: first Tab stop, visible on focus ── */}
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-[100] focus-visible:px-4 focus-visible:py-3 focus-visible:rounded-xl focus-visible:bg-[var(--color-bg-card)] focus-visible:text-[var(--color-text-primary)] focus-visible:font-semibold focus-visible:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]"
      >
        {t('nav.skipToContent')}
      </a>

      {/* ── Trial expired lock overlay — renders only after auth status resolves ── */}
      {prompt.locked && (
        <TrialExpiredLock />
      )}

      {/* ── Desktop Sidebar (md+) ── */}
      <aside
        id="app-sidebar"
        data-sidebar
        data-collapsed={sidebar.pref}
        className="hidden md:flex md:flex-col md:w-60 md:sticky md:top-0 md:h-dvh md:shrink-0 md:overflow-x-hidden motion-reduce:transition-none bg-[var(--color-bg-card)] dark:bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] z-40"
        aria-label={t('nav.sidebarNav')}
      >
        {/* Sidebar header / branding */}
        <div className="sb-head pl-4 pr-2 py-4 flex items-center gap-2">
          <VestaLogo size={28} animate={false} />
          <span className="sb-hide text-lg font-extrabold text-[var(--color-text-primary)] whitespace-nowrap">Cycle Circle</span>
          <SidebarToggle collapsed={sidebar.collapsed} onToggle={sidebar.toggle} controlsId="app-sidebar" />
        </div>

        {/* Profile chip */}
        <div className="sb-pad px-4 mb-4 flex flex-col items-start">
          <ProfileChip
            name={chipName}
            pending={chipPending}
            status={completionStatus}
            onOpenCompletion={() => setShowCompletionModal(true)}
          />
          {activeGoal && (
            <div className="sb-hide mt-1.5 px-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] min-w-0 max-w-full">
              <span className="inline-flex items-center [&_svg]:w-3.5 [&_svg]:h-3.5" aria-hidden="true">{GOAL_ICON_COMPONENTS[activeGoal]}</span>
              <span className="truncate">{t(GOAL_I18N_KEYS[activeGoal])}</span>
            </div>
          )}
        </div>

        {/* Main navigation */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto overflow-x-hidden" aria-label={t('nav.mainNav')}>
          <p className="sb-hide px-3 mb-2 text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
            {t('nav.menu')}
          </p>
          {SIDEBAR_MENU_ITEMS.map(({ href, icon, labelKey, tourKey }) => {
            const Icon = NAV_ICONS[icon];
            const isActive = isNavActive(href, pathname);
            const showDot = href === '/symptoms' && logging?.loggedToday === false;
            const label = t(labelKey);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                aria-label={showDot ? `${label}, ${t('nav.notLoggedToday')}` : label}
                aria-current={isActive ? 'page' : undefined}
                {...(tourKey ? { 'data-tour': tourKey } : {})}
                className={`sb-item relative flex items-center gap-3 px-3 py-2.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)] ${
                  isActive
                    ? 'font-bold'
                    : 'font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]'
                }`}
                style={isActive ? NAV_ACTIVE : undefined}
              >
                <span className="relative">
                  <Icon size={18} strokeWidth={isActive ? 2.25 : 1.5} aria-hidden="true" />
                  {showDot && (
                    <span
                      data-testid="symptoms-dot"
                      aria-hidden="true"
                      className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-[var(--color-primary)] ring-2 ring-[var(--color-bg-card)]"
                    />
                  )}
                </span>
                <span className="sb-hide text-sm truncate">{label}</span>
                {showDot && <span className="sr-only">{t('nav.notLoggedToday')}</span>}
              </Link>
            );
          })}

          {/* Divider (stands in for the section label on the rail) */}
          <div className="my-3 border-t border-[var(--color-border)]" />

          <p className="sb-hide px-3 mb-2 text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
            {t('nav.more')}
          </p>
          {SIDEBAR_MORE_ITEMS.map(({ href, icon, labelKey }) => {
            const Icon = NAV_ICONS[icon];
            const isActive = isNavActive(href, pathname);
            const label = t(labelKey);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
                className={`sb-item flex items-center gap-3 px-3 py-2.5 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)] ${
                  isActive
                    ? 'font-bold'
                    : 'font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]'
                }`}
                style={isActive ? NAV_ACTIVE : undefined}
              >
                <Icon size={18} strokeWidth={isActive ? 2.25 : 1.5} aria-hidden="true" />
                <span className="sb-hide text-sm truncate">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer — theme + language toggles */}
        <div className="sb-pad px-4 py-4 border-t border-[var(--color-border)] flex flex-col gap-2">
          {authStatusLoaded && (
            <div className="sb-hide">
              <TrialCountdownPill trialUser={trialUser} onPhoneAdded={handlePhoneAdded} />
            </div>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? t('nav.switchToLight') : t('nav.switchToDark')}
            title={theme === 'dark' ? t('nav.switchToLight') : t('nav.switchToDark')}
            className="sb-foot-btn flex items-center gap-2 px-3 py-2 rounded-full bg-[var(--color-bg-secondary)] text-sm font-medium hover:bg-[var(--color-bg-primary)] transition-colors w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]"
          >
            {theme === 'dark' ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
            <span className="sb-hide">{theme === 'dark' ? t('settings.lightMode') : t('settings.darkMode')}</span>
          </button>
          <div className="sb-hide"><LanguageToggle /></div>
          <div className="sb-rail-only"><SidebarLanguageButton /></div>
        </div>
      </aside>

      {/* ── Main content column ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header — mobile only; sidebar handles desktop navigation */}
        {/* Opaque, not .glass: Tailwind v4 (Lightning CSS) compiles .glass to only -webkit-backdrop-filter, so Chromium gets no blur and content shows through. */}
        <header className="sticky top-0 z-40 bg-[var(--color-bg-card)] dark:bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] px-4 py-2.5 flex items-center justify-between gap-3 md:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <VestaLogo size={26} animate={false} />
            <ProfileChip
              name={chipName}
              pending={chipPending}
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

        {/* Page content. A flex column, so a PageContainer with `fill` can take the screen's free height. */}
        <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col focus:outline-none pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+1.5rem)] md:pb-8 xl:pb-4">
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
      <ProfileCompletionModal
        open={profileModalOpen}
        onClose={handleModalClose}
        layer={prompt.isActive('profile') ? 'prompt' : 'popup'}
        percent={completionStatus?.percent}
        items={completionStatus?.items}
        onCompleted={() => showToast(t('toast.completionDone'))}
      />

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

    </div>
  );
}
