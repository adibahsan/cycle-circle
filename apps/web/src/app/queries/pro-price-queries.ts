import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { bangladeshDayOf } from '@vesta/shared/utils/dhaka-date'
import { getProPriceOn } from '@vesta/shared/server/services'
import { cacheTags, WEB_CACHE_TTL } from '@/lib/cache-tags'

export interface CustomerProPrice {
  amount: number
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY'
}

/**
 * The Pro price in effect today (Bangladesh day), or null if none is set. The cache key holds the
 * day so a scheduled price starts on its day; admin busts the `pro-price` tag when it sets one.
 */
export const getProPrice = cache(async (): Promise<CustomerProPrice | null> => {
  const day = bangladeshDayOf(new Date())
  return unstable_cache(
    async () => {
      const entry = await getProPriceOn(day)
      return entry ? { amount: entry.amount, period: entry.period } : null
    },
    ['pro-price', day],
    { tags: [cacheTags.proPrice], revalidate: WEB_CACHE_TTL },
  )()
})
