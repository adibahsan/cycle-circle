'use client'

import { useCallback } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/** Active tab kept in `?<param>=` so tabs can be linked and survive reload. Unknown values fall back. */
export function useUrlTab<T extends string>(keys: readonly T[], fallback: T, param = 'tab') {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const raw = searchParams.get(param)
  const active = keys.find((k) => k === raw) ?? fallback

  const setTab = useCallback(
    (key: T) => {
      const next = new URLSearchParams(searchParams.toString())
      next.set(param, key)
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams, param],
  )

  return [active, setTab] as const
}
