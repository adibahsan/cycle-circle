'use client'

import { useTranslation } from 'react-i18next'
import type { CyclePhase } from '@vesta/shared/types'
import { getPhaseColor } from '@vesta/shared/utils/cycle-utils'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { PhaseIcon } from '@/components/ui/PhaseIcon'
import { cn } from '@/lib/cn'
import { TINT_CLASSES, type CardTint } from '@/components/ui/tints'
import { journeySteps, currentJourneyPhase, type CyclePosition } from './dashboard-model'
import { formatCount } from './format'

/** Tint behind the current step. */
const CURRENT_TINT: Record<CyclePhase, CardTint> = {
  menstrual: 'pink',
  follicular: 'sky',
  ovulation: 'mint',
  luteal: 'lavender',
}

interface CycleJourneyProps {
  position: CyclePosition
  language: string
  /** No period logged: draw a dimmed example cycle, labelled and announced as an example. */
  example?: boolean
}

/** Vertical cycle-journey stepper. Phases a short cycle crowds out to 0 days are not drawn. */
export function CycleJourney({ position, language, example = false }: CycleJourneyProps) {
  const { cycleLength, periodLength, phase, cycleDay } = position
  const { t } = useTranslation()
  const n = (v: number) => formatCount(language, v)
  const steps = journeySteps(cycleLength, periodLength)
  // An example has no "you are here": there is no real cycle day yet.
  const current = example ? null : currentJourneyPhase(steps, phase, cycleDay)

  return (
    <Card tone="panel" padding="md" className="@container h-full">
      <section aria-labelledby="journey-title" aria-describedby={example ? 'journey-example-note' : undefined}>
        <SectionHeader
          id="journey-title"
          title={t('dashboard.journeyTitle')}
          subtitle={example ? t('dashboard.exampleJourneySub', { n: n(cycleLength) }) : t('dashboard.journeySub', { n: n(cycleLength) })}
          variant="inline"
        />
        {example && <ExampleNote id="journey-example-note" />}
        {/* Vertical when narrow; one row of phases once the card is wide enough. */}
        <ol
          data-testid="cycle-journey"
          data-example={example || undefined}
          className="flex flex-col @md:grid @md:grid-cols-[repeat(var(--steps),minmax(0,1fr))] @md:gap-2"
          style={{ ['--steps' as string]: steps.length } as React.CSSProperties}
        >
          {steps.map((s, i) => {
            const isCurrent = s.phase === current
            const last = i === steps.length - 1
            return (
              <li
                key={s.phase}
                aria-current={isCurrent ? 'step' : undefined}
                data-days={s.days}
                className="relative flex gap-3 pb-1.5 last:pb-0 @md:flex-col @md:items-center @md:gap-2 @md:pb-0"
              >
                {/* Rail: phase dot and the line to the next step. */}
                {/* Example: only the graphics dim, so the text keeps its contrast. */}
                <span aria-hidden="true" className={cn('relative flex w-9 shrink-0 justify-center @md:w-full', example && 'opacity-40 grayscale')}>
                  <span className="z-10 mt-1.5 @md:mt-0 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-bg-card)] border-2" style={{ borderColor: getPhaseColor(s.phase) }}>
                    <PhaseIcon phase={s.phase} size={16} />
                  </span>
                  {!last && (
                    <span className="absolute top-[2.875rem] bottom-0 w-0.5 bg-[var(--color-border)] @md:top-[1.0625rem] @md:bottom-auto @md:left-[calc(50%+1.375rem)] @md:right-[calc(-50%+0.875rem)] @md:h-0.5 @md:w-auto" />
                  )}
                </span>
                <div
                  className={cn(
                    'flex flex-1 items-center justify-between gap-3 rounded-2xl px-3.5 py-2 @md:w-full @md:flex-col @md:justify-start @md:gap-1.5 @md:px-2 @md:text-center',
                    isCurrent && TINT_CLASSES[CURRENT_TINT[s.phase]].surface,
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">{t(`dashboard.${s.phase}`)}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] tabular-nums">
                      {s.days === 1
                        ? t('dashboard.stepSingle', { start: n(s.start) })
                        : t('dashboard.stepRange', { start: n(s.start), end: n(s.end) })}
                      {' · '}
                      {t('dashboard.stepDays', { count: s.days, n: n(s.days) })}
                    </p>
                  </div>
                  {isCurrent && (
                    <span className="shrink-0 rounded-full bg-[var(--color-bg-card)] px-3 py-1 text-xs font-semibold text-[var(--color-text-primary)]">
                      {t('dashboard.youAreHere')}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </section>
    </Card>
  )
}

/** Visible "Example" badge plus the sentence screen readers get via aria-describedby. */
export function ExampleNote({ id }: { id: string }) {
  const { t } = useTranslation()
  return (
    <p id={id} data-testid="example-note" className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
      <span className="rounded-full bg-[var(--color-bg-secondary)] px-2.5 py-0.5 font-semibold uppercase tracking-wide text-[var(--color-text-primary)]">
        {t('dashboard.exampleBadge')}
      </span>
      {t('dashboard.exampleNote')}
    </p>
  )
}
