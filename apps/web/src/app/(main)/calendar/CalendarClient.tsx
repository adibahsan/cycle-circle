'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
} from 'date-fns'
import { bn } from 'date-fns/locale/bn'
import { ChevronLeft, ChevronRight, X, Pencil } from 'lucide-react'

import { Card } from '@/components/ui/Card'
import { useAppStore } from '@/lib/store'
import { SYMPTOMS_DATA } from '@/lib/symptoms-data'
import { PeriodLogModal } from '@/components/PeriodLogModal'
import { springSoft, popIn, useMotionSafe } from '@/lib/motion'
import type { FlowIntensity } from '@vesta/shared/types'
import '@vesta/shared/utils/i18n'

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

interface CalendarDay {
  date: string
  period: boolean
  fertile: boolean
  ovulation: boolean
  predicted: boolean
}

interface DayMeta {
  date: Date
  isPeriod: boolean
  isFertile: boolean
  isOvulation: boolean
  isFuturePredicted: boolean
}

interface SymptomLog {
  id: string
  profileId: string
  date: Date
  category: string
  symptomId: string
  value: string
}

interface PeriodLog {
  id: string
  profileId: string
  startDate: Date | string
  endDate: Date | string
  flowIntensity: string
  createdAt: Date | string
  updatedAt: Date | string
}

interface Props {
  profiles: PrismaProfile[]
  activeProfileId: string
  month: string
  days: CalendarDay[] | null
  symptomLogs: SymptomLog[]
  periodLogs: PeriodLog[]
}

// ─── Legend ───────────────────────────────────────────────────────────────────

interface LegendProps {
  /** The currently active phase chip to highlight with breathe animation. */
  activeLegendKey?: string
}

function Legend({ activeLegendKey }: LegendProps) {
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()

  const items = [
    { key: 'period', color: 'var(--color-menstrual)', label: t('calendar.period'), ring: false },
    { key: 'fertile', color: 'var(--color-fertile)', label: t('calendar.fertile'), ring: false },
    { key: 'ovulation', color: 'var(--color-ovulation)', label: t('calendar.ovulationDay'), ring: false },
    { key: 'today', color: 'var(--color-text-primary)', label: t('calendar.today'), ring: true },
  ]

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center">
      {items.map(({ key, color, label, ring }) => {
        const isActive = activeLegendKey === key
        return (
          <div
            key={key}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full transition-colors${isActive ? ' bg-phase-tint' : ''}`}
            style={isActive ? { ['--phase-color' as string]: color } : undefined}
          >
            {ring ? (
              <div
                className={`w-4 h-4 rounded-full border-2${isActive && !prefersReducedMotion ? ' animate-breathe' : ''}`}
                style={{ borderColor: 'var(--color-text-primary)' }}
                aria-hidden="true"
              />
            ) : (
              <div
                className={`w-4 h-4 rounded-full${isActive && !prefersReducedMotion ? ' animate-breathe' : ''}`}
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
            )}
            <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Day Cell ──────────────────────────────────────────────────────────────────

interface DayCellProps {
  meta: DayMeta
  isCurrentMonth: boolean
  isSelected: boolean
  onClick: () => void
}

function DayCell({ meta, isCurrentMonth, isSelected, onClick }: DayCellProps) {
  const { date, isPeriod, isFertile, isOvulation, isFuturePredicted } = meta
  const today = new Date()
  const isToday = isSameDay(date, today)
  const { reduced } = useMotionSafe()

  // Derive the active phase color variable for the tint utility
  let phaseColor: string | undefined
  let textColor = isCurrentMonth ? 'var(--color-text-primary)' : 'var(--color-text-muted)'
  const opacity = isFuturePredicted ? 0.5 : 1
  const hasPhase = isCurrentMonth && (isPeriod || isFertile || isOvulation)

  if (isPeriod && isCurrentMonth) {
    phaseColor = 'var(--color-menstrual)'
    textColor = 'var(--color-menstrual)'
  } else if (isOvulation && isCurrentMonth) {
    phaseColor = 'var(--color-ovulation)'
    textColor = 'var(--color-ovulation)'
  } else if (isFertile && isCurrentMonth) {
    phaseColor = 'var(--color-fertile)'
    textColor = 'var(--color-fertile)'
  }

  // Selected state tint: slightly more opaque version of the phase color
  // Use a separate CSS var so color-mix works from the same phase palette
  const selectedExtraStyle = isSelected && phaseColor
    ? { ['--phase-color' as string]: phaseColor }
    : {}

  return (
    <motion.button
      onClick={onClick}
      className={[
        'relative flex flex-col items-center justify-center aspect-square w-full rounded-xl',
        'transition-[color,background-color] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 focus-visible:ring-offset-1',
        // Phase tint via CSS utility — sets background via color-mix with --phase-color
        hasPhase ? 'bg-phase-tint' : '',
        // Selected: boost tint opacity via an extra class handled below in style
        isSelected ? 'border-phase' : '',
      ].filter(Boolean).join(' ')}
      style={{
        // Provide --phase-color so .bg-phase-tint and .border-phase can consume it
        ...(phaseColor ? { ['--phase-color' as string]: phaseColor } : {}),
        // Fallback background for out-of-month or plain days
        backgroundColor: !hasPhase
          ? isSelected
            ? 'var(--color-bg-secondary)'
            : 'transparent'
          : undefined,
        ...selectedExtraStyle,
        opacity,
      }}
      // Motion: scale on hover/tap via springSoft, gated on reduced-motion
      whileHover={reduced || !hasPhase ? undefined : { scale: 1.08 }}
      whileTap={reduced ? undefined : { scale: 0.92 }}
      transition={springSoft}
    >
      {/* Today ring */}
      {isToday && (
        <motion.div
          className="absolute inset-0.5 rounded-[10px] border-2 pointer-events-none"
          style={{ borderColor: 'var(--color-text-primary)' }}
          animate={reduced ? {} : { opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden="true"
        />
      )}

      {/* Ovulation accent dot — popIn on mount */}
      {isOvulation && isCurrentMonth && (
        <motion.div
          className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: 'var(--color-ovulation)' }}
          variants={popIn}
          initial={reduced ? false : 'hidden'}
          animate="visible"
          aria-hidden="true"
        />
      )}

      {/* Period indicator dot — popIn on mount */}
      {isPeriod && isCurrentMonth && !isOvulation && (
        <motion.div
          className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: 'var(--color-menstrual)' }}
          variants={popIn}
          initial={reduced ? false : 'hidden'}
          animate="visible"
          aria-hidden="true"
        />
      )}

      {/* Fertile indicator dot — popIn on mount */}
      {isFertile && isCurrentMonth && !isOvulation && !isPeriod && (
        <motion.div
          className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: 'var(--color-fertile)' }}
          variants={popIn}
          initial={reduced ? false : 'hidden'}
          animate="visible"
          aria-hidden="true"
        />
      )}

      {/* Date number */}
      <span
        className="text-sm md:text-base font-semibold leading-none"
        style={{ color: isCurrentMonth ? textColor : 'var(--color-text-muted)', fontWeight: isToday ? 800 : 600 }}
      >
        {format(date, 'd')}
      </span>

      {/* Future dashed border for predicted days */}
      {isFuturePredicted && isCurrentMonth && (isPeriod || isFertile || isOvulation) && (
        <div
          className="absolute inset-0.5 rounded-[10px] border border-dashed pointer-events-none"
          style={{
            borderColor: isPeriod
              ? 'var(--color-menstrual)'
              : isOvulation
                ? 'var(--color-ovulation)'
                : 'var(--color-fertile)',
          }}
          aria-hidden="true"
        />
      )}

      {/* Selected ring */}
      {isSelected && (
        <div
          className="absolute inset-0 rounded-xl border-2 pointer-events-none"
          style={{ borderColor: 'var(--color-primary)' }}
          aria-hidden="true"
        />
      )}
    </motion.button>
  )
}

// ─── Day Detail Sheet ──────────────────────────────────────────────────────────

interface DayDetailProps {
  date: Date
  meta: DayMeta
  symptoms: SymptomLog[]
  onClose: () => void
}

function DayDetail({ date, meta, symptoms, onClose }: DayDetailProps) {
  const { t } = useTranslation()
  const { language } = useAppStore()
  const dateLocale = language === 'bn' ? bn : undefined
  const today = new Date()
  const isFuture = date > today

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      layout
    >
      <Card padding="md">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
            {format(date, 'EEEE, MMMM d', { locale: dateLocale })}
            {isFuture && (
              <span className="ml-2 text-[10px] font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded-full">
                {t('calendar.predicted')}
              </span>
            )}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
          >
            <X size={14} className="text-[var(--color-text-muted)]" aria-hidden="true" />
          </button>
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap gap-2 mb-3">
          {meta.isPeriod && (
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--color-menstrual)' }}
            >
              🩸 {t('calendar.periodDay')}
            </div>
          )}
          {meta.isOvulation && (
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--color-ovulation)' }}
            >
              🌸 {t('calendar.ovulationLabel')}
            </div>
          )}
          {meta.isFertile && !meta.isOvulation && (
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--color-fertile)' }}
            >
              🌱 {t('calendar.fertileWindowLabel')}
            </div>
          )}
          {!meta.isPeriod && !meta.isFertile && !meta.isOvulation && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)]">
              {t('calendar.regularDay')}
            </div>
          )}
        </div>

        {/* Symptoms */}
        {symptoms.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)]">{t('calendar.noSymptomsLogged')}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {symptoms.map((log) => {
              const symptomDef = SYMPTOMS_DATA.find((s) => s.id === log.symptomId)
              if (!symptomDef) return null
              const name = language === 'bn' ? symptomDef.nameBn : symptomDef.nameEn
              return (
                <div
                  key={log.id}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                  style={{
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <span aria-hidden="true">{symptomDef.icon}</span>
                  <span>{name}</span>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </motion.div>
  )
}

// ─── Recent Periods ────────────────────────────────────────────────────────────

const FLOW_STYLES: Record<string, { bg: string; text: string; labelKey: string }> = {
  LIGHT: { bg: 'var(--color-fertile)', text: '#fff', labelKey: 'common.flowLight' },
  MEDIUM: { bg: '#F59E0B', text: '#fff', labelKey: 'common.flowMedium' },
  HEAVY: { bg: 'var(--color-menstrual)', text: '#fff', labelKey: 'common.flowHeavy' },
}

const PAGE_SIZE = 6

interface RecentPeriodsProps {
  periodLogs: PeriodLog[]
  language: string
  onEditLog: (log: PeriodLog) => void
}

function RecentPeriods({ periodLogs, language, onEditLog }: RecentPeriodsProps) {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const prefersReducedMotion = useReducedMotion()

  const totalPages = Math.ceil(periodLogs.length / PAGE_SIZE)
  const slice = periodLogs.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const fmt = new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : 'en-US', {
    month: 'short',
    day: 'numeric',
  })

  function toDate(val: Date | string): Date {
    return val instanceof Date ? val : new Date(val)
  }

  function durationDays(start: Date | string, end: Date | string): number {
    const s = toDate(start)
    const e = toDate(end)
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.4 }}
    >
      <Card padding="md">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-3">
          {t('calendar.recentPeriods')}
        </h3>

        {periodLogs.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)] text-center py-3">
            {t('calendar.noPeriodLogsYet')}
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2" role="list">
              {slice.map((log) => {
                const start = toDate(log.startDate)
                const end = toDate(log.endDate)
                const days = durationDays(log.startDate, log.endDate)
                const flow = FLOW_STYLES[log.flowIntensity] ?? FLOW_STYLES.MEDIUM

                return (
                  <motion.button
                    key={log.id}
                    role="listitem"
                    initial={prefersReducedMotion ? {} : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => onEditLog(log)}
                    aria-label={`Edit period log starting ${fmt.format(start)}`}
                    className="w-full flex items-center justify-between gap-2 py-1.5 border-b border-[var(--color-border)] last:border-0 cursor-pointer hover:bg-[var(--color-bg-secondary)] rounded-lg px-1 -mx-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0 text-left">
                      <span className="text-xs font-semibold text-[var(--color-text-primary)] tabular-nums">
                        {fmt.format(start)}
                        <span className="mx-1 text-[var(--color-text-muted)]">→</span>
                        {fmt.format(end)}
                      </span>
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        {days} {t(days === 1 ? 'common.day' : 'common.days')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ backgroundColor: flow.bg, color: flow.text }}
                      >
                        {t(flow.labelKey)}
                      </span>
                      <Pencil size={12} className="text-[var(--color-text-muted)]" aria-hidden="true" />
                    </div>
                  </motion.button>
                )
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-[var(--color-border)]">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  aria-label="Previous page of period logs"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
                >
                  <ChevronLeft size={12} aria-hidden="true" />
                  {t('common.previous')}
                </button>
                <span className="text-[11px] text-[var(--color-text-muted)] tabular-nums">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  aria-label="Next page of period logs"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
                >
                  {t('common.next')}
                  <ChevronRight size={12} aria-hidden="true" />
                </button>
              </div>
            )}
          </>
        )}
      </Card>
    </motion.div>
  )
}

// ─── Calendar Client ───────────────────────────────────────────────────────────

export function CalendarClient({ profiles: _profiles, activeProfileId: _activeProfileId, month, days, symptomLogs, periodLogs }: Props) {
  const router = useRouter()
  const { t } = useTranslation()
  const { language } = useAppStore()
  const dateLocale = language === 'bn' ? bn : undefined
  const prefersReducedMotion = useReducedMotion()

  const today = new Date()
  const currentMonth = useMemo(() => {
    const [year, monthNum] = month.split('-').map(Number)
    return new Date(year, monthNum - 1, 1)
  }, [month])

  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [editingLog, setEditingLog] = useState<PeriodLog | null>(null)
  // Track navigation direction for direction-aware month slide: 1 = forward, -1 = backward
  const [monthDirection, setMonthDirection] = useState<1 | -1>(1)

  // Build the API calendar lookup map
  const apiCalendarMap = useMemo(() => {
    if (!days) return null
    const map = new Map<string, CalendarDay>()
    for (const entry of days) {
      map.set(entry.date, entry)
    }
    return map
  }, [days])

  // Build grid days for this month
  const gridDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [currentMonth])

  // Build DayMeta for each grid day from the server-provided calendar data
  const dayMetaMap = useMemo(() => {
    const map = new Map<string, DayMeta>()
    for (const date of gridDays) {
      const dateStr = format(date, 'yyyy-MM-dd')
      const apiDay = apiCalendarMap?.get(dateStr)
      const isFuture = date > today

      map.set(dateStr, {
        date,
        isPeriod: apiDay?.period ?? false,
        isFertile: apiDay?.fertile ?? false,
        isOvulation: apiDay?.ovulation ?? false,
        isFuturePredicted: apiDay?.predicted ?? false,
      })
    }
    return map
  }, [gridDays, apiCalendarMap, today])

  // Build a per-date symptom map from server-provided logs
  const symptomsByDate = useMemo(() => {
    const map = new Map<string, SymptomLog[]>()
    for (const log of symptomLogs) {
      const dateStr = format(new Date(log.date), 'yyyy-MM-dd')
      const existing = map.get(dateStr) ?? []
      existing.push(log)
      map.set(dateStr, existing)
    }
    return map
  }, [symptomLogs])

  const selectedMeta = selectedDate
    ? dayMetaMap.get(format(selectedDate, 'yyyy-MM-dd'))
    : null

  const selectedSymptoms = selectedDate
    ? (symptomsByDate.get(format(selectedDate, 'yyyy-MM-dd')) ?? [])
    : []

  // Month navigation — update the URL so the RSC re-fetches data
  const prevMonth = () => {
    setMonthDirection(-1)
    setSelectedDate(null)
    const prev = subMonths(currentMonth, 1)
    const newMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
    router.push(`/calendar?month=${newMonth}`)
  }

  const nextMonth = () => {
    setMonthDirection(1)
    setSelectedDate(null)
    const next = addMonths(currentMonth, 1)
    const newMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
    router.push(`/calendar?month=${newMonth}`)
  }

  const handleDayClick = (date: Date) => {
    if (selectedDate && isSameDay(selectedDate, date)) {
      setSelectedDate(null)
    } else {
      setSelectedDate(date)
    }
  }

  // Extract prediction summary from calendar data for the monthly summary card
  // Find the first predicted period start and any ovulation/fertile day
  const firstPredictedPeriod = days?.find((d) => d.predicted && d.period)
  const ovulationDay = days?.find((d) => d.ovulation)
  const fertileStart = days?.find((d) => d.fertile && !d.ovulation)
  const fertileEnd = [...(days ?? [])].reverse().find((d) => d.fertile)

  // Determine the active legend key for today's phase (highlights that chip)
  const todayMeta = dayMetaMap.get(format(today, 'yyyy-MM-dd'))
  const activeLegendKey: string | undefined = (() => {
    if (!todayMeta) return undefined
    if (todayMeta.isOvulation) return 'ovulation'
    if (todayMeta.isPeriod) return 'period'
    if (todayMeta.isFertile) return 'fertile'
    return 'today'
  })()

  const DOW = [
    t('calendar.sun'), t('calendar.mon'), t('calendar.tue'), t('calendar.wed'),
    t('calendar.thu'), t('calendar.fri'), t('calendar.sat'),
  ]

  return (
    <div className="flex flex-col gap-4 py-3 relative overflow-hidden">

      {/* ── Page header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
          {t('nav.calendar', 'Calendar')}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
          {format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}
        </p>
      </motion.div>

      {/* ── Decorative blobs ── */}
      <motion.div
        className="absolute -top-8 -right-8 w-40 h-40 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(232,71,108,0.07) 0%, transparent 70%)' }}
        animate={prefersReducedMotion ? {} : { y: [0, -10, 0], x: [0, 6, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden="true"
      />
      <motion.div
        className="absolute bottom-24 -left-10 w-32 h-32 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(123,197,174,0.06) 0%, transparent 70%)' }}
        animate={prefersReducedMotion ? {} : { y: [0, 10, 0], x: [0, -5, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        aria-hidden="true"
      />

      {/* ── Desktop: side-by-side layout (calendar + detail panel) ── */}
      <div className="flex flex-col lg:flex-row gap-4">

        {/* ── Calendar card (constrained width on desktop) ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:w-[480px] lg:shrink-0"
        >
          <Card padding="md">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={prevMonth}
                aria-label="Previous month"
                className="p-2 rounded-xl hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <ChevronLeft size={20} className="text-[var(--color-text-secondary)]" aria-hidden="true" />
              </button>

              <motion.h2
                key={format(currentMonth, 'yyyy-MM')}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="text-base font-bold text-[var(--color-text-primary)]"
              >
                {format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}
              </motion.h2>

              <button
                onClick={nextMonth}
                aria-label="Next month"
                className="p-2 rounded-xl hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <ChevronRight size={20} className="text-[var(--color-text-secondary)]" aria-hidden="true" />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1 md:mb-2">
              {DOW.map((d) => (
                <div key={d} className="flex items-center justify-center">
                  <span className="text-[10px] md:text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                    {d}
                  </span>
                </div>
              ))}
            </div>

            {/* Calendar grid — direction-aware horizontal slide + fade */}
            <AnimatePresence mode="wait" custom={monthDirection}>
              <motion.div
                key={format(currentMonth, 'yyyy-MM')}
                custom={monthDirection}
                variants={prefersReducedMotion ? undefined : {
                  enter: (dir: number) => ({ opacity: 0, x: dir * 40 }),
                  center: { opacity: 1, x: 0 },
                  exit: (dir: number) => ({ opacity: 0, x: dir * -40 }),
                }}
                initial={prefersReducedMotion ? false : 'enter'}
                animate="center"
                exit={prefersReducedMotion ? undefined : 'exit'}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="grid grid-cols-7 gap-0.5 md:gap-1"
              >
                {gridDays.map((date) => {
                  const dateStr = format(date, 'yyyy-MM-dd')
                  const meta = dayMetaMap.get(dateStr)!
                  const inMonth = isSameMonth(date, currentMonth)
                  const isSelected = selectedDate ? isSameDay(date, selectedDate) : false

                  return (
                    <DayCell
                      key={dateStr}
                      meta={meta}
                      isCurrentMonth={inMonth}
                      isSelected={isSelected}
                      onClick={() => handleDayClick(date)}
                    />
                  )
                })}
              </motion.div>
            </AnimatePresence>

            {/* Legend — inside the calendar card on desktop */}
            <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
              <Legend activeLegendKey={activeLegendKey} />
            </div>
          </Card>
        </motion.div>

        {/* ── Right panel: Day Detail + Monthly Summary (sticky on desktop) ── */}
        <div className="flex-1 flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start min-w-0">

          {/* Day Detail */}
          <AnimatePresence mode="wait">
            {selectedDate && selectedMeta && (
              <DayDetail
                key={format(selectedDate, 'yyyy-MM-dd')}
                date={selectedDate}
                meta={selectedMeta}
                symptoms={selectedSymptoms}
                onClose={() => setSelectedDate(null)}
              />
            )}
          </AnimatePresence>

          {/* Monthly Summary */}
          {(firstPredictedPeriod || ovulationDay || fertileStart) && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              <Card padding="md">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-3">
                  {t('calendar.thisCycle')}
                </h3>
                <div className="flex flex-col gap-2">
                  {firstPredictedPeriod && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-menstrual)' }} />
                        <span className="text-xs text-[var(--color-text-secondary)]">{t('calendar.nextPeriod')}</span>
                      </div>
                      <span className="text-xs font-bold text-[var(--color-text-primary)]">
                        {new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : undefined, { month: 'short', day: 'numeric' }).format(parseISO(firstPredictedPeriod.date))}
                      </span>
                    </div>
                  )}
                  {ovulationDay && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-ovulation)' }} />
                        <span className="text-xs text-[var(--color-text-secondary)]">{t('calendar.ovulationDayLabel')}</span>
                      </div>
                      <span className="text-xs font-bold text-[var(--color-text-primary)]">
                        {new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : undefined, { month: 'short', day: 'numeric' }).format(parseISO(ovulationDay.date))}
                      </span>
                    </div>
                  )}
                  {fertileStart && fertileEnd && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-fertile)' }} />
                        <span className="text-xs text-[var(--color-text-secondary)]">{t('calendar.fertileWindow')}</span>
                      </div>
                      <span className="text-xs font-bold text-[var(--color-text-primary)]">
                        {new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : undefined, { month: 'short', day: 'numeric' }).format(parseISO(fertileStart.date))}
                        {' – '}
                        {new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : undefined, { month: 'short', day: 'numeric' }).format(parseISO(fertileEnd.date))}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Empty state when no day selected */}
          {!selectedDate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
            >
              <Card padding="md">
                <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
                  {t('calendar.selectDay', 'Tap a day to see details')}
                </p>
              </Card>
            </motion.div>
          )}

          {/* Recent Periods */}
          <RecentPeriods periodLogs={periodLogs} language={language} onEditLog={setEditingLog} />
        </div>
      </div>

      {/* ── Edit Period Log Modal ── */}
      <AnimatePresence>
        {editingLog && (
          <PeriodLogModal
            key="edit-period-modal"
            profileId={editingLog.profileId}
            existingLogId={editingLog.id}
            initialStart={toDateStr(editingLog.startDate)}
            initialEnd={toDateStr(editingLog.endDate)}
            initialFlow={editingLog.flowIntensity.toLowerCase() as FlowIntensity}
            onClose={() => setEditingLog(null)}
            onSaved={() => router.refresh()}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function toDateStr(d: Date | string): string {
  if (typeof d === 'string') return d.includes('T') ? d.slice(0, 10) : d
  return d.toISOString().slice(0, 10)
}
