'use client'

import { useCallback, useEffect, useRef, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createQueryTracker, type QueryUpdates } from '@vesta/shared/utils/query-tracker'

/**
 * Filter/pagination state kept in the URL. A debounced search can fire before the router lands a
 * just-picked filter, so updates merge into the newest query we asked for (the tracker), not the
 * stale rendered `searchParams` (#138). `page` resets to 1 unless the update sets it.
 * Values listed in `clearOn` (e.g. 'all') delete their key instead of being written.
 */
export function useUrlParams(options: { clearOn?: readonly string[] } = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const clearOn = options.clearOn

  const trackerRef = useRef<ReturnType<typeof createQueryTracker> | null>(null)
  if (!trackerRef.current) trackerRef.current = createQueryTracker(searchParams.toString())
  const searchString = searchParams.toString()
  useEffect(() => {
    trackerRef.current?.sync(searchString)
  }, [searchString])

  const updateParams = useCallback(
    (updates: QueryUpdates) => {
      const normalised: QueryUpdates = {}
      for (const [k, v] of Object.entries(updates)) {
        normalised[k] = typeof v === 'string' && clearOn?.includes(v) ? '' : v
      }
      const query = trackerRef.current!.apply(normalised)
      startTransition(() => {
        router.push(`${pathname}?${query}`)
      })
    },
    [router, pathname, clearOn],
  )

  return { searchParams, updateParams }
}
