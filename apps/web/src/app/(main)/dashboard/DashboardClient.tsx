'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'

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
import { PeriodLogModal } from '@/components/PeriodLogModal'
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
import { deviceDayString } from '@/lib/local-date'
import { CycleHero, FirstPeriodHero, MenopauseHero, PregnancyHero } from './CycleHero'
import { CycleDates, type LastPeriodFacts } from './CycleDates'
import { CycleJourney } from './CycleJourney'
import { CycleProgressRing } from './CycleProgressRing'
import { DashboardToolkit, type PhaseArticle } from './DashboardToolkit'
import { EXAMPLE_CYCLE, type CyclePosition, calendarDay, dashboardBlocks, dashboardHeroState, fertileStatus, periodStatus } from './dashboard-model'

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
    lastPeriodStart: profile.lastPeriodStart ? calendarDay(profile.lastPeriodStart) : '',
    cycleHistory: [] as number[],
    predictionTier: 'average' as const,
    createdAt: calendarDay(profile.createdAt),
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
  // No period on record (first run): nothing to predict from.
  const localPrediction = pregnancy || !profileForCompute.lastPeriodStart ? null : computePrediction(profileForCompute)

  const prediction = serverPrediction
    ? {
        nextPeriodStart: calendarDay(serverPrediction.nextPeriodStart),
        ovulationDay: calendarDay(serverPrediction.ovulationDay),
        fertileStart: calendarDay(serverPrediction.fertileStart),
        fertileEnd: calendarDay(serverPrediction.fertileEnd),
        confidence: Math.round(serverPrediction.confidence * 100),
        tier: serverPrediction.tier as 'average' | 'arima',
      }
    : localPrediction

  // Last period from the latest log; the profile's start date alone when nothing is logged (no invented length or flow).
  const lastPeriodDisplay: LastPeriodFacts | null = dashboardData?.lastPeriod
    ? {
        startDate: calendarDay(dashboardData.lastPeriod.startDate),
        days: dashboardData.lastPeriod.duration,
        flow: normalizeFlow(dashboardData.lastPeriod.flowIntensity),
      }
    : profile.lastPeriodStart
      ? { startDate: calendarDay(profile.lastPeriodStart), days: null, flow: null }
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
  const heroState = dashboardHeroState(dashboardData?.mode ?? 'standard', !!lastPeriodDisplay, pregnancy)
  const blocks = dashboardBlocks(heroState)
  const position: CyclePosition = { cycleLength: profile.cycleLength, periodLength: profile.periodLength, cycleDay, phase }

  return (
    <>
      <PageContainer
        width="wide"
        style={{ ['--goal-accent' as string]: goalAccentVar(goal) } as React.CSSProperties}
      >
        <PageHeader title={t('nav.dashboard')} subtitle={profile.name} />
        <CompletionRow status={completion} />

        {/* ── Hero: one per state ─────────────────────────────────── */}
        {heroState === 'pregnancy' ? (
          <PregnancyHero
            language={language}
            lastPeriodStart={lastPeriodDisplay?.startDate ?? null}
            onLogSymptoms={openQuickSymptom}
          />
        ) : heroState === 'menopause' ? (
          <MenopauseHero
            name={profile.name}
            language={language}
            today={deviceDayString()}
            lastPeriodStart={lastPeriodDisplay?.startDate ?? null}
          />
        ) : heroState === 'no-period' ? (
          <FirstPeriodHero onLogPeriod={openNewLog} />
        ) : (
          <CycleHero
            name={profile.name}
            language={language}
            phase={phase}
            cycleDay={cycleDay}
            fertile={fertile}
            period={period}
            nextPeriodDate={prediction?.nextPeriodStart ?? null}
          />
        )}

        {/* ── Logging Nudge ──────────────────────────────────────── */}
        <LoggingNudge
          profileId={activeProfileId}
          hasAnyLogs={hasAnyLogs}
          daysSinceLastLog={daysSinceLastLog}
          goal={goal}
          onLogPeriod={openNewLog}
          phase={blocks.phaseTools ? (dashboardData?.currentPhase ?? null) : null}
        />

        {/* ── Streak + Phase pattern (#75 fills the slot; it is the menopause symptom pattern too) ── */}
        {(engagement || (phasePattern && heroState !== 'pregnancy')) && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {engagement && (
              <TodayCheckInStrip
                profileId={activeProfileId}
                engagement={engagement}
                goal={goal}
                onOpenCheckIn={() => setCheckInOpen(true)}
              />
            )}
            {heroState !== 'pregnancy' && phasePattern}
          </div>
        )}

        {/* ── Cycle journey + progress ring (a dimmed example before the first period) ── */}
        {blocks.cycle === 'live' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CycleJourney position={position} language={language} />
            <CycleProgressRing
              position={position}
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
        )}
        {blocks.cycle === 'example' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CycleJourney example position={EXAMPLE_CYCLE} language={language} />
            <CycleProgressRing
              example
              position={EXAMPLE_CYCLE}
              period={null}
              language={language}
            />
          </div>
        )}

        {/* ── Last period + predicted windows (live cycle only, real data only) ── */}
        {blocks.cycleDates && (
          <CycleDates
            language={language}
            lastPeriod={lastPeriodDisplay}
            windows={
              prediction
                ? { fertileStart: prediction.fertileStart, fertileEnd: prediction.fertileEnd, ovulationDay: prediction.ovulationDay }
                : null
            }
          />
        )}

        {/* ── Toolkit (check-in, symptoms and articles stay in every mode) ── */}
        <DashboardToolkit
          language={language}
          phase={blocks.phaseTools ? phase : null}
          articles={phaseArticles}
          onLogPeriod={blocks.logPeriodTool ? openNewLog : null}
          onLogSymptoms={openQuickSymptom}
        />
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
          cycleDay={blocks.phaseTools ? cycleDay : null}
          phase={blocks.phaseTools ? phase : null}
        />
      )}

    </>
  )
}
