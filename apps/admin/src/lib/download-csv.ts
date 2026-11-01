'use client'

import { useSearchParams } from 'next/navigation'
import { parseDateRange } from '@vesta/shared/utils/date-range'

/** Saves CSV text as a file in the browser. */
export function downloadCsv(csv: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Key (`from_to`) of the range in the URL, for CSV file names. Same parser as the page. */
export function useRangeKey(): () => string {
  const searchParams = useSearchParams()
  return () => parseDateRange(Object.fromEntries(searchParams.entries()), new Date()).key
}
