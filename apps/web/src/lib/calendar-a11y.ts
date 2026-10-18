/**
 * Calendar accessibility: what a day button announces.
 * Every visual state (period, predicted period, fertile, ovulation, follicular/luteal tint, today) is also spoken,
 * so nothing on the calendar is colour-only.
 */
import { addDays, addMonths, startOfWeek } from 'date-fns'
import type { CyclePhase } from '@vesta/shared/types'
import { dayStyleKind, type DayStateFlags } from './calendar-day-style'
import { appLocale } from './language'

export interface DayNameInput {
  date: Date
  flags: DayStateFlags
  /** From `cyclePhaseOn`; announced when it is what the day shows (the follicular/luteal tint). */
  phase?: CyclePhase | null
  isToday: boolean
  language: string
}

export function dayAccessibleName({ date, flags, phase, isToday, language }: DayNameInput, t: (key: string) => string): string {
  const fullDate = new Intl.DateTimeFormat(appLocale(language), {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
  const states: string[] = []
  if (flags.isPeriod) states.push(t(flags.isFuturePredicted ? 'calendar.predictedPeriod' : 'calendar.period'))
  if (flags.isFertile) states.push(t('calendar.fertile'))
  if (flags.isOvulation) states.push(t('calendar.ovulationDay'))
  const kind = dayStyleKind(flags, phase)
  if (kind === 'follicular' || kind === 'luteal') states.push(t(`calendar.${kind}Phase`))
  if (isToday) states.push(t('calendar.today'))
  return [fullDate, ...states].join(', ')
}

/**
 * Where a key moves focus in the day grid (WAI-ARIA date picker pattern), or null for other keys.
 * Arrows: ±1 day / ±1 week. Home/End: start/end of the (Sunday-first) week. PageUp/PageDown: ±1 month.
 */
export function gridKeyTarget(date: Date, key: string): Date | null {
  switch (key) {
    case 'ArrowLeft': return addDays(date, -1)
    case 'ArrowRight': return addDays(date, 1)
    case 'ArrowUp': return addDays(date, -7)
    case 'ArrowDown': return addDays(date, 7)
    case 'Home': return startOfWeek(date, { weekStartsOn: 0 })
    case 'End': return addDays(startOfWeek(date, { weekStartsOn: 0 }), 6)
    case 'PageUp': return addMonths(date, -1)
    case 'PageDown': return addMonths(date, 1)
    default: return null
  }
}
