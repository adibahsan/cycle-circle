'use client'

import { useState, useCallback, useTransition, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { parseISO } from 'date-fns'
import Link from 'next/link'
import { X, CalendarDays, Activity, ChevronRight, Droplets } from 'lucide-react'

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
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  createPeriodLog,
  updatePeriodLog,
} from '@/app/actions/tracking-actions'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  currentCycleDay: number
  currentPhase: string
  countdownToNextPeriod: number | null
  lastPeriod: {
    startDate: Date
    duration: number
    flowIntensity: string
  } | null
  prediction: PrismaPrediction | null
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

/** UI FlowIntensity -> Prisma enum */
function toActionFlow(f: FlowIntensity): 'LIGHT' | 'MEDIUM' | 'HEAVY' {
  return f.toUpperCase() as 'LIGHT' | 'MEDIUM' | 'HEAVY'
}

const FLOW_LABELS: Record<FlowIntensity, string> = {
  light: 'Light',
  medium: 'Medium',
  heavy: 'Heavy',
}

const FLOW_COLORS: Record<FlowIntensity, string> = {
  light: '#F2728E',
  medium: '#E8476C',
  heavy: '#C93558',
}

// ─── Circular Progress ────────────────────────────────────────────────────────

function CycleRing({
  cycleDay,
  cycleLength,
  phase,
  phaseColor,
}: {
  cycleDay: number
  cycleLength: number
  phase: string
  phaseColor: string
}) {
  const { t } = useTranslation()
  const SIZE = 220
  const STROKE = 16
  const RADIUS = (SIZE - STROKE) / 2
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  const progress = cycleDay / cycleLength
  const offset = CIRCUMFERENCE * (1 - progress)

  return (
    <div className="relative flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
      {/* Track ring */}
      <svg
        width={SIZE}
        height={SIZE}
        className="absolute rotate-[-90deg]"
        style={{ filter: 'drop-shadow(0 4px 24px rgba(232,71,108,0.12))' }}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={STROKE}
        />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={phaseColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          filter="url(#glow)"
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
          style={{ color: phaseColor }}
        >
          {cycleDay}
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-sm font-medium text-[var(--color-text-muted)] tracking-widest uppercase"
        >
          {t('dashboard.day')}
        </motion.div>
      </motion.div>
    </div>
  )
}

// ─── Period Logging Modal ─────────────────────────────────────────────────────

interface LogModalProps {
  profileId: string
  existingLogId?: string
  initialStart?: string
  initialEnd?: string
  initialFlow?: FlowIntensity
  onClose: () => void
  onSaved: () => void
}

function PeriodLogModal({
  profileId,
  existingLogId,
  initialStart = '',
  initialEnd = '',
  initialFlow = 'medium',
  onClose,
  onSaved,
}: LogModalProps) {
  const { t } = useTranslation()
  const [startDate, setStartDate] = useState(initialStart)
  const [endDate, setEndDate] = useState(initialEnd)
  const [flow, setFlow] = useState<FlowIntensity>(initialFlow)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  const isEdit = Boolean(existingLogId)

  const handleSave = () => {
    if (!startDate || !endDate) return
    startTransition(async () => {
      try {
        if (isEdit && existingLogId) {
          await updatePeriodLog(existingLogId, {
            startDate,
            endDate,
            flowIntensity: toActionFlow(flow),
          })
        } else {
          await createPeriodLog({
            profileId,
            startDate,
            endDate,
            flowIntensity: toActionFlow(flow),
          })
        }
        setSaved(true)
        onSaved()
        setTimeout(onClose, 700)
      } catch (err) {
        console.error('Failed to save period log:', err)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose} onKeyDown={handleKeyDown}>
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? t('dashboard.editPeriodLog') : t('dashboard.logPeriod')}
        className="relative w-full max-w-md bg-[var(--color-bg-card)] rounded-t-3xl px-5 py-6 shadow-2xl"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--color-border)]" />

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            {isEdit ? t('dashboard.editPeriodLog') : t('dashboard.logPeriod')}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <X size={18} className="text-[var(--color-text-muted)]" aria-hidden="true" />
          </button>
        </div>

        {/* Start date */}
        <div className="mb-4">
          <label htmlFor="period-start-date" className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
            {t('dashboard.startDate')}
          </label>
          <input
            id="period-start-date"
            name="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-sm focus-visible:outline-none focus:border-[var(--color-primary)] transition-colors"
          />
        </div>

        {/* End date */}
        <div className="mb-5">
          <label htmlFor="period-end-date" className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
            {t('dashboard.endDate')}
          </label>
          <input
            id="period-end-date"
            name="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
            max={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-sm focus-visible:outline-none focus:border-[var(--color-primary)] transition-colors"
          />
        </div>

        {/* Flow intensity */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-2.5 uppercase tracking-wider">
            {t('dashboard.flowIntensity')}
          </label>
          <div className="flex gap-2">
            {(['light', 'medium', 'heavy'] as FlowIntensity[]).map((f) => (
              <button
                key={f}
                onClick={() => setFlow(f)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                  flow === f
                    ? 'text-white shadow-soft'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)]'
                }`}
                style={
                  flow === f
                    ? { backgroundColor: FLOW_COLORS[f], borderColor: FLOW_COLORS[f] }
                    : {}
                }
              >
                <span className="mr-1">
                  {f === 'light' ? '💧' : f === 'medium' ? '🩸' : '🌊'}
                </span>
                {FLOW_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Save */}
        <div aria-live="polite">
        <AnimatePresence mode="wait">
          {saved ? (
            <motion.div
              key="saved"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full py-3 rounded-xl bg-green-100 text-green-700 text-center font-semibold"
            >
              {t('dashboard.saved')}
            </motion.div>
          ) : (
            <motion.div key="save-btn">
              <Button
                variant="primary"
                fullWidth
                size="lg"
                onClick={handleSave}
                disabled={!startDate || !endDate || isPending}
              >
                {isPending ? t('common.loading') : isEdit ? t('dashboard.updateLog') : t('dashboard.savePeriod')}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Dashboard Client ─────────────────────────────────────────────────────────

export function DashboardClient({ profiles, user: _user, activeProfileId, dashboardData }: Props) {
  const { t } = useTranslation()
  const router = useRouter()
  const { activeProfileId: storeProfileId, setActiveProfile, language } = useAppStore()
  const prefersReducedMotion = useReducedMotion()

  // Determine the effective profile: prefer the one passed from server, but
  // allow the store's value to override on the client after hydration.
  const effectiveProfileId = storeProfileId || activeProfileId
  const profile = profiles.find((p) => p.id === effectiveProfileId) ?? profiles[0]

  const [showModal, setShowModal] = useState(false)
  const [editLogId, setEditLogId] = useState<string | undefined>(undefined)

  const openNewLog = useCallback(() => {
    setEditLogId(undefined)
    setShowModal(true)
  }, [])

  const closeModal = useCallback(() => setShowModal(false), [])

  const handleSaved = useCallback(() => {
    // Trigger a server re-render to pick up updated data
    router.refresh()
  }, [router])

  // Guard: no profile found
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-[var(--color-text-muted)]">{t('dashboard.noProfileFound')}</p>
        <Link href="/profiles">
          <Button variant="primary">{t('dashboard.setUpProfile')}</Button>
        </Link>
      </div>
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

  const phase = normalizeCyclePhase(String(rawPhase))
  const phaseColor = getPhaseColor(phase)
  const phaseEmoji = getPhaseEmoji(phase)

  const daysUntilNext =
    dashboardData?.countdownToNextPeriod ??
    getDaysUntilNextPeriod(cycleDay, profile.cycleLength)

  // Build prediction object for display
  const serverPrediction = dashboardData?.prediction
  const localPrediction = computePrediction(profileForCompute)

  const prediction = serverPrediction
    ? {
        nextPeriodStart: toDateString(serverPrediction.nextPeriodStart),
        ovulationDay: toDateString(serverPrediction.ovulationDay),
        fertileStart: toDateString(serverPrediction.fertileStart),
        fertileEnd: toDateString(serverPrediction.fertileEnd),
        confidence: Math.round(serverPrediction.confidence),
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

  // Confidence tier label
  const tierLabel = prediction.tier === 'arima' ? 'Tier 2 · ARIMA' : 'Tier 1 · Average'
  const phaseLabel = t(`dashboard.${phase}`)

  return (
    <>
      {/* Background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10" aria-hidden="true">
        <motion.div
          className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)' }}
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

      <div className="flex flex-col gap-5 py-3">

        {/* ── Hero Section ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center md:flex-row md:items-center md:gap-8 pt-4 pb-2"
        >
          <CycleRing
            cycleDay={cycleDay}
            cycleLength={profile.cycleLength}
            phase={phase}
            phaseColor={phaseColor}
          />

          {/* Phase label */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.4 }}
            className="mt-4 flex flex-col items-center gap-1"
          >
            <div
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-white text-sm font-semibold shadow-soft"
              style={{ backgroundColor: phaseColor }}
            >
              <span>{phaseEmoji}</span>
              <span>{phaseLabel} Phase</span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {t('dashboard.dayOf', { day: cycleDay, total: profile.cycleLength })}
            </p>
          </motion.div>
        </motion.div>

        {/* ── Cards Grid ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">

          {/* Countdown Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 100, damping: 20 }}
          >
            <Card padding="md" className="h-full">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <CalendarDays size={14} className="text-[var(--color-primary)]" aria-hidden="true" />
                  <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    {t('dashboard.nextPeriodCard')}
                  </span>
                </div>
                <div
                  className="text-4xl font-extrabold leading-none tabular-nums"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {daysUntilNext}
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">{t('dashboard.daysAway')}</p>

                {/* Mini bar */}
                <div className="h-1.5 rounded-full bg-[var(--color-border)] mt-1 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${((profile.cycleLength - (daysUntilNext ?? 0)) / profile.cycleLength) * 100}%` }}
                    transition={{ delay: 0.6, duration: 0.8, ease: 'easeOut' }}
                  />
                </div>

                <p className="text-[10px] text-[var(--color-text-muted)]">
                  {new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : undefined, { month: 'short', day: 'numeric' }).format(parseISO(prediction.nextPeriodStart))}
                </p>
              </div>
            </Card>
          </motion.div>

          {/* Last Period Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, type: 'spring', stiffness: 100, damping: 20 }}
          >
            <Card padding="md" className="h-full">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <Droplets size={14} className="text-[var(--color-primary)]" aria-hidden="true" />
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
                      {lastPeriodDisplay.duration}d duration
                    </p>
                    <div
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white self-start"
                      style={{ backgroundColor: FLOW_COLORS[lastPeriodDisplay.flowIntensity] }}
                    >
                      🩸 {capitalize(lastPeriodDisplay.flowIntensity)}
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
            <Card padding="md" className="h-full">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  {t('dashboard.confidence')}
                </span>
                <div className="flex items-end gap-1">
                  <span
                    className="text-4xl font-extrabold"
                    style={{ color: 'var(--color-secondary)' }}
                  >
                    {prediction.confidence}
                  </span>
                  <span className="text-lg font-bold text-[var(--color-text-muted)] mb-0.5">%</span>
                </div>

                {/* Confidence arc */}
                <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: 'var(--color-secondary)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${prediction.confidence}%` }}
                    transition={{ delay: 0.8, duration: 0.8, ease: 'easeOut' }}
                  />
                </div>

                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] self-start">
                  <span className="text-[10px] font-semibold text-[var(--color-secondary)]">
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
            <Card padding="md" className="h-full">
              <div className="flex flex-col gap-2.5 h-full">
                <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  {t('dashboard.quickActions')}
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  onClick={openNewLog}
                  className="text-xs"
                >
                  🩸 {t('dashboard.logPeriod')}
                </Button>
                <Link href="/symptoms" className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-secondary)] transition-colors">
                  <div className="flex items-center gap-1.5">
                    <Activity size={12} className="text-[var(--color-secondary)]" aria-hidden="true" />
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                      {t('dashboard.logSymptoms')}
                    </span>
                  </div>
                  <ChevronRight size={12} className="text-[var(--color-text-muted)]" aria-hidden="true" />
                </Link>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* ── Cycle Phase Overview + Predicted Windows ─────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.45 }}
          >
            <Card padding="md" className="h-full">
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
                      className={`flex-1 rounded-lg px-1 py-2 md:py-3 flex flex-col items-center gap-1 transition-all ${
                        isActive ? 'ring-2' : ''
                      }`}
                      style={{
                        backgroundColor: `${color}20`,
                        outline: isActive ? `2px solid ${color}` : 'none',
                      }}
                    >
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      <span className="text-base md:text-lg">{getPhaseEmoji(ph as any)}</span>
                      <span
                        className="text-[9px] md:text-[11px] font-bold text-center leading-tight"
                        style={{ color }}
                      >
                        {t(labelKey)}
                      </span>
                      <span className="text-[9px] md:text-[10px] text-[var(--color-text-muted)]">{days}d</span>
                    </div>
                  )
                })}
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.52, duration: 0.45 }}
          >
            <Card padding="md" className="h-full">
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
        </div>
      </div>

      {/* ── Period Log Modal ──────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <PeriodLogModal
            key="log-modal"
            profileId={profile.id}
            existingLogId={editLogId}
            initialFlow="medium"
            onClose={closeModal}
            onSaved={handleSaved}
          />
        )}
      </AnimatePresence>
    </>
  )
}
