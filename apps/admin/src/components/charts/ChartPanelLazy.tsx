'use client'

import dynamic from 'next/dynamic'

export const ChartPanel = dynamic(
  () => import('./ChartPanel').then((m) => m.ChartPanel),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] w-full animate-pulse rounded-xl bg-[var(--color-bg-secondary)]" />
    ),
  },
)
