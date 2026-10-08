'use client'

import { useState, useMemo, useCallback, useEffect, useRef, memo } from 'react'
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
import { ChevronLeft, ChevronRight, X, Pencil, Baby, Plus } from 'lucide-react'

import { Card } from '@/components/ui/Card'
import { useAppStore } from '@/lib/store'
import { SYMPTOMS_DATA } from '@/lib/symptoms-data'
import { PeriodLogModal, FLOW_COLORS, FLOW_TEXT } from '@/components/PeriodLogModal'
import { QuickSymptomModal } from '@/components/modals/QuickSymptomModal'
import { LoggingNudge } from '@/components/nudge/LoggingNudge'
import type { FlowIntensity } from '@vesta/shared/types'
import { isPregnancy, goalAccentVar } from '@vesta/shared/utils/goal'
import { selectFertileWindow } from '@vesta/shared/utils/fertile-window'
import '@vesta/shared/utils/i18n'
import { DAY_STYLES, dayStyleKind, type DayStyleKind } from '@/lib/calendar-day-style'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'

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
  /** prev + visible + next month days, so a window straddling a month edge isn't truncated */
  windowDays?: CalendarDay[]
  symptomLogs: SymptomLog[]
  periodLogs: PeriodLog[]
  goal: string | null
  last30?: { date: string; logged: boolean }[]
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend({ pregnancy }: { pregnancy: boolean }) {
  const { t } = useTranslation()
  const allItems: { kind: DayStyleKind | 'today'; label: string; predictive: boolean }[] = [
    { kind: 'period', label: t('calendar.period'), predictive: false },
    { kind: 'predictedPeriod', label: t('calendar.predictedPeriod'), predictive: true },
    { kind: 'fertile', label: t('calendar.fertile'), predictive: true },
    { kind: 'ovulation', label: t('calendar.ovulationDay'), predictive: true },
    { kind: 'today', label: t('calendar.today'), predictive: false },
  ]

  const items = pregnancy ? allItems.filter((i) => !i.predictive) : allItems

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center">
      {items.map(({ kind, label }) => (
        <div key={kind} className="flex items-center gap-1.5">
          <div
            className="w-4 h-4 rounded-md"
            aria-hidden="true"
            style={
              kind === 'today'
                ? { border: '2px solid var(--color-text-primary)' }
                : { background: DAY_STYLES[kind].background, border: DAY_STYLES[kind].border }
            }
          />
          <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Day Cell ──────────────────────────────────────────────────────────────────

interface DayCellProps {
  meta: DayMeta
  isCurrentMonth: boolean
  isSelected: boolean
  onSelect: (date: Date) => void
  isGhostDay?: boolean
  onGhostTap?: (dateStr: string) => void
}

const DayCell = memo(function DayCell({ meta, isCurrentMonth, isSelected, onSelect, isGhostDay = false, onGhostTap }: DayCellProps) {
  const { t } = useTranslation()
  const { date } = meta
  const isToday = isSameDay(date, new Date())
  const kind = isCurrentMonth ? dayStyleKind(meta) : 'plain'
  const style = DAY_STYLES[kind]
  const showAdd = isGhostDay && isCurrentMonth

  return (
    <div className="group relative aspect-square w-full">
      <button
      onClick={() => onSelect(date)}
        aria-pressed={isSelected}
        className="absolute inset-0 flex flex-col items-center justify-center w-full h-full rounded-xl transition-colors duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]/60"
        style={{
          background: isSelected && kind === 'plain' ? 'var(--color-bg-secondary)' : style.background,
          border: style.border,
        }}
      >
        <span
          className={`text-sm md:text-base leading-none tabular-nums${showAdd ? ' group-hover:opacity-0 group-focus-within:opacity-0 transition-opacity' : ''}`}
          style={{
            color: isCurrentMonth ? style.color : 'var(--color-text-muted)',
            fontWeight: isToday ? 800 : 600,
          }}
        >
          {format(date, 'd')}
        </span>

        {/* Today ring */}
        {isToday && (
          <div
            className="absolute inset-0.5 rounded-[10px] border-2 pointer-events-none"
            style={{ borderColor: 'var(--color-text-primary)' }}
          />
        )}

        {/* Selected ring */}
        {isSelected && (
          <div
            className="absolute inset-0 rounded-xl border-2 pointer-events-none"
            style={{ borderColor: 'var(--goal-accent)' }}
          />
        )}
      </button>

      {/* Unlogged past day: "+" appears on hover or focus and taps through to add a log */}
      {showAdd && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onGhostTap?.(format(date, 'yyyy-MM-dd')) }}
          aria-label={t('calendar.addLogFor', { date: format(date, 'MMMM d') })}
          className="absolute inset-0 z-10 flex items-center justify-center rounded-xl text-[var(--color-text-secondary)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]/60"
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  )
})

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
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  // Below the two-column breakpoint the detail card sits under the grid: bring it into view.
  useEffect(() => {
    if (!window.matchMedia('(max-width: 1279px)').matches) return
    ref.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
  }, [reduce])

  return (
    <motion.div
      ref={ref}
      className="scroll-mb-24"
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
            className="p-1.5 rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]/40"
          >
            <X size={14} className="text-[var(--color-text-muted)]" aria-hidden="true" />
          </button>
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap gap-2 mb-3">
          {meta.isPeriod && (
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: 'var(--color-menstrual)', color: 'var(--color-on-menstrual)' }}
            >
              🩸 {t('calendar.periodDay')}
            </div>
          )}
          {meta.isOvulation && (
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: 'var(--color-ovulation)', color: 'var(--color-on-ovulation)' }}
            >
              🌸 {t('calendar.ovulationLabel')}
            </div>
          )}
          {meta.isFertile && !meta.isOvulation && (
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: 'var(--color-fertile)', color: 'var(--color-on-fertile)' }}
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

const FLOW_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  LIGHT: { bg: FLOW_COLORS.light, text: FLOW_TEXT.light, label: 'Light' },
  MEDIUM: { bg: FLOW_COLORS.medium, text: FLOW_TEXT.medium, label: 'Medium' },
  HEAVY: { bg: FLOW_COLORS.heavy, text: FLOW_TEXT.heavy, label: 'Heavy' },
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
            {t('calendar.noPeriodLogs')}
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
                    className="w-full flex items-center justify-between gap-2 py-1.5 border-b border-[var(--color-border)] last:border-0 cursor-pointer hover:bg-[var(--color-bg-secondary)] rounded-lg px-1 -mx-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]/40"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0 text-left">
                      <span className="text-xs font-semibold text-[var(--color-text-primary)] tabular-nums">
                        {fmt.format(start)}
                        <span className="mx-1 text-[var(--color-text-muted)]">→</span>
                        {fmt.format(end)}
                      </span>
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        {days} {t('calendar.days')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ backgroundColor: flow.bg, color: flow.text }}
                      >
                        {t(`dashboard.flow${log.flowIntensity.charAt(0) + log.flowIntensity.slice(1).toLowerCase()}`)}
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
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]/40"
                >
                  <ChevronLeft size={12} aria-hidden="true" />
                  {t('calendar.prev')}
                </button>
                <span className="text-[11px] text-[var(--color-text-muted)] tabular-nums">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  aria-label="Next page of period logs"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]/40"
                >
                  {t('calendar.next')}
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

/** Latest logged period start that is not in the future (YYYY-MM-DD), or null. */
function lastPeriodStartIso(logs: PeriodLog[]): string | null {
  const today = format(new Date(), 'yyyy-MM-dd')
  let best: string | null = null
  for (const l of logs) {
    const s = format(new Date(l.startDate), 'yyyy-MM-dd')
    if (s <= today && (!best || s > best)) best = s
  }
  return best
}

export function CalendarClient({ profiles: _profiles, activeProfileId, month, days, windowDays, symptomLogs, periodLogs, goal, last30 = [] }: Props) {
  const router = useRouter()
  const { t } = useTranslation()
  const { language } = useAppStore()
  const dateLocale = language === 'bn' ? bn : undefined
  const prefersReducedMotion = useReducedMotion()

  const pregnancy = isPregnancy(goal)

  // Stable across renders so dayMetaMap isn't rebuilt (and all DayCells re-rendered)
  // on every unrelated state change, e.g. opening/closing the edit modal.
  const today = useMemo(() => new Date(), [])
  const currentMonth = useMemo(() => {
    const [year, monthNum] = month.split('-').map(Number)
    return new Date(year, monthNum - 1, 1)
  }, [month])

  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [editingLog, setEditingLog] = useState<PeriodLog | null>(null)

  // ── Ghost-day backfill state ────────────────────────────────────────────────
  const [backfillDate, setBackfillDate] = useState<string | null>(null)

  // Build a Set of logged dates from the last-30 engagement data
  const loggedDatesSet = useMemo(() => {
    const s = new Set<string>()
    for (const entry of last30) {
      if (entry.logged) s.add(entry.date)
    }
    return s
  }, [last30])

  // Build a Set of all dates in the last-30 window for quick lookup
  const last30WindowSet = useMemo(() => {
    const s = new Set<string>()
    for (const entry of last30) {
      s.add(entry.date)
    }
    return s
  }, [last30])

  // ── Nudge data ──────────────────────────────────────────────────────────────

  const nudgeData = useMemo(() => {
    const latestPeriod = periodLogs.length > 0
      ? new Date(periodLogs[0].startDate)
      : null
    const latestSymptom = symptomLogs.length > 0
      ? new Date(symptomLogs[0].date)
      : null

    const hasAnyLogs = !!latestPeriod || !!latestSymptom

    let daysSinceLastLog: number | null = null
    if (latestPeriod || latestSymptom) {
      const candidates: Date[] = []
      if (latestPeriod) candidates.push(latestPeriod)
      if (latestSymptom) candidates.push(latestSymptom)
      const mostRecent = candidates.reduce((a, b) => (a > b ? a : b))
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      const then = new Date(mostRecent)
      then.setHours(0, 0, 0, 0)
      daysSinceLastLog = Math.floor((now.getTime() - then.getTime()) / 86_400_000)
    }

    return { hasAnyLogs, daysSinceLastLog }
  }, [periodLogs, symptomLogs])

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
    setSelectedDate(null)
    const prev = subMonths(currentMonth, 1)
    const newMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
    router.push(`/calendar?month=${newMonth}`)
  }

  const nextMonth = () => {
    setSelectedDate(null)
    const next = addMonths(currentMonth, 1)
    const newMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
    router.push(`/calendar?month=${newMonth}`)
  }

  const handleDayClick = useCallback((date: Date) => {
    setSelectedDate((prev) => (prev && isSameDay(prev, date) ? null : date))
  }, [])

  const handleGhostTap = useCallback((d: string) => setBackfillDate(d), [])

  // Extract prediction summary from calendar data for the monthly summary card.
  // For pregnancy profiles the service returns empty sets, but we also guard
  // client-side so no forward-looking data is ever derived or shown.
  const firstPredictedPeriod = !pregnancy ? days?.find((d) => d.predicted && d.period) : undefined
  const ovulationDay = !pregnancy ? days?.find((d) => d.ovulation) : undefined
  const fertileWindow = !pregnancy ? selectFertileWindow(windowDays ?? days ?? [], format(new Date(), 'yyyy-MM-dd'), lastPeriodStartIso(periodLogs)) : null

  const DOW = [
    t('calendar.sun'), t('calendar.mon'), t('calendar.tue'), t('calendar.wed'),
    t('calendar.thu'), t('calendar.fri'), t('calendar.sat'),
  ]

  return (
    <PageContainer width="wide" className="relative overflow-hidden">

      {/* ── Page header ── */}
      <PageHeader
        title={t('nav.calendar')}
        subtitle={format(currentMonth, 'MMMM yyyy', { locale: dateLocale })}
      />

      {/* ── Logging Nudge ── */}
      <LoggingNudge
        profileId={activeProfileId}
        hasAnyLogs={nudgeData.hasAnyLogs}
        daysSinceLastLog={nudgeData.daysSinceLastLog}
        goal={goal}
      />

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
      <div className="flex flex-col xl:flex-row gap-5">

        {/* ── Calendar card (constrained width on desktop) ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="xl:w-[480px] xl:shrink-0"
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

            {/* Pregnancy coming-soon banner */}
            {pregnancy && (
              <motion.div
                initial={prefersReducedMotion ? {} : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="mb-4 flex items-center gap-2 rounded-xl px-3 py-2.5 border"
                style={{
                  ['--goal-accent' as string]: goalAccentVar(goal),
                  backgroundColor: 'color-mix(in srgb, var(--goal-accent) 8%, var(--color-bg-primary))',
                  borderColor: 'color-mix(in srgb, var(--goal-accent) 30%, transparent)',
                }}
                aria-live="polite"
              >
                <Baby
                  size={15}
                  aria-hidden="true"
                  style={{ color: 'var(--goal-accent)', flexShrink: 0 }}
                />
                <p className="text-xs font-medium" style={{ color: 'var(--goal-accent)' }}>
                  {t('calendar.pregnancyComingSoon')}
                </p>
              </motion.div>
            )}

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

            {/* Calendar grid */}
            <AnimatePresence mode="wait">
              <motion.div
                key={format(currentMonth, 'yyyy-MM')}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.22 }}
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
                      onSelect={handleDayClick}
                      isGhostDay={
                        inMonth &&
                        last30WindowSet.has(dateStr) &&
                        !loggedDatesSet.has(dateStr) &&
                        dateStr < format(today, 'yyyy-MM-dd') &&
                        dateStr !== format(today, 'yyyy-MM-dd')
                      }
                      onGhostTap={handleGhostTap}
                    />
                  )
                })}
              </motion.div>
            </AnimatePresence>

            {/* Legend — inside the calendar card on desktop */}
            <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
              <Legend pregnancy={pregnancy} />
            </div>
          </Card>
        </motion.div>

        {/* ── Right panel: Day Detail + Monthly Summary (sticky on desktop) ── */}
        <div className="flex-1 flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start min-w-0">

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

          {/* Monthly Summary — hidden for pregnancy profiles */}
          {!pregnancy && (firstPredictedPeriod || ovulationDay || fertileWindow) && (
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
                  {fertileWindow && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-fertile)' }} />
                        <span className="text-xs text-[var(--color-text-secondary)]">{t('calendar.fertileWindow')}</span>
                      </div>
                      <span className="text-xs font-bold text-[var(--color-text-primary)]">
                        {new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : undefined, { month: 'short', day: 'numeric' }).format(parseISO(fertileWindow.start))}
                        {' – '}
                        {new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : undefined, { month: 'short', day: 'numeric' }).format(parseISO(fertileWindow.end))}
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
                  {t('calendar.selectDay')}
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
            onSaved={() => {
              router.refresh()
              window.dispatchEvent(new CustomEvent('vesta:profile-updated'))
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Ghost-day backfill modal ── */}
      <QuickSymptomModal
        open={backfillDate !== null}
        onClose={() => setBackfillDate(null)}
        profileId={activeProfileId}
        goal={goal}
        initialDate={backfillDate ?? undefined}
        onSaved={() => {
          setBackfillDate(null)
          router.refresh()
          window.dispatchEvent(new CustomEvent('vesta:profile-updated'))
        }}
      />
    </PageContainer>
  )
}

function toDateStr(d: Date | string): string {
  if (typeof d === 'string') return d.includes('T') ? d.slice(0, 10) : d
  return d.toISOString().slice(0, 10)
}
