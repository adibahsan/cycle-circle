// Client-safe: tracks the newest query string a page has asked for, so a delayed
// update (e.g. a debounced search) merges into it rather than a stale snapshot.

export type QueryUpdates = Record<string, string | number | undefined>

export function createQueryTracker(initial: string) {
  let current = initial
  return {
    /** Adopt the URL the router actually landed on. */
    sync(query: string) {
      current = query
    },
    /** Merge `updates` into the newest query, remember it, and return it. `''`/undefined delete a key. */
    apply(updates: QueryUpdates): string {
      const params = new URLSearchParams(current)
      for (const [k, v] of Object.entries(updates)) {
        if (v === '' || v === undefined) params.delete(k)
        else params.set(k, String(v))
      }
      if (!('page' in updates)) params.set('page', '1')
      current = params.toString()
      return current
    },
  }
}
