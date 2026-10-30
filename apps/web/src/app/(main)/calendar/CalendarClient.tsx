'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  parseISO,
  differenceInCalendarDays,
  subDays,
} from 'date-fns'
import { bn } from 'date-fns/locale/bn'
import { CalendarDays, ChevronLeft, ChevronRight, X, Pencil, Baby, Plus, Droplets, Flower2, Sprout, ArrowRight } from 'lucide-react'

import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatShortDate } from '@/lib/format-date'
import { useLanguage } from '@/lib/use-language'
import { SYMPTOMS_DATA } from '@/lib/symptoms-data'
import { PeriodLogModal, FLOW_COLORS, FLOW_TEXT } from '@/components/PeriodLogModal'
import type { CyclePhase, FlowIntensity } from '@vesta/shared/types'
import { isPregnancy } from '@vesta/shared/utils/goal'
import { selectFertileWindow } from '@vesta/shared/utils/fertile-window'
import '@vesta/shared/utils/i18n'
import { DAY_STYLES, TODAY_GLOW_SWATCH, dayStyleKind, type DayStyleKind } from '@/lib/calendar-day-style'
import { MonthGrid, type MonthDayAction, type MonthDayState } from '@/components/calendar/MonthGrid'
import { cyclePhaseOn, periodStarts } from '@/lib/calendar-phase'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { storedDay } from '@/lib/day-ranges'
import { canLogPastPeriod } from './period-backfill'
import { appLocale } from '@/lib/language'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'

/** Prev/next page buttons under the day's log list. */
const PAGER_BUTTON =
  'flex items-center gap-1 px-3 min-h-11 rounded-lg text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-card)]/60 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]/40'

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
  /** Cycle phase from the shared ranges; drives the follicular/luteal tint. */
  phase: CyclePhase | null
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
  /** The Bangladesh day (YYYY-MM-DD), computed once by the Server Component. */
  today: string
  days: CalendarDay[] | null
  /** prev + visible + next month days, so a window straddling a month edge isn't truncated */
  windowDays?: CalendarDay[]
  symptomLogs: SymptomLog[]
  periodLogs: PeriodLog[]
  goal: string | null
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend({ pregnancy }: { pregnancy: boolean }) {
  const { t } = useTranslation()
  const allItems: { kind: DayStyleKind | 'today'; label: string; predictive: boolean }[] = [
    { kind: 'period', label: t('calendar.period'), predictive: false },
    { kind: 'predictedPeriod', label: t('calendar.predictedPeriod'), predictive: true },
    { kind: 'fertile', label: t('calendar.fertile'), predictive: true },
    { kind: 'ovulation', label: t('calendar.ovulationDay'), predictive: true },
    // Phase tints come from cycle predictions, so pregnancy hides them with the rest.
    { kind: 'follicular', label: t('calendar.follicularPhase'), predictive: true },
    { kind: 'luteal', label: t('calendar.lutealPhase'), predictive: true },
    { kind: 'today', label: t('calendar.today'), predictive: false },
  ]

  const items = pregnancy ? allItems.filter((i) => !i.predictive) : allItems

  return (
    <ul className="flex flex-wrap gap-x-2.5 md:gap-x-4 gap-y-1 md:gap-y-2 justify-center">
      {items.map(({ kind, label }) => (
        <li key={kind} className="flex items-center gap-1.5">
          {kind === 'today' ? (
            <div className="w-4 h-4 rounded-md" aria-hidden="true" style={{ boxShadow: TODAY_GLOW_SWATCH }} />
          ) : (
            <div
              className="w-4 h-4 rounded-md"
              aria-hidden="true"
              style={{ background: DAY_STYLES[kind].background, border: DAY_STYLES[kind].border }}
            />
          )}
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</span>
        </li>
      ))}
    </ul>
  )
}

// ─── Day Detail Sheet ──────────────────────────────────────────────────────────

interface DayDetailProps {
  /** The Bangladesh day as a local-midnight Date. */
  today: Date
  date: Date
  meta: DayMeta
  symptoms: SymptomLog[]
  onClose: () => void
  /** Set for past days outside every logged period. */
  onAddLog?: () => void
}

function DayDetail({ date, today, meta, symptoms, onClose, onAddLog }: DayDetailProps) {
  const { t } = useTranslation()
  const language = useLanguage()
  const dateLocale = language === 'bn' ? bn : undefined
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
      className="scroll-mb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+1.5rem)]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      layout
    >
      <Card tone="panel" padding="md">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
            {format(date, 'EEEE, MMMM d', { locale: dateLocale })}
            {isFuture && (
              <span className="ml-2 text-[11px] font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded-full">
                {t('calendar.predicted')}
              </span>
            )}
          </h3>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]/40"
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
              <Droplets size={12} aria-hidden="true" /> {t('calendar.periodDay')}
            </div>
          )}
          {meta.isOvulation && (
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: 'var(--color-ovulation)', color: 'var(--color-on-ovulation)' }}
            >
              <Flower2 size={12} aria-hidden="true" /> {t('calendar.ovulationLabel')}
            </div>
          )}
          {meta.isFertile && !meta.isOvulation && (
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: 'var(--color-fertile)', color: 'var(--color-on-fertile)' }}
            >
              <Sprout size={12} aria-hidden="true" /> {t('calendar.fertileWindowLabel')}
            </div>
          )}
          {!meta.isPeriod && !meta.isFertile && !meta.isOvulation && (
            (() => {
              const kind = dayStyleKind(meta, meta.phase)
              return kind === 'follicular' || kind === 'luteal' ? (
                <div
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: DAY_STYLES[kind].background, color: DAY_STYLES[kind].color }}
                >
                  {t(`calendar.${kind}Phase`)}
                </div>
              ) : (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)]">
                  {t('calendar.regularDay')}
                </div>
              )
            })()
          )}
        </div>

        {/* Symptoms */}
        {symptoms.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[var(--color-text-muted)]">{t('calendar.noSymptomsLogged')}</p>
            {onAddLog && (
              <Button variant="secondary" size="sm" onClick={onAddLog} className="min-h-11">
                <Plus size={14} aria-hidden="true" />
                {t('calendar.logPeriodFrom', { date: format(date, 'MMMM d', { locale: dateLocale }) })}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {symptoms.map((log) => {
              const symptomDef = SYMPTOMS_DATA.find((s) => s.id === log.symptomId)
              if (!symptomDef) return null
              const name = language === 'bn' ? symptomDef.nameBn : symptomDef.nameEn
              const Icon = symptomDef.icon
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
                  <Icon size={12} aria-hidden="true" className="shrink-0" />
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

  // Stored dates are UTC midnight; format them in UTC so a phone west of UTC shows the same day.
  const fmt = new Intl.DateTimeFormat(appLocale(language), {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
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
      <Card tone="pink" padding="md">
        <SectionHeader as="h3" title={t('calendar.recentPeriods')} />

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
                    aria-label={t('calendar.editLogStarting', { date: fmt.format(start) })}
                    className="w-full flex items-center justify-between gap-2 py-1.5 border-b border-[var(--color-border)] last:border-0 cursor-pointer hover:bg-[var(--color-bg-card)]/60 rounded-lg px-1 -mx-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]/40"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0 text-left">
                      <span className="text-xs font-semibold text-[var(--color-text-primary)] tabular-nums">
                        {fmt.format(start)}
                        <ArrowRight size={12} className="inline mx-1 text-[var(--color-text-muted)]" aria-hidden="true" />
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
                  aria-label={t('calendar.prevPage')}
                  className={PAGER_BUTTON}
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
                  aria-label={t('calendar.nextPage')}
                  className={PAGER_BUTTON}
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
function lastPeriodStartIso(logs: PeriodLog[], today: string): string | null {
  let best: string | null = null
  for (const l of logs) {
    const s = storedDay(l.startDate)
    if (s <= today && (!best || s > best)) best = s
  }
  return best
}

export function CalendarClient({ profiles, activeProfileId, month, today: todayDay, days, windowDays, symptomLogs, periodLogs, goal }: Props) {
  const router = useRouter()
  const { t } = useTranslation()
  const language = useLanguage()
  const dateLocale = language === 'bn' ? bn : undefined
  const prefersReducedMotion = useReducedMotion()

  const pregnancy = isPregnancy(goal)
  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]
  const cycleLength = activeProfile?.cycleLength ?? 28
  const periodLength = activeProfile?.periodLength ?? 5

  // Stable across renders so dayMetaMap isn't rebuilt (and all DayCells re-rendered)
  // on every unrelated state change, e.g. opening/closing the edit modal.
  // The Bangladesh day from the Server Component, as a local-midnight Date for date-fns.
  const today = useMemo(() => parseISO(todayDay), [todayDay])
  const currentMonth = useMemo(() => {
    const [year, monthNum] = month.split('-').map(Number)
    return new Date(year, monthNum - 1, 1)
  }, [month])

  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  // Desktop opens on today's details (the side panel has room); phones keep the grid alone until a tap.
  useEffect(() => {
    if (window.matchMedia('(min-width: 1280px)').matches && isSameMonth(today, currentMonth)) setSelectedDate(today)
    // Only on arrival; later month changes clear the selection as before.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [editingLog, setEditingLog] = useState<PeriodLog | null>(null)

  // Past day the user is logging a period from (opens PeriodLogModal in create mode)
  const [logFromDate, setLogFromDate] = useState<string | null>(null)

  const todayStr = format(today, 'yyyy-MM-dd')
  const thirtyDaysAgoStr = format(subDays(today, 30), 'yyyy-MM-dd')
  const loggedRanges = useMemo(
    () => periodLogs.map((l) => ({ startDate: storedDay(l.startDate), endDate: storedDay(l.endDate) })),
    [periodLogs],
  )

  // Build the API calendar lookup map
  const apiCalendarMap = useMemo(() => {
    if (!days) return null
    const map = new Map<string, CalendarDay>()
    for (const entry of days) {
      map.set(entry.date, entry)
    }
    return map
  }, [days])

  // Days of this month (the grid only asks for in-month days)
  const monthDays = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }),
    [currentMonth],
  )

  // Cycle starts: logged period starts plus the first day of each period run (logged or predicted).
  // Pregnancy has no cycle predictions, so no phase tints either.
  const cycleStarts = useMemo(
    () => (pregnancy ? [] : periodStarts(periodLogs.map((l) => storedDay(l.startDate)), windowDays ?? days ?? [])),
    [pregnancy, periodLogs, windowDays, days],
  )

  // Build DayMeta for each grid day from the server-provided calendar data
  const dayMetaMap = useMemo(() => {
    const map = new Map<string, DayMeta>()
    for (const date of monthDays) {
      const dateStr = format(date, 'yyyy-MM-dd')
      const apiDay = apiCalendarMap?.get(dateStr)
      map.set(dateStr, {
        date,
        isPeriod: apiDay?.period ?? false,
        isFertile: apiDay?.fertile ?? false,
        isOvulation: apiDay?.ovulation ?? false,
        isFuturePredicted: apiDay?.predicted ?? false,
        phase: cyclePhaseOn(dateStr, cycleStarts, cycleLength, periodLength),
      })
    }
    return map
  }, [monthDays, apiCalendarMap, cycleStarts, cycleLength, periodLength])

  // Build a per-date symptom map from server-provided logs
  const symptomsByDate = useMemo(() => {
    const map = new Map<string, SymptomLog[]>()
    for (const log of symptomLogs) {
      const dateStr = storedDay(log.date)
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
  const goToMonth = (d: Date) => {
    setSelectedDate(null)
    router.push(`/calendar?month=${format(d, 'yyyy-MM')}`)
  }
  const handleDayClick = useCallback((date: Date) => {
    setSelectedDate((prev) => (prev && isSameDay(prev, date) ? null : date))
  }, [])

  /** Roomy desktop days show what was logged: up to three symptom icons, then a count. */
  const dayContent = useCallback((date: Date) => {
    const logs = symptomsByDate.get(format(date, 'yyyy-MM-dd'))
    if (!logs?.length) return null
    const icons = logs
      .map((l) => SYMPTOMS_DATA.find((d) => d.id === l.symptomId))
      .filter((d): d is (typeof SYMPTOMS_DATA)[number] => !!d)
    if (!icons.length) return null
    return (
      <>
        {icons.slice(0, 3).map(({ id, icon: Icon }) => (
          <Icon key={id} size={14} strokeWidth={2.25} className="opacity-80" />
        ))}
        {icons.length > 3 && <span className="text-[11px] font-semibold tabular-nums opacity-80">+{icons.length - 3}</span>}
      </>
    )
  }, [symptomsByDate])

  const dayState = useCallback((date: Date): MonthDayState | undefined => {
    const meta = dayMetaMap.get(format(date, 'yyyy-MM-dd'))
    return meta && { flags: meta, phase: meta.phase }
  }, [dayMetaMap])

  /** Any past day outside a logged period can start a new period log. */
  const canLogFrom = (dateStr: string) => canLogPastPeriod(dateStr, todayStr, loggedRanges)
  const logPeriodAction: MonthDayAction = {
    // The overlay covers the whole cell on desktop, so limit it to recent days; older days go through the DayDetail button.
    show: (date) => {
      const d = format(date, 'yyyy-MM-dd')
      return canLogFrom(d) && d >= thirtyDaysAgoStr
    },
    label: (date) => t('calendar.logPeriodFrom', { date: format(date, 'MMMM d', { locale: dateLocale }) }),
    onActivate: (date) => setLogFromDate(format(date, 'yyyy-MM-dd')),
  }

  // Extract prediction summary from calendar data for the monthly summary card.
  // For pregnancy profiles the service returns empty sets, but we also guard
  // client-side so no forward-looking data is ever derived or shown.
  const firstPredictedPeriod = !pregnancy ? days?.find((d) => d.predicted && d.period) : undefined
  const nextPeriodDaysLate = firstPredictedPeriod
    ? differenceInCalendarDays(today, parseISO(firstPredictedPeriod.date))
    : 0
  const ovulationDay = !pregnancy ? days?.find((d) => d.ovulation) : undefined
  const fertileWindow = !pregnancy ? selectFertileWindow(windowDays ?? days ?? [], todayStr, lastPeriodStartIso(periodLogs, todayStr)) : null

  return (
    <PageContainer width="canvas" className="relative overflow-hidden">

      {/* ── Page header ── */}
      <PageHeader title={t('nav.calendar')} />

      {/* ── Desktop: side-by-side layout (calendar + detail panel) ── */}
      <div className="flex flex-col gap-3 md:gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]">

        {/* ── Calendar card (fills its column on desktop) ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="min-w-0 xl:self-start"
        >
          <MonthGrid
            month={currentMonth}
            onMonthChange={goToMonth}
            selected={selectedDate}
            onSelect={handleDayClick}
            size="roomy"
            dayContent={dayContent}
            dayState={dayState}
            dayAction={logPeriodAction}
            banner={pregnancy && (
              <motion.div
                initial={prefersReducedMotion ? {} : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="mb-2 flex items-center gap-2 rounded-2xl px-3 py-2.5 bg-tint-sky text-accent-sky"
                aria-live="polite"
              >
                <Baby size={15} aria-hidden="true" className="shrink-0" />
                <p className="text-xs font-medium">
                  {t('calendar.pregnancyComingSoon')}
                </p>
              </motion.div>
            )}
            footer={(
              <div className="mt-2 pt-2 md:mt-3 md:pt-3 border-t border-[var(--color-border)]" aria-label={t('calendar.legend')} role="group">
                <Legend pregnancy={pregnancy} />
              </div>
            )}
          />
        </motion.div>

        {/* ── Right panel: Day Detail + Monthly Summary, at its natural height beside the calendar ── */}
        <div className="flex flex-col gap-3 md:gap-4 min-w-0 xl:self-start">

          {/* Day Detail */}
          <AnimatePresence mode="wait">
            {selectedDate && selectedMeta && (
              <DayDetail
                key={format(selectedDate, 'yyyy-MM-dd')}
                date={selectedDate}
                today={today}
                meta={selectedMeta}
                symptoms={selectedSymptoms}
                onClose={() => setSelectedDate(null)}
                onAddLog={canLogFrom(format(selectedDate, 'yyyy-MM-dd')) ? () => setLogFromDate(format(selectedDate, 'yyyy-MM-dd')) : undefined}
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
              <Card tone="lavender" padding="md" className="p-3 md:p-5">
                <SectionHeader as="h3" title={t('calendar.thisCycle')} />
                <div className="flex flex-col gap-2">
                  {firstPredictedPeriod && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div aria-hidden="true" className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-menstrual)' }} />
                        <span className="text-xs text-[var(--color-text-secondary)]">{t('calendar.nextPeriod')}</span>
                      </div>
                      {nextPeriodDaysLate > 0 ? (
                        <span className="text-xs font-bold text-[var(--color-menstrual)]">
                          {t('dashboard.periodLate')} · {t('dashboard.daysOverdue', { count: nextPeriodDaysLate })}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-[var(--color-text-primary)]">
                          {formatShortDate(language, parseISO(firstPredictedPeriod.date))}
                        </span>
                      )}
                    </div>
                  )}
                  {ovulationDay && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div aria-hidden="true" className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-ovulation)' }} />
                        <span className="text-xs text-[var(--color-text-secondary)]">{t('calendar.ovulationDayLabel')}</span>
                      </div>
                      <span className="text-xs font-bold text-[var(--color-text-primary)]">
                        {formatShortDate(language, parseISO(ovulationDay.date))}
                      </span>
                    </div>
                  )}
                  {fertileWindow && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div aria-hidden="true" className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-fertile)' }} />
                        <span className="text-xs text-[var(--color-text-secondary)]">{t('calendar.fertileWindow')}</span>
                      </div>
                      <span className="text-xs font-bold text-[var(--color-text-primary)]">
                        {formatShortDate(language, parseISO(fertileWindow.start))}
                        {' – '}
                        {formatShortDate(language, parseISO(fertileWindow.end))}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Empty state when no day selected. */}
          {!selectedDate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
            >
              <Card tone="panel" padding="sm">
                <p className="flex items-center justify-center gap-2 text-sm text-[var(--color-text-muted)]">
                  <CalendarDays size={14} aria-hidden="true" />
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
      <PeriodLogModal
        open={editingLog !== null}
        profileId={editingLog?.profileId ?? activeProfileId}
        existingLogId={editingLog?.id}
        initialStart={editingLog ? storedDay(editingLog.startDate) : undefined}
        initialEnd={editingLog ? storedDay(editingLog.endDate) : undefined}
        initialFlow={editingLog ? (editingLog.flowIntensity.toLowerCase() as FlowIntensity) : undefined}
        onClose={() => setEditingLog(null)}
        onSaved={() => {
          router.refresh()
          window.dispatchEvent(new CustomEvent('vesta:profile-updated'))
        }}
      />

      {/* ── Log a past period (create mode, starts on the tapped day) ── */}
      <PeriodLogModal
        open={logFromDate !== null}
        profileId={activeProfileId}
        initialStart={logFromDate ?? undefined}
        initialEnd={logFromDate ?? undefined}
        initialFlow="medium"
        onClose={() => setLogFromDate(null)}
        onSaved={() => {
          router.refresh()
          window.dispatchEvent(new CustomEvent('vesta:profile-updated'))
        }}
      />
    </PageContainer>
  )
}
