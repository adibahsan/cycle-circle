'use client'

import { useTranslation } from 'react-i18next'
import type { CyclePhase } from '@vesta/shared/types'
import { getPhaseColor } from '@vesta/shared/utils/cycle-utils'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import type { PeriodStatus } from './dashboard-model'
import { formatCount } from './format'

interface CycleProgressRingProps {
  cycleDay: number
  cycleLength: number
  phase: CyclePhase
  period: PeriodStatus | null
  language: string
  /** Extra content under the ring (e.g. the unlock meter). */
  children?: React.ReactNode
}

const SIZE = 200
const STROKE = 16
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Progress through this cycle. When the period is overdue the ring is full and says the period is
 * due, without the late day count: the hero's next-period stat is that number's only home.
 */
export function CycleProgressRing({ cycleDay, cycleLength, phase, period, language, children }: CycleProgressRingProps) {
  const { t } = useTranslation()
  const n = (v: number) => formatCount(language, v)
  const progress = Math.min(1, Math.max(0, cycleDay / cycleLength))
  const caption =
    period?.kind === 'in'
      ? t('dashboard.ringToNext', { count: period.days, n: n(period.days) })
      : period
        ? t('dashboard.ringDueSoon')
        : null

  return (
    <Card tone="panel" padding="md" className="h-full">
      <section aria-labelledby="progress-title" className="flex h-full flex-col">
        <SectionHeader id="progress-title" title={t('dashboard.progressTitle')} />
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <div
            role="img"
            aria-label={t('dashboard.ringLabel', { day: n(cycleDay), length: n(cycleLength) })}
            className="relative flex items-center justify-center"
            style={{ width: SIZE, height: SIZE }}
          >
            <svg width={SIZE} height={SIZE} aria-hidden="true" className="absolute -rotate-90">
              <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--color-bg-secondary)" strokeWidth={STROKE} />
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={getPhaseColor(phase)}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
                className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
              />
            </svg>
            <div aria-hidden="true" className="flex flex-col items-center">
              <span data-ring-number className="font-heading text-5xl font-extrabold tracking-tight tabular-nums text-[var(--color-text-primary)]">
                {n(cycleDay)}
              </span>
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                {t('dashboard.day')}
              </span>
            </div>
          </div>
          {caption && <p className="text-sm text-[var(--color-text-secondary)] text-center tabular-nums">{caption}</p>}
        </div>
        {children}
      </section>
    </Card>
  )
}
