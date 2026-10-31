// Which Pro price entries are in effect, scheduled, replaced or past (ADR 0011). One rule for the
// admin history and the service that picks the price: the newest entry set for a day wins that day,
// and the price in effect is the winning entry of the latest day on or before today.

export type ProPriceState = 'IN_EFFECT' | 'SCHEDULED' | 'REPLACED' | 'PAST'

interface Dated {
  /** `YYYY-MM-DD`, Bangladesh day. */
  effectiveFrom: string
  createdAt: Date | string
}

/** Newest effective day first, then newest set first: the order the price is picked in. */
export function sortProPriceHistory<T extends Dated>(entries: readonly T[]): T[] {
  return [...entries].sort(
    (a, b) =>
      b.effectiveFrom.localeCompare(a.effectiveFrom) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

/** The history, newest first, each entry with its state as of the Bangladesh day `today`. */
export function withProPriceStates<T extends Dated>(
  entries: readonly T[],
  today: string,
): (T & { state: ProPriceState })[] {
  let inEffectFound = false
  let lastDay: string | null = null
  return sortProPriceHistory(entries).map((entry) => {
    let state: ProPriceState
    if (entry.effectiveFrom === lastDay) {
      state = 'REPLACED'
    } else if (entry.effectiveFrom > today) {
      state = 'SCHEDULED'
    } else if (!inEffectFound) {
      state = 'IN_EFFECT'
      inEffectFound = true
    } else {
      state = 'PAST'
    }
    lastDay = entry.effectiveFrom
    return { ...entry, state }
  })
}
