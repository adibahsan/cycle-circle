'use client'

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'motion/react'
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
} from 'date-fns'
import { bn } from 'date-fns/locale/bn'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { CyclePhase } from '@vesta/shared/types'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { useLanguage } from '@/lib/use-language'
import { DAY_STYLES, TODAY_GLOW, dayStyleKind, type DayStateFlags, type DayStyleKind } from '@/lib/calendar-day-style'
import { dayAccessibleName, gridKeyTarget } from '@/lib/calendar-a11y'
import '@vesta/shared/utils/i18n'

/** What an in-month day shows; days without a state are plain. */
export interface MonthDayState {
  flags: DayStateFlags
  phase: CyclePhase | null
}

/** A hover/focus "+" on some days (e.g. unlogged past days), for hover devices only. */
export interface MonthDayAction {
  show: (date: Date) => boolean
  label: (date: Date) => string
  onActivate: (date: Date) => void
}

export interface MonthGridProps {
  /** Any day in the month shown. */
  month: Date
  onMonthChange: (month: Date) => void
  selected: Date | null
  onSelect: (date: Date) => void
  dayState?: (date: Date) => MonthDayState | undefined
  dayAction?: MonthDayAction
  /** Between the month header and the day grid (e.g. a notice). */
  banner?: ReactNode
  /** Under the grid, inside the card (e.g. the colour key). */
  footer?: ReactNode
  className?: string
}

const NO_FLAGS: DayStateFlags = { isPeriod: false, isFertile: false, isOvulation: false, isFuturePredicted: false }

const NAV_BUTTON =
  'min-w-11 min-h-11 inline-flex items-center justify-center rounded-xl hover:bg-[var(--color-bg-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]/40'

interface DayCellProps {
  date: Date
  inMonth: boolean
  kind: DayStyleKind
  label: string
  isToday: boolean
  isSelected: boolean
  /** Roving tabindex: the one day in the tab order. */
  isFocusTarget: boolean
  /** Move DOM focus here (set after a keyboard move in the grid). */
  focusNow: boolean
  onSelect: (date: Date) => void
  onFocusDay: (date: Date) => void
  actionLabel: string | null
  onAction?: (date: Date) => void
}

const DayCell = memo(function DayCell({
  date, inMonth, kind, label, isToday, isSelected, isFocusTarget, focusNow, onSelect, onFocusDay, actionLabel, onAction,
}: DayCellProps) {
  const style = DAY_STYLES[kind]
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (focusNow) buttonRef.current?.focus()
  }, [focusNow])

  return (
    // A stretched card makes the rows taller: the day grows with its row, but never taller than it is wide.
    <div role="gridcell" className={cn('group relative flex items-center w-full', isToday && 'z-[1]')}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => onSelect(date)}
        onFocus={() => onFocusDay(date)}
        aria-pressed={isSelected}
        aria-label={label}
        aria-current={isToday ? 'date' : undefined}
        tabIndex={isFocusTarget ? 0 : -1}
        data-date={format(date, 'yyyy-MM-dd')}
        className="relative flex items-center justify-center w-full h-full min-h-11 md:min-h-14 2xl:min-h-16 max-h-[calc(100cqw/7)] rounded-xl transition-colors duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]/60"
        style={{
          background: isSelected && kind === 'plain' ? 'var(--color-bg-secondary)' : style.background,
          border: style.border,
          boxShadow: isToday ? TODAY_GLOW : undefined,
        }}
      >
        <span
          className={cn(
            'text-sm md:text-base leading-none tabular-nums',
            actionLabel && 'group-hover:opacity-0 group-focus-within:opacity-0 transition-opacity',
            !inMonth && 'opacity-50',
          )}
          style={{ color: inMonth ? style.color : 'var(--color-text-muted)', fontWeight: isToday ? 800 : 600 }}
        >
          {format(date, 'd')}
        </span>

        {/* Selected ring, inset so it stays distinct from today's outer glow */}
        {isSelected && (
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-xl border-2 pointer-events-none"
            style={{ borderColor: 'var(--goal-accent, var(--color-primary))' }}
          />
        )}
      </button>

      {/* On touch, a tap selects the day instead; the page offers the same action for the selected day. */}
      {actionLabel && (
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); onAction?.(date) }}
          aria-label={actionLabel}
          className="absolute inset-0 z-10 hidden [@media(hover:hover)]:flex items-center justify-center rounded-xl text-[var(--color-text-secondary)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]/60"
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  )
})

/**
 * The month day grid used by the calendar and symptoms pages: month header with prev/next, an ARIA grid with
 * roving focus (arrows, Home/End, PageUp/PageDown), one look per day state, today's glow and the selected ring.
 */
export function MonthGrid({ month, onMonthChange, selected, onSelect, dayState, dayAction, banner, footer, className }: MonthGridProps) {
  const { t } = useTranslation()
  const language = useLanguage()
  const dateLocale = language === 'bn' ? bn : undefined
  const headingId = useId()
  const today = useMemo(() => new Date(), [])
  const monthStart = useMemo(() => startOfMonth(month), [month])

  // Roving focus; keyboardMove is true only while arrow/page keys drive focus.
  const [focusedDate, setFocusedDate] = useState<Date | null>(null)
  const [keyboardMove, setKeyboardMove] = useState(false)

  const weeks = useMemo(() => {
    const days = eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 0 }),
      end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 0 }),
    })
    const rows: Date[][] = []
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7))
    return rows
  }, [monthStart])

  /** The one tabbable day: the last focused day in this month, else the selected day, today, or the 1st. */
  const focusDay =
    [focusedDate, selected, today].find((d): d is Date => !!d && isSameMonth(d, monthStart)) ?? monthStart

  const goMonth = (d: Date) => {
    setKeyboardMove(false)
    onMonthChange(startOfMonth(d))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = gridKeyTarget(focusDay, e.key)
    if (!target) return
    e.preventDefault()
    setKeyboardMove(true)
    setFocusedDate(target)
    if (!isSameMonth(target, monthStart)) onMonthChange(startOfMonth(target))
  }

  const handleSelect = useCallback((date: Date) => {
    setKeyboardMove(false)
    setFocusedDate(date)
    onSelect(date)
  }, [onSelect])

  const handleFocusDay = useCallback((date: Date) => {
    setFocusedDate((prev) => (prev && isSameDay(prev, date) ? prev : date))
  }, [])

  const monthLabel = format(monthStart, 'MMMM yyyy', { locale: dateLocale })
  const DOW = [
    t('calendar.sun'), t('calendar.mon'), t('calendar.tue'), t('calendar.wed'),
    t('calendar.thu'), t('calendar.fri'), t('calendar.sat'),
  ]

  return (
    // Narrow side padding on phones keeps each day cell at least 44px wide at 375px.
    // A flex column, so a card stretched taller than its content grows its week rows instead of leaving a gap.
    <Card tone="panel" padding="sm" className={cn('@container flex flex-col px-2 py-2 sm:px-4 md:py-4', className)}>
      <div className="flex items-center justify-between mb-1 md:mb-2">
        <button type="button" onClick={() => goMonth(subMonths(monthStart, 1))} aria-label={t('calendar.previousMonth')} className={NAV_BUTTON}>
          <ChevronLeft size={20} className="text-[var(--color-text-secondary)]" aria-hidden="true" />
        </button>
        <motion.h2
          id={headingId}
          key={format(monthStart, 'yyyy-MM')}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="text-base font-bold text-[var(--color-text-primary)]"
        >
          {monthLabel}
        </motion.h2>
        <button type="button" onClick={() => goMonth(addMonths(monthStart, 1))} aria-label={t('calendar.nextMonth')} className={NAV_BUTTON}>
          <ChevronRight size={20} className="text-[var(--color-text-secondary)]" aria-hidden="true" />
        </button>
      </div>
      {/* Announces month changes (the heading remounts per month, so it can't be the live region). */}
      <p className="sr-only" aria-live="polite">{monthLabel}</p>

      {banner}

      <div role="grid" aria-labelledby={headingId} onKeyDown={handleKeyDown} className="flex flex-1 flex-col">
        <div role="row" className="grid grid-cols-7 mb-1">
          {DOW.map((d) => (
            <div key={d} role="columnheader" className="flex items-center justify-center">
              <span className="text-[11px] md:text-xs font-bold text-[var(--color-text-muted)]">{d}</span>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={format(monthStart, 'yyyy-MM')}
            role="rowgroup"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.22 }}
            className="flex flex-1 flex-col gap-0.5 md:gap-1"
          >
            {weeks.map((week) => (
              <div key={format(week[0], 'yyyy-MM-dd')} role="row" className="grid flex-1 grid-cols-7 gap-0.5 md:gap-1">
                {week.map((date) => {
                  const inMonth = isSameMonth(date, monthStart)
                  const isToday = isSameDay(date, today)
                  const state = inMonth ? dayState?.(date) : undefined
                  const flags = state?.flags ?? NO_FLAGS
                  const phase = state?.phase ?? null
                  const isFocusTarget = inMonth && isSameDay(date, focusDay)
                  return (
                    <DayCell
                      key={format(date, 'yyyy-MM-dd')}
                      date={date}
                      inMonth={inMonth}
                      kind={inMonth ? dayStyleKind(flags, phase) : 'plain'}
                      label={dayAccessibleName({ date, flags, phase, isToday, language }, t)}
                      isToday={isToday}
                      isSelected={!!selected && isSameDay(date, selected)}
                      isFocusTarget={isFocusTarget}
                      focusNow={keyboardMove && isFocusTarget && !!focusedDate && isSameDay(date, focusedDate)}
                      onSelect={handleSelect}
                      onFocusDay={handleFocusDay}
                      actionLabel={inMonth && dayAction?.show(date) ? dayAction.label(date) : null}
                      onAction={dayAction?.onActivate}
                    />
                  )
                })}
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {footer}
    </Card>
  )
}
