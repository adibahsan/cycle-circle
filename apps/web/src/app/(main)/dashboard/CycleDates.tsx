'use client'

import { useTranslation } from 'react-i18next'
import { parseISO } from 'date-fns'
import { CalendarHeart, Droplets, type LucideIcon } from 'lucide-react'
import type { FlowIntensity } from '@vesta/shared/types'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { TINT_CLASSES, type CardTint } from '@/components/ui/tints'
import { formatShortDate } from '@/lib/format-date'
import { cn } from '@/lib/cn'
import { formatCount } from './format'

export interface LastPeriodFacts {
  /** YYYY-MM-DD. */
  startDate: string
  /** Logged length in days; null when only the profile's start date is known. */
  days: number | null
  /** Logged flow; null when not logged (never a default). */
  flow: FlowIntensity | null
}

export interface PredictedWindows {
  /** YYYY-MM-DD. */
  fertileStart: string
  fertileEnd: string
  ovulationDay: string
}

const FLOW_KEY: Record<FlowIntensity, string> = {
  light: 'dashboard.flowLight',
  medium: 'dashboard.flowMedium',
  heavy: 'dashboard.flowHeavy',
}

function DatesCard({ testId, headingId, tone, Icon, title, children }: {
  testId: string
  headingId: string
  tone: CardTint
  Icon: LucideIcon
  title: string
  children: React.ReactNode
}) {
  return (
    <Card tone={tone} padding="md" className="h-full">
      <section data-testid={testId} aria-labelledby={headingId} className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-card)]', TINT_CLASSES[tone].ink)}
        >
          <Icon size={20} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <SectionHeader id={headingId} title={title} className="!mb-1" />
          {children}
        </div>
      </section>
    </Card>
  )
}

/** Row in the predicted-windows card: a phase-colour dot, a label, and the date(s). */
function WindowRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-1">
      <dt className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </dt>
      <dd className="text-sm font-bold text-[var(--color-text-primary)] tabular-nums">{value}</dd>
    </div>
  )
}

/**
 * Last period and predicted windows (fertile dates, ovulation day), from the profile's own logs and
 * prediction only. A card is left out when its data is missing. Live cycles only, like the predictions.
 */
export function CycleDates({ language, lastPeriod, windows }: {
  language: string
  lastPeriod: LastPeriodFacts | null
  windows: PredictedWindows | null
}) {
  const { t } = useTranslation()
  const date = (ymd: string) => formatShortDate(language, parseISO(ymd))
  if (!lastPeriod && !windows) return null

  return (
    // Sized by its column, not the viewport: two cards side by side in the main column, stacked in the wide-screen rail.
    <div className="@container">
      <div data-testid="cycle-dates" className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
        {lastPeriod && (
          <DatesCard testId="last-period" headingId="last-period-title" tone="pink" Icon={Droplets} title={t('dashboard.datesLastTitle')}>
            <p className="text-lg font-bold text-[var(--color-text-primary)] tabular-nums">{date(lastPeriod.startDate)}</p>
            {(lastPeriod.days != null || lastPeriod.flow) && (
              <p className="text-sm text-[var(--color-text-secondary)] tabular-nums">
                {[
                  lastPeriod.days != null
                    ? t('dashboard.datesLastLength', { count: lastPeriod.days, n: formatCount(language, lastPeriod.days) })
                    : null,
                  lastPeriod.flow ? t('dashboard.datesFlow', { flow: t(FLOW_KEY[lastPeriod.flow]) }) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </DatesCard>
        )}
        {windows && (
          <DatesCard testId="predicted-windows" headingId="predicted-windows-title" tone="mint" Icon={CalendarHeart} title={t('dashboard.datesWindowsTitle')}>
            <dl>
              <WindowRow
                color="var(--color-fertile)"
                label={t('dashboard.datesFertile')}
                value={t('dashboard.datesRange', { start: date(windows.fertileStart), end: date(windows.fertileEnd) })}
              />
              <WindowRow color="var(--color-ovulation)" label={t('dashboard.datesOvulation')} value={date(windows.ovulationDay)} />
            </dl>
          </DatesCard>
        )}
      </div>
    </div>
  )
}
