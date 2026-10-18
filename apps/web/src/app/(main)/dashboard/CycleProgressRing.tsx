'use client'

import { useTranslation } from 'react-i18next'
import type { CyclePhase } from '@vesta/shared/types'
import { getPhaseColor } from '@vesta/shared/utils/cycle-utils'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { cn } from '@/lib/cn'
import { ExampleNote } from './CycleJourney'
import { ringCaption, type PeriodStatus } from './dashboard-model'
import { formatCount } from './format'

interface CycleProgressRingProps {
  cycleDay: number
  cycleLength: number
  phase: CyclePhase
  period: PeriodStatus | null
  language: string
  /** No period logged: draw a dimmed example, labelled and announced as an example. */
  example?: boolean
  /** Extra content under the ring (e.g. the unlock meter). */
  children?: React.ReactNode
}

const SIZE = 200
const STROKE = 16
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Progress through this cycle. When the period is due or overdue the ring is full and says the period is
 * expected, without the late day count: the hero's next-period stat is that number's only home.
 */
export function CycleProgressRing({ cycleDay, cycleLength, phase, period, language, example = false, children }: CycleProgressRingProps) {
  const { t } = useTranslation()
  const n = (v: number) => formatCount(language, v)
  const progress = Math.min(1, Math.max(0, cycleDay / cycleLength))
  const ringValues = { day: n(cycleDay), length: n(cycleLength) }
  const ringLabel = example ? t('dashboard.exampleRingLabel', ringValues) : t('dashboard.ringLabel', ringValues)
  const c = example ? null : ringCaption(period)
  const caption = !c ? null : c.key === 'ringToNext' ? t('dashboard.ringToNext', { count: c.days, n: n(c.days) }) : t('dashboard.ringExpected')

  return (
    <Card tone="panel" padding="md" className="h-full">
      <section aria-labelledby="progress-title" aria-describedby={example ? 'progress-example-note' : undefined} className="flex h-full flex-col">
        <SectionHeader id="progress-title" title={t('dashboard.progressTitle')} />
        {example && <ExampleNote id="progress-example-note" />}
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <div
            role="img"
            aria-label={ringLabel}
            data-example={example || undefined}
            className="relative flex items-center justify-center"
            style={{ width: SIZE, height: SIZE }}
          >
            {/* Example: only the ring dims, so the number keeps its contrast. */}
            <svg width={SIZE} height={SIZE} aria-hidden="true" className={cn('absolute -rotate-90', example && 'opacity-40 grayscale')}>
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
