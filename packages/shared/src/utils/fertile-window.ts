import { MS_PER_DAY } from './cycle-utils'

export interface FertileDay {
  date: string // YYYY-MM-DD
  fertile: boolean
}

export interface FertileWindow {
  start: string
  end: string
}

const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`)

/**
 * Pick the current cycle's fertile window. Order:
 *  1. the contiguous run containing `today`;
 *  2. the most recent run starting on/after `cycleStart` (last period start)
 *     and before today, so a window already passed this cycle still shows;
 *  3. the next upcoming run;
 *  4. the last past run.
 * Null if no fertile days. Dates are YYYY-MM-DD strings.
 */
export function selectFertileWindow(
  days: FertileDay[],
  today: string,
  cycleStart?: string | null,
): FertileWindow | null {
  const fertile = days.filter((d) => d.fertile).sort((a, b) => (a.date < b.date ? -1 : 1))
  if (fertile.length === 0) return null

  const runs: FertileWindow[] = []
  for (const { date } of fertile) {
    const last = runs[runs.length - 1]
    if (last && toMs(date) - toMs(last.end) <= MS_PER_DAY) last.end = date
    else runs.push({ start: date, end: date })
  }

  const inCycle = cycleStart
    ? [...runs].reverse().find((r) => r.start >= cycleStart && r.start <= today)
    : undefined

  return (
    runs.find((r) => r.start <= today && today <= r.end) ??
    inCycle ??
    runs.find((r) => r.start > today) ??
    runs[runs.length - 1]
  )
}
