'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion } from 'motion/react'
import { parseISO } from 'date-fns'
import Link from 'next/link'
import { CalendarDays, Activity, Droplets, Baby } from 'lucide-react'

import { useAppStore } from '@/lib/store'
import '@vesta/shared/utils/i18n'
import {
  getCurrentCycleDay,
  getCurrentPhase,
  getDaysUntilNextPeriod,
  computePrediction,
  normalizeCyclePhase,
  getPhaseColor,
  getPhaseEmoji,
} from '@vesta/shared/utils/cycle-utils'
import type { FlowIntensity, ProfileRelation } from '@vesta/shared/types'
import { isPregnancy, goalAccentVar } from '@vesta/shared/utils/goal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PeriodLogModal, FLOW_COLORS, FLOW_TEXT } from '@/components/PeriodLogModal'
import { setActiveProfileCookie } from '@/app/actions/profile-actions'
import type { ProfileCompletionStatus } from '@/lib/profile-completion'
import { CompletionRow } from '@/components/prompts/CompletionRow'
import { checkInCandidateState, daysSinceLastLog as daysSinceLastLogFor } from '@/lib/prompt-rules'
import { LoggingNudge } from '@/components/nudge/LoggingNudge'
import { QuickSymptomModal } from '@/components/modals/QuickSymptomModal'
import { useToast } from '@/components/ui/Toast'
import { useAutoPrompt, useAutoPromptCandidate } from '@/components/prompts/AutoPromptProvider'
import { TodayCheckInStrip } from '@/components/engagement/TodayCheckInStrip'
import { ProgressToUnlockMeter } from '@/components/engagement/ProgressToUnlockMeter'
import dynamic from 'next/dynamic'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'

const TodayCheckInModal = dynamic(
  () => import('@/components/engagement/TodayCheckInModal').then((m) => m.TodayCheckInModal),
  { ssr: false },
)

// ─── Types ────────────────────────────────────────────────────────────────────

interface EngagementSummary {
  loggedToday: boolean;
  lastLoggedDate: string | null;
  streak: number;
  streakAtRisk: boolean;
  last30: { date: string; logged: boolean }[];
  cyclesLogged: number;
  unlockTarget: number;
  tier: string | null;
  confidence: number;
  periodLogCount: number;
}

interface PrismaProfile {
  id: string
  userId: string
  name: string
  relation: string
  cycleLength: number
  periodLength: number
  lastPeriodStart: Date | null
  goal: string | null
  createdAt: Date
  updatedAt: Date
}

interface PrismaPrediction {
  id: string
  profileId: string
  tier: string
  nextPeriodStart: Date
  ovulationDay: Date
  fertileStart: Date
  fertileEnd: Date
  confidence: number
  createdAt: Date
  updatedAt: Date
}

interface DashboardData {
  mode: 'standard' | 'pregnancy' | 'menopause'
  currentCycleDay: number
  currentPhase: string | null
  countdownToNextPeriod: number | null
  lastPeriod: {
    startDate: Date
    duration: number
    flowIntensity: string
  } | null
  prediction: PrismaPrediction | null
  lastSymptomLogDate?: Date | null
}

interface AuthUser {
  id: string
  phone?: string | null
  email?: string | null
  fullName?: string | null
}

interface Props {
  profiles: PrismaProfile[]
  user: AuthUser
  activeProfileId: string
  dashboardData: DashboardData | null
  completion: ProfileCompletionStatus
  lastSymptomLogDate: Date | string | null
  goal: string | null
  /** undefined = not loaded yet, null = settled without data. */
  engagement?: EngagementSummary | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function toDateString(d: Date | string): string {
  if (typeof d === 'string') return d
  return d.toISOString().slice(0, 10)
}

/** Prisma stores LIGHT/MEDIUM/HEAVY; our UI uses light/medium/heavy */
function normalizeFlow(f: string): FlowIntensity {
  return f.toLowerCase() as FlowIntensity
}

// ─── Circular Progress ────────────────────────────────────────────────────────

function CycleRing({
  cycleDay,
  cycleLength,
  phase,
  phaseColor,
  isLate = false,
  daysLate = 0,
}: {
  cycleDay: number
  cycleLength: number
  phase: string
  phaseColor: string
  isLate?: boolean
  daysLate?: number
}) {
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()
  const SIZE = 220
  const STROKE = 16
  const RADIUS = (SIZE - STROKE) / 2
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  const progress = cycleDay / cycleLength
  const offset = CIRCUMFERENCE * (1 - progress)

  const ringColor = isLate ? 'var(--color-menstrual)' : phaseColor
  const centerNumber = isLate ? daysLate : cycleDay
  const centerColor = isLate ? 'var(--color-menstrual)' : phaseColor
  const centerLabel = isLate ? t('dashboard.late') : t('dashboard.day')

  return (
    <div className="relative flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
      {/* Track ring */}
      <svg
        width={SIZE}
        height={SIZE}
        className="absolute rotate-[-90deg]"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="color-mix(in srgb, var(--goal-accent) 14%, transparent)"
          strokeWidth={STROKE}
        />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={ringColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={
            isLate && !prefersReducedMotion
              ? { strokeDashoffset: offset, opacity: [1, 0.7, 1] }
              : { strokeDashoffset: offset }
          }
          transition={
            isLate && !prefersReducedMotion
              ? {
                  strokeDashoffset: { duration: 1.2, ease: 'easeOut' },
                  opacity: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                }
              : { duration: 1.2, ease: 'easeOut' }
          }
        />
      </svg>

      {/* Center content */}
      <motion.div
        className="flex flex-col items-center gap-1"
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-5xl font-bold"
          style={{ color: centerColor }}
        >
          {centerNumber}
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-sm font-medium text-[var(--color-text-muted)] tracking-widest uppercase"
        >
          {centerLabel}
        </motion.div>
      </motion.div>
    </div>
  )
}

// ─── Dashboard Client ─────────────────────────────────────────────────────────

export function DashboardClient({ profiles, user: _user, activeProfileId, dashboardData, completion, lastSymptomLogDate, goal, engagement }: Props) {
  const { t } = useTranslation()
  const router = useRouter()
  const { setActiveProfile, language } = useAppStore()
  const prompt = useAutoPrompt()
  const prefersReducedMotion = useReducedMotion()

  const profile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]

  useEffect(() => {
    if (profile) {
      setActiveProfile(profile.id, profile.name)
      setActiveProfileCookie(profile.id)
    }
  }, [profile?.id, profile?.name, setActiveProfile])

  const [showModal, setShowModal] = useState(false)
  const [editLogId, setEditLogId] = useState<string | undefined>(undefined)

  const openNewLog = useCallback(() => {
    setEditLogId(undefined)
    setShowModal(true)
  }, [])

  const closeModal = useCallback(() => setShowModal(false), [])

  // ── Check-in modal ───────────────────────────────────────────────────────
  const [checkInOpen, setCheckInOpen] = useState(false)

  // The arbiter decides whether the check-in auto-opens (once per local day per profile).
  useAutoPromptCandidate('check-in', checkInCandidateState(engagement), { scope: activeProfileId })
  const trialLocked = prompt.locked
  const closeAutoCheckIn = prompt.close
  useEffect(() => () => closeAutoCheckIn('check-in'), [closeAutoCheckIn])
  const checkInIsOpen = !prompt.locked && (checkInOpen || prompt.isActive('check-in'))

  // ── Part C: Quick symptom modal ──────────────────────────────────────────
  const [showQuickSymptom, setShowQuickSymptom] = useState(false)
  const openQuickSymptom = useCallback(() => setShowQuickSymptom(true), [])

  // ── Part D: Celebration toast (shown after the source pop-up closes) ──────
  const toast = useToast()

  const handleSaved = useCallback(() => {
    // Trigger a server re-render to pick up updated data
    router.refresh()
    toast.celebrate('period')
  }, [router, toast])

  // ── App-wide alert integration: open period-log modal on request ──────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    // Nothing opens over the trial lock.
    if (trialLocked) return
    if (sessionStorage.getItem('vesta_open_period_log') === '1') {
      sessionStorage.removeItem('vesta_open_period_log')
      openNewLog()
    }
    const handler = () => openNewLog()
    window.addEventListener('vesta:open-period-log', handler)
    return () => window.removeEventListener('vesta:open-period-log', handler)
  }, [openNewLog, trialLocked])

  // Guard: no profile found
  if (!profile) {
    return (
      <PageContainer width="wide">
        <PageHeader title={t('nav.dashboard')} />
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-[var(--color-text-muted)]">{t('dashboard.noProfileFound')}</p>
          <Link href="/profiles">
            <Button variant="primary">{t('dashboard.setUpProfile')}</Button>
          </Link>
        </div>
      </PageContainer>
    )
  }

  // ── Derive cycle data ──────────────────────────────────────────────────────

  // Build a UserProfile-compatible shape for computePrediction
  const profileForCompute = {
    id: profile.id,
    userId: profile.userId,
    name: profile.name,
    relation: profile.relation as ProfileRelation,
    cycleLength: profile.cycleLength,
    periodLength: profile.periodLength,
    lastPeriodStart: profile.lastPeriodStart ? toDateString(profile.lastPeriodStart) : '',
    cycleHistory: [] as number[],
    predictionTier: 'average' as const,
    createdAt: toDateString(profile.createdAt),
  }

  const cycleDay =
    dashboardData?.currentCycleDay ??
    getCurrentCycleDay(profileForCompute.lastPeriodStart, profile.cycleLength)

  const rawPhase =
    dashboardData?.currentPhase ??
    getCurrentPhase(cycleDay, profile.periodLength, profile.cycleLength)

  const phase = normalizeCyclePhase(String(rawPhase ?? 'menstrual'))
  const phaseColor = getPhaseColor(phase)
  const phaseEmoji = getPhaseEmoji(phase)

  const daysUntilNext =
    dashboardData?.countdownToNextPeriod ??
    getDaysUntilNextPeriod(cycleDay, profile.cycleLength)

  const isPeriodLate = (daysUntilNext ?? 0) < 0
  const daysLate = Math.abs(daysUntilNext ?? 0)

  // Pregnancy detection — mode flag from service takes priority; goal string is the fallback
  const pregnancy = dashboardData?.mode === 'pregnancy' || isPregnancy(goal)

  // Build prediction object for display (suppressed entirely in pregnancy mode)
  const serverPrediction = dashboardData?.prediction
  const localPrediction = pregnancy ? null : computePrediction(profileForCompute)

  const prediction = serverPrediction
    ? {
        nextPeriodStart: toDateString(serverPrediction.nextPeriodStart),
        ovulationDay: toDateString(serverPrediction.ovulationDay),
        fertileStart: toDateString(serverPrediction.fertileStart),
        fertileEnd: toDateString(serverPrediction.fertileEnd),
        confidence: Math.round(serverPrediction.confidence * 100),
        tier: serverPrediction.tier as 'average' | 'arima',
      }
    : localPrediction

  const lastPeriodDisplay = dashboardData?.lastPeriod
    ? {
        startDate: toDateString(dashboardData.lastPeriod.startDate),
        duration: dashboardData.lastPeriod.duration,
        flowIntensity: normalizeFlow(dashboardData.lastPeriod.flowIntensity),
      }
    : profile.lastPeriodStart
      ? {
          startDate: toDateString(profile.lastPeriodStart),
          duration: profile.periodLength,
          flowIntensity: 'medium' as FlowIntensity,
        }
      : null

  // ── Nudge data ──────────────────────────────────────────────────────────────

  const lastPeriodDate: Date | null = dashboardData?.lastPeriod?.startDate
    ? new Date(dashboardData.lastPeriod.startDate)
    : null
  const lastSymptomDate: Date | null = lastSymptomLogDate
    ? new Date(lastSymptomLogDate)
    : null

  const hasAnyLogs = !!lastPeriodDate || !!lastSymptomDate

  const daysSinceLastLog = daysSinceLastLogFor(
    [lastPeriodDate, lastSymptomDate].filter((d): d is Date => d !== null),
  )

  // Confidence tier label (only relevant when a prediction exists)
  const tierLabel = prediction?.tier === 'arima' ? t('dashboard.tierArima') : t('dashboard.tierAverage')
  const phaseLabel = t(`dashboard.${phase}`)

  return (
    <>
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10" aria-hidden="true">
        <motion.div
          className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, var(--goal-accent) 0%, transparent 70%)' }}
          animate={prefersReducedMotion ? {} : { x: [0, 15, 0], y: [0, -10, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, var(--color-secondary) 0%, transparent 70%)' }}
          animate={prefersReducedMotion ? {} : { x: [0, -10, 0], y: [0, 12, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <PageContainer
        width="wide"
        style={{ ['--goal-accent' as string]: goalAccentVar(goal) } as React.CSSProperties}
      >
        <PageHeader title={t('nav.dashboard')} subtitle={profile.name} />
        <CompletionRow status={completion} />
        {pregnancy ? (
          <>
            {/* ── Pregnancy: Coming Soon Panel ───────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              style={
                {
                  ['--goal-accent' as string]: goalAccentVar(goal),
                } as React.CSSProperties
              }
            >
              <Card
                padding="md"
                className="glass shadow-soft flex flex-col items-center text-center gap-5 py-8 px-6 rounded-2xl"
                style={{
                  borderColor: 'var(--goal-accent)',
                  boxShadow: '0 0 0 1.5px var(--goal-accent), 0 8px 32px color-mix(in srgb, var(--goal-accent) 18%, transparent)',
                }}
              >
                {/* Animated Baby icon */}
                <motion.div
                  animate={
                    prefersReducedMotion
                      ? {}
                      : { scale: [1, 1.07, 1], opacity: [1, 0.85, 1] }
                  }
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="flex items-center justify-center w-16 h-16 rounded-full"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--goal-accent) 14%, transparent)' }}
                >
                  <Baby
                    size={36}
                    aria-hidden="true"
                    style={{ color: 'var(--goal-accent)' }}
                  />
                </motion.div>

                <div className="flex flex-col gap-2">
                  <h2
                    className="text-lg font-bold"
                    style={{ color: 'var(--goal-accent)' }}
                  >
                    {t('dashboard.pregnancyComingSoonTitle')}
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)] max-w-xs">
                    {t('dashboard.pregnancyComingSoonBody')}
                  </p>
                </div>

                <Link
                  href="/symptoms"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border font-semibold text-sm transition-colors focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)] focus-visible:outline-none"
                  style={{
                    borderColor: 'var(--goal-accent)',
                    color: 'var(--goal-accent)',
                    backgroundColor: 'color-mix(in srgb, var(--goal-accent) 10%, transparent)',
                  }}
                >
                  <Activity size={14} aria-hidden="true" />
                  {t('dashboard.logSymptoms')}
                </Link>
              </Card>
            </motion.div>

            {/* ── Today Check-In Strip (pregnancy) ──────────────── */}
            {engagement && (
              <TodayCheckInStrip
                profileId={activeProfileId}
                engagement={engagement}
                goal={goal}
                onOpenCheckIn={() => setCheckInOpen(true)}
              />
            )}

            {/* ── Logging Nudge (kept in pregnancy) ──────────────── */}
            <LoggingNudge
              profileId={activeProfileId}
              hasAnyLogs={hasAnyLogs}
              daysSinceLastLog={daysSinceLastLog}
              goal={goal}
              onLogPeriod={openNewLog}
              phase={dashboardData?.currentPhase ?? null}
            />

            {/* ── Last Period Card (history — kept in pregnancy) ── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 100, damping: 20 }}
            >
              <Card padding="md" className="!border-0 shadow-soft">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <Droplets size={14} style={{ color: 'var(--goal-accent)' }} aria-hidden="true" />
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                      {t('dashboard.lastPeriod')}
                    </span>
                  </div>
                  {lastPeriodDisplay ? (
                    <>
                      <p className="text-sm font-bold text-[var(--color-text-primary)]">
                        {new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : undefined, { month: 'short', day: 'numeric' }).format(parseISO(lastPeriodDisplay.startDate))}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {t('dashboard.durationDays', { count: lastPeriodDisplay.duration })}
                      </p>
                      <div
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold self-start"
                        style={{ backgroundColor: FLOW_COLORS[lastPeriodDisplay.flowIntensity], color: FLOW_TEXT[lastPeriodDisplay.flowIntensity] }}
                      >
                        🩸 {t(`dashboard.flow${capitalize(lastPeriodDisplay.flowIntensity)}`)}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">{t('dashboard.noLogsYet')}</p>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* ── Quick Log button (kept in pregnancy) ─────────── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 100, damping: 20 }}
            >
              <Card padding="md" className="!border-0 shadow-soft">
                <div className="flex flex-col gap-2.5">
                  <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    {t('dashboard.quickActions')}
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    fullWidth
                    onClick={openNewLog}
                    className="text-xs"
                    data-tour="log-button"
                  >
                    🩸 {t('dashboard.logPeriod')}
                  </Button>
                </div>
              </Card>
            </motion.div>
          </>
        ) : (
          <>
            {/* ── Hero Section ─────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="surface-wash rounded-3xl flex flex-col items-center lg:flex-row lg:items-start lg:gap-8 p-5 md:p-6"
            >
              <CycleRing
                cycleDay={cycleDay}
                cycleLength={profile.cycleLength}
                phase={phase}
                phaseColor={phaseColor}
                isLate={isPeriodLate}
                daysLate={daysLate}
              />

              {/* Right column: check-in strip + compact phase/day */}
              <div className="mt-4 lg:mt-0 w-full lg:flex-1 lg:self-center grid gap-4 xl:grid-cols-2 xl:items-center">
                {engagement && (
                  <TodayCheckInStrip
                    variant="hero"
                    profileId={activeProfileId}
                    engagement={engagement}
                    goal={goal}
                    onOpenCheckIn={() => setCheckInOpen(true)}
                  />
                )}
                {/* Phase panel (or prominent late button) fills the right half */}
                {isPeriodLate ? (
                  <button
                    type="button"
                    onClick={openNewLog}
                    className="self-start flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-menstrual)] cursor-pointer"
                    style={{ backgroundColor: 'var(--color-menstrual)', color: 'var(--color-on-menstrual)' }}
                    aria-label={t('dashboard.periodLateOpenPrompt')}
                  >
                    <span aria-hidden="true">🩸</span>
                    <span>{t('dashboard.periodLate')} · {t('dashboard.daysOverdue', { count: daysLate })}</span>
                  </button>
                ) : (
                  <div
                    data-testid="hero-phase-panel"
                    className="rounded-2xl p-4 flex flex-col gap-2 bg-[var(--color-bg-secondary)]"
                  >
                    <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                      <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: phaseColor }} />
                      <span>{t('dashboard.dayOf', { day: cycleDay, total: profile.cycleLength })}</span>
                    </div>
                    <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                      <span aria-hidden="true">{phaseEmoji}</span> {phaseLabel}
                    </p>
                    {daysUntilNext != null && (
                      <p className="text-sm text-[var(--color-text-secondary)] tabular-nums">
                        {t('dashboard.nextPeriodCard')} · <span className="font-semibold text-[var(--color-text-primary)]">{Math.abs(daysUntilNext)}</span> {t('dashboard.daysAway', { count: Math.abs(daysUntilNext) })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>

            {/* ── Logging Nudge ──────────────────────────────────────── */}
            <LoggingNudge
              profileId={activeProfileId}
              hasAnyLogs={hasAnyLogs}
              daysSinceLastLog={daysSinceLastLog}
              goal={goal}
              onLogPeriod={openNewLog}
              phase={dashboardData?.currentPhase ?? null}
            />

            {/* ── Cards Grid ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">

              {/* Countdown Card */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 100, damping: 20 }}
              >
                <Card padding="md" className="h-full !border-0 shadow-soft">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays
                        size={14}
                        style={{ color: isPeriodLate ? 'var(--color-menstrual)' : 'var(--goal-accent)' }}
                        aria-hidden="true"
                      />
                      <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                        {(daysUntilNext ?? 0) < 0 ? t('dashboard.periodLate') : t('dashboard.nextPeriodCard')}
                      </span>
                    </div>
                    <div
                      className="text-4xl font-extrabold leading-none tabular-nums"
                      style={{ color: (daysUntilNext ?? 0) < 0 ? 'var(--color-menstrual)' : 'var(--goal-accent)' }}
                    >
                      {Math.abs(daysUntilNext ?? 0)}
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {(daysUntilNext ?? 0) < 0
                        ? t('dashboard.daysLate', { count: Math.abs(daysUntilNext ?? 0) })
                        : t('dashboard.daysAway', { count: Math.abs(daysUntilNext ?? 0) })}
                    </p>

                    {/* Mini bar */}
                    <div className="h-1.5 rounded-full bg-[var(--color-border)] mt-1 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: (daysUntilNext ?? 0) < 0 ? 'var(--color-menstrual)' : 'var(--goal-accent)' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, ((profile.cycleLength - Math.max(0, daysUntilNext ?? 0)) / profile.cycleLength) * 100)}%` }}
                        transition={{ delay: 0.6, duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>

                    {prediction && (
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : undefined, { month: 'short', day: 'numeric' }).format(parseISO(prediction.nextPeriodStart))}
                      </p>
                    )}
                  </div>
                </Card>
              </motion.div>

              {/* Last Period Card */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, type: 'spring', stiffness: 100, damping: 20 }}
              >
                <Card padding="md" className="h-full !border-0 shadow-soft">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5">
                      <Droplets size={14} style={{ color: 'var(--goal-accent)' }} aria-hidden="true" />
                      <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                        {t('dashboard.lastPeriod')}
                      </span>
                    </div>
                    {lastPeriodDisplay ? (
                      <>
                        <p className="text-sm font-bold text-[var(--color-text-primary)]">
                          {new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : undefined, { month: 'short', day: 'numeric' }).format(parseISO(lastPeriodDisplay.startDate))}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {t('dashboard.durationDays', { count: lastPeriodDisplay.duration })}
                        </p>
                        <div
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold self-start"
                          style={{ backgroundColor: FLOW_COLORS[lastPeriodDisplay.flowIntensity], color: FLOW_TEXT[lastPeriodDisplay.flowIntensity] }}
                        >
                          🩸 {t(`dashboard.flow${capitalize(lastPeriodDisplay.flowIntensity)}`)}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">{t('dashboard.noLogsYet')}</p>
                    )}
                  </div>
                </Card>
              </motion.div>

              {/* Confidence Card */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.26, type: 'spring', stiffness: 100, damping: 20 }}
              >
                <Card padding="md" className="h-full !border-0 shadow-soft">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                      {t('dashboard.confidence')}
                    </span>
                    <div className="flex items-end gap-1">
                      <span
                        className="text-4xl font-extrabold"
                        style={{ color: 'var(--goal-accent)' }}
                      >
                        {prediction?.confidence ?? '—'}
                      </span>
                      {prediction && (
                        <span className="text-lg font-bold text-[var(--color-text-muted)] mb-0.5">%</span>
                      )}
                    </div>

                    {/* Confidence arc */}
                    <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: 'var(--goal-accent)' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${prediction?.confidence ?? 0}%` }}
                        transition={{ delay: 0.8, duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>

                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] self-start">
                      <span className="text-[11px] font-semibold" style={{ color: 'var(--goal-accent)' }}>
                        {tierLabel}
                      </span>
                    </div>
                  </div>
                </Card>
              </motion.div>

              {/* Quick Actions Card */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.34, type: 'spring', stiffness: 100, damping: 20 }}
              >
                <Card padding="md" className="h-full !border-0 shadow-soft">
                  <div className="flex flex-col gap-2.5 h-full">
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                      {t('dashboard.quickActions')}
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      fullWidth
                      onClick={openNewLog}
                      className={`text-xs ${isPeriodLate ? 'animate-attn-blink-danger' : ''}`}
                      data-tour="log-button"
                    >
                      🩸 {t('dashboard.logPeriod')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      fullWidth
                      onClick={openQuickSymptom}
                      className="text-xs gap-1.5 whitespace-nowrap px-2"
                    >
                      <Activity size={12} style={{ color: 'var(--goal-accent)' }} aria-hidden="true" />
                      {t('dashboard.logSymptoms')}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            </div>

            {/* ── Progress to Unlock Meter ──────────────────────────── */}
            {engagement && (
              <ProgressToUnlockMeter
                cyclesLogged={engagement.cyclesLogged}
                unlockTarget={engagement.unlockTarget}
                confidence={engagement.confidence}
                tier={engagement.tier}
                periodLogCount={engagement.periodLogCount}
              />
            )}

            {/* ── Cycle Phase Overview + Predicted Windows ─────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.45 }}
              >
                <Card padding="md" className="h-full !border-0 shadow-soft">
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-3">
                    {t('dashboard.cycleOverview')}
                  </h3>
                  <div className="flex gap-1.5">
                    {(
                      [
                        { ph: 'menstrual', labelKey: 'dashboard.menstrual', days: profile.periodLength },
                        { ph: 'follicular', labelKey: 'dashboard.follicular', days: profile.cycleLength - 14 - profile.periodLength - 5 },
                        { ph: 'ovulation', labelKey: 'dashboard.ovulation', days: 6 },
                        { ph: 'luteal', labelKey: 'dashboard.luteal', days: 14 },
                      ] as const
                    ).map(({ ph, labelKey, days }) => {
                      const isActive = ph === phase
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const color = getPhaseColor(ph as any)
                      return (
                        <div
                          key={ph}
                          className="flex-1 rounded-lg px-1 py-2 md:py-3 flex flex-col items-center gap-1 transition-colors"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${color} 13%, transparent)`,
                            outline: isActive ? `2px solid ${color}` : 'none',
                          }}
                        >
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          <span className="text-base md:text-lg">{getPhaseEmoji(ph as any)}</span>
                          <span className="text-[11px] md:text-xs font-bold text-center leading-tight text-[var(--color-text-primary)] inline-flex items-center gap-1">
                            <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            {t(labelKey)}
                          </span>
                          <span className="text-[11px] md:text-xs text-[var(--color-text-secondary)] tabular-nums">{t('common.daysShort', { count: days })}</span>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              </motion.div>

              {prediction && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.52, duration: 0.45 }}
                >
                  <Card padding="md" className="h-full !border-0 shadow-soft">
                    <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-3">
                      {t('dashboard.predictedWindows')}
                    </h3>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-[var(--color-bg-secondary)]">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-fertile)' }} />
                          <span className="text-xs font-medium text-[var(--color-text-secondary)]">{t('dashboard.fertileWindow')}</span>
                        </div>
                        <span className="text-xs font-bold text-[var(--color-text-primary)]">
                          {new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : undefined, { month: 'short', day: 'numeric' }).format(parseISO(prediction.fertileStart))}
                          {' – '}
                          {new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : undefined, { month: 'short', day: 'numeric' }).format(parseISO(prediction.fertileEnd))}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-[var(--color-bg-secondary)]">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-ovulation)' }} />
                          <span className="text-xs font-medium text-[var(--color-text-secondary)]">{t('dashboard.ovulationDay')}</span>
                        </div>
                        <span className="text-xs font-bold text-[var(--color-text-primary)]">
                          {new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : undefined, { month: 'short', day: 'numeric' }).format(parseISO(prediction.ovulationDay))}
                        </span>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )}
            </div>
          </>
        )}
      </PageContainer>

      {/* ── Period Log Modal ──────────────────────────────────── */}
      <PeriodLogModal
        open={showModal}
        profileId={profile.id}
        existingLogId={editLogId}
        initialFlow="medium"
        onClose={closeModal}
        onSaved={handleSaved}
      />

      {/* ── Part C: Quick Symptom Modal ───────────────────────── */}
      <QuickSymptomModal
        open={showQuickSymptom}
        onClose={() => setShowQuickSymptom(false)}
        profileId={profile.id}
        goal={goal}
        onSaved={(count) => {
          setShowQuickSymptom(false)
          if (count > 0) toast.celebrate('symptom', count)
        }}
      />

      {/* ── Check-In Modal ───────────────────────────────────── */}
      {engagement && (
        <TodayCheckInModal
          open={checkInIsOpen}
          layer={!checkInOpen && prompt.isActive('check-in') ? 'prompt' : 'popup'}
          onClose={() => {
            setCheckInOpen(false)
            prompt.close('check-in')
          }}
          profileId={activeProfileId}
          goal={goal}
          engagement={engagement}
          cycleDay={pregnancy ? null : cycleDay}
          phase={pregnancy ? null : phase}
        />
      )}

    </>
  )
}
