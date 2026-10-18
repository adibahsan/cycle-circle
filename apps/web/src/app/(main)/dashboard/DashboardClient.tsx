'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { parseISO } from 'date-fns'
import Link from 'next/link'
import { Activity, Droplets, Baby } from 'lucide-react'

import { useAppStore } from '@/lib/store'
import { useLanguage } from '@/lib/use-language'
import '@vesta/shared/utils/i18n'
import {
  getCurrentCycleDay,
  getCurrentPhase,
  getDaysUntilNextPeriod,
  computePrediction,
  normalizeCyclePhase,
} from '@vesta/shared/utils/cycle-utils'
import type { FlowIntensity, ProfileRelation } from '@vesta/shared/types'
import { isPregnancy, goalAccentVar } from '@vesta/shared/utils/goal'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FlowIcon } from '@/components/ui/PhaseIcon'
import { PeriodLogModal, FLOW_COLORS, FLOW_TEXT } from '@/components/PeriodLogModal'
import { setActiveProfileCookie } from '@/app/actions/profile-actions'
import type { ProfileCompletionStatus } from '@/lib/profile-completion'
import { CompletionRow } from '@/components/prompts/CompletionRow'
import { formatShortDate } from '@/lib/format-date'
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
import { deviceDayString } from '@/lib/local-date'
import { CycleHero } from './CycleHero'
import { CycleJourney } from './CycleJourney'
import { CycleProgressRing } from './CycleProgressRing'
import { DashboardToolkit, type PhaseArticle } from './DashboardToolkit'
import { dashboardHeroState, fertileStatus, periodStatus } from './dashboard-model'

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
  /** Published articles tagged with the current phase, for "Read for your phase". */
  phaseArticles?: PhaseArticle[]
  /** Slot for the Phase pattern card (#75), shown beside the streak. */
  phasePattern?: React.ReactNode
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

// ─── Dashboard Client ─────────────────────────────────────────────────────────

export function DashboardClient({ profiles, user: _user, activeProfileId, dashboardData, completion, lastSymptomLogDate, goal, engagement, phaseArticles = [], phasePattern }: Props) {
  const { t } = useTranslation()
  const router = useRouter()
  const setActiveProfile = useAppStore((s) => s.setActiveProfile)
  const language = useLanguage()
  const prompt = useAutoPrompt()

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
          <Link
            href="/profiles"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-action)] px-5 font-semibold text-[var(--color-on-action)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
          >
            {t('dashboard.setUpProfile')}
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

  const daysUntilNext =
    dashboardData?.countdownToNextPeriod ??
    getDaysUntilNextPeriod(cycleDay, profile.cycleLength)

  const period = periodStatus(daysUntilNext)

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

  const fertile = prediction ? fertileStatus(deviceDayString(), prediction.fertileStart, prediction.fertileEnd) : null
  // Pregnancy keeps its own panel; menopause and no-period still use the cycle layout until #76.
  const heroState = dashboardHeroState(dashboardData?.mode ?? 'standard', !!lastPeriodDisplay, pregnancy)

  return (
    <>
      <PageContainer
        width="wide"
        style={{ ['--goal-accent' as string]: goalAccentVar(goal) } as React.CSSProperties}
      >
        <PageHeader title={t('nav.dashboard')} subtitle={profile.name} />
        <CompletionRow status={completion} />
        {heroState === 'pregnancy' ? (
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
                style={{ borderColor: 'var(--goal-accent)' }}
              >
                {/* Baby icon */}
                <div
                  className="flex items-center justify-center w-16 h-16 rounded-full"
                  style={{ backgroundColor: 'color-mix(in srgb, var(--goal-accent) 14%, transparent)' }}
                >
                  <Baby
                    size={36}
                    aria-hidden="true"
                    style={{ color: 'var(--goal-accent)' }}
                  />
                </div>

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
                    <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                      {t('dashboard.lastPeriod')}
                    </span>
                  </div>
                  {lastPeriodDisplay ? (
                    <>
                      <p className="text-sm font-bold text-[var(--color-text-primary)]">
                        {formatShortDate(language, parseISO(lastPeriodDisplay.startDate))}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {t('dashboard.durationDays', { count: lastPeriodDisplay.duration })}
                      </p>
                      <div
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold self-start"
                        style={{ backgroundColor: FLOW_COLORS[lastPeriodDisplay.flowIntensity], color: FLOW_TEXT[lastPeriodDisplay.flowIntensity] }}
                      >
                        <FlowIcon flow={lastPeriodDisplay.flowIntensity} size={12} />
                        {t(`dashboard.flow${capitalize(lastPeriodDisplay.flowIntensity)}`)}
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
                  <span className="text-sm font-medium text-[var(--color-text-secondary)]">
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
                    <Droplets size={14} aria-hidden="true" />
                    {t('dashboard.logPeriod')}
                  </Button>
                </div>
              </Card>
            </motion.div>
          </>
        ) : (
          <>
            {/* ── Hero: split by state; #76 adds the menopause and no-period heroes ── */}
            <CycleHero
              name={profile.name}
              language={language}
              phase={phase}
              cycleDay={cycleDay}
              fertile={fertile}
              period={period}
              nextPeriodDate={prediction?.nextPeriodStart ?? null}
            />

            {/* ── Logging Nudge ──────────────────────────────────────── */}
            <LoggingNudge
              profileId={activeProfileId}
              hasAnyLogs={hasAnyLogs}
              daysSinceLastLog={daysSinceLastLog}
              goal={goal}
              onLogPeriod={openNewLog}
              phase={dashboardData?.currentPhase ?? null}
            />

            {/* ── Streak + Phase pattern (#75 fills the slot) ─────────── */}
            {(engagement || phasePattern) && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {engagement && (
                  <TodayCheckInStrip
                    profileId={activeProfileId}
                    engagement={engagement}
                    goal={goal}
                    onOpenCheckIn={() => setCheckInOpen(true)}
                  />
                )}
                {phasePattern}
              </div>
            )}

            {/* ── Cycle journey + progress ring ─────────────────────── */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <CycleJourney
                cycleLength={profile.cycleLength}
                periodLength={profile.periodLength}
                phase={phase}
                cycleDay={cycleDay}
                language={language}
              />
              <CycleProgressRing
                cycleDay={cycleDay}
                cycleLength={profile.cycleLength}
                phase={phase}
                period={period}
                language={language}
              >
                {/* The dashboard's one confidence figure. */}
                {engagement && (
                  <ProgressToUnlockMeter
                    className="mt-4"
                    cyclesLogged={engagement.cyclesLogged}
                    unlockTarget={engagement.unlockTarget}
                    confidence={engagement.confidence}
                    tier={engagement.tier}
                    periodLogCount={engagement.periodLogCount}
                  />
                )}
              </CycleProgressRing>
            </div>

            {/* ── Toolkit ─────────────────────────────────────────────── */}
            <DashboardToolkit
              language={language}
              phase={phase}
              articles={phaseArticles}
              onLogPeriod={openNewLog}
              onLogSymptoms={openQuickSymptom}
            />
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
