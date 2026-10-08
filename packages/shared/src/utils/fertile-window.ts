export interface FertileDay {
  date: string // YYYY-MM-DD
  fertile: boolean
}

export interface FertileWindow {
  start: string
  end: string
}

const DAY_MS = 86_400_000
const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`)

/**
 * Pick the contiguous fertile run that contains `today`, else the next
 * upcoming run, else the most recent past run. Null if no fertile days.
 * Dates are YYYY-MM-DD strings (compared lexicographically).
 */
export function selectFertileWindow(days: FertileDay[], today: string): FertileWindow | null {
  const fertile = days.filter((d) => d.fertile).sort((a, b) => (a.date < b.date ? -1 : 1))
  if (fertile.length === 0) return null

  const runs: FertileWindow[] = []
  for (const { date } of fertile) {
    const last = runs[runs.length - 1]
    if (last && toMs(date) - toMs(last.end) <= DAY_MS) last.end = date
    else runs.push({ start: date, end: date })
  }

  return (
    runs.find((r) => r.start <= today && today <= r.end) ??
    runs.find((r) => r.start > today) ??
    runs[runs.length - 1]
  )
}
