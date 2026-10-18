'use client'

import { useTranslation } from 'react-i18next'
import { parseISO } from 'date-fns'
import { Baby, CalendarClock, Droplets, Flower2, HeartPulse, Sparkles, type LucideIcon } from 'lucide-react'
import type { CyclePhase } from '@vesta/shared/types'
import { Button } from '@/components/ui/Button'
import { Card, type CardTint } from '@/components/ui/Card'
import { PhaseIcon } from '@/components/ui/PhaseIcon'
import { formatShortDate } from '@/lib/format-date'
import { daysSince, type FertileStatus, type PeriodStatus } from './dashboard-model'
import { formatCount } from './format'

interface CycleHeroProps {
  name: string
  language: string
  phase: CyclePhase
  cycleDay: number
  fertile: FertileStatus | null
  period: PeriodStatus | null
  /** YYYY-MM-DD of the predicted next period, when there is one. */
  nextPeriodDate: string | null
}

function Stat({ icon, title, sub, testId }: { icon: React.ReactNode; title: string; sub?: string; testId: string }) {
  return (
    <li
      data-testid={testId}
      className="flex min-w-0 items-center gap-3 rounded-full bg-[var(--color-bg-card)] py-2 pl-2 pr-5"
    >
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-secondary)]">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-sm font-bold leading-tight text-[var(--color-text-primary)] tabular-nums">{title}</span>
        {sub ? <span className="text-xs leading-tight text-[var(--color-text-secondary)] tabular-nums">{sub}</span> : null}
      </span>
    </li>
  )
}

/**
 * Standard-mode hero for a profile with a logged period: greeting plus the three stats.
 * The next-period stat is the dashboard's only place that states the late day count.
 */
export function CycleHero({ name, language, phase, cycleDay, fertile, period, nextPeriodDate }: CycleHeroProps) {
  const { t } = useTranslation()
  const n = (v: number) => formatCount(language, v)
  const date = (ymd: string) => formatShortDate(language, parseISO(ymd))

  const fertileTitle = !fertile
    ? t('dashboard.fertileUnknown')
    : fertile.kind === 'open'
      ? t('dashboard.fertileOpen')
      : fertile.kind === 'opens'
        ? t('dashboard.fertileOpens', { count: fertile.days, n: n(fertile.days) })
        : t('dashboard.fertileClosed')
  const fertileSub = !fertile
    ? undefined
    : fertile.kind === 'open'
      ? t('dashboard.fertileUntil', { date: date(fertile.until) })
      : fertile.kind === 'opens'
        ? t('dashboard.fertileOn', { date: date(fertile.on) })
        : t('dashboard.fertileClosedSub')

  const periodTitle = !period
    ? t('dashboard.nextUnknown')
    : period.kind === 'in'
      ? t('dashboard.nextIn', { count: period.days, n: n(period.days) })
      : period.kind === 'due'
        ? t('dashboard.nextDue')
        : t('dashboard.lateBy', { count: period.days, n: n(period.days) })
  const periodSub =
    period?.kind === 'late'
      ? t('dashboard.lateSub')
      : nextPeriodDate
        ? t('dashboard.expectedOn', { date: date(nextPeriodDate) })
        : undefined

  return (
    <Card tone="pink" padding="lg" className="relative overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-heading text-display text-[var(--color-text-primary)] break-words">
            {t('dashboard.heroHello', { name })}
          </p>
          <p className="mt-2 text-sm md:text-base text-[var(--color-text-secondary)]">{t('dashboard.heroSub')}</p>
        </div>
        {/* Illustration placeholder until the illustration set (#77) lands. */}
        <span
          aria-hidden="true"
          className="hidden sm:flex h-20 w-20 shrink-0 items-center justify-center rounded-panel bg-[var(--color-bg-card)] text-accent-pink"
        >
          <Sparkles size={36} strokeWidth={1.75} />
        </span>
      </div>

      <ul
        data-testid="hero-stats"
        aria-label={t('dashboard.statsLabel')}
        className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
      >
        <Stat
          testId="stat-cycle-day"
          icon={<PhaseIcon phase={phase} size={20} />}
          title={t('dashboard.statCycleDay', { n: n(cycleDay) })}
          sub={t(`dashboard.${phase}`)}
        />
        <Stat
          testId="stat-fertile"
          icon={<Flower2 size={20} aria-hidden="true" className="text-accent-mint" />}
          title={fertileTitle}
          sub={fertileSub}
        />
        <Stat
          testId="stat-next-period"
          icon={<CalendarClock size={20} aria-hidden="true" className="text-accent-pink" />}
          title={periodTitle}
          sub={periodSub}
        />
      </ul>
    </Card>
  )
}

// Full literal classes so Tailwind sees them.
const BADGE_INK: Partial<Record<CardTint, string>> = {
  pink: 'text-accent-pink',
  lavender: 'text-accent-lavender',
  sage: 'text-accent-sage',
}

/** Shared frame for the mode heroes: tinted panel, headline, sub line, icon badge, then content. */
function HeroFrame({
  testId,
  tone,
  Icon,
  title,
  sub,
  headingId,
  children,
}: {
  testId: string
  tone: 'pink' | 'lavender' | 'sage'
  Icon: LucideIcon
  title: string
  sub: string
  headingId: string
  children?: React.ReactNode
}) {
  return (
    <Card tone={tone} padding="lg" className="relative overflow-hidden">
      <section data-testid={testId} aria-labelledby={headingId}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={headingId} className="font-heading text-display text-[var(--color-text-primary)] break-words">
              {title}
            </h2>
            <p className="mt-2 text-sm md:text-base text-[var(--color-text-secondary)]">{sub}</p>
          </div>
          {/* Illustration placeholder until the illustration set (#77) lands. */}
          <span
            aria-hidden="true"
            className={`hidden sm:flex h-20 w-20 shrink-0 items-center justify-center rounded-panel bg-[var(--color-bg-card)] ${BADGE_INK[tone]}`}
          >
            <Icon size={36} strokeWidth={1.75} />
          </span>
        </div>
        {children}
      </section>
    </Card>
  )
}

/** Pregnancy mode: no phases, fertile stat or predictions; just the coming-soon message. */
export function PregnancyHero({ language, lastPeriodStart, onLogSymptoms }: {
  language: string
  /** YYYY-MM-DD of the last logged period, kept as history. */
  lastPeriodStart: string | null
  onLogSymptoms: () => void
}) {
  const { t } = useTranslation()
  return (
    <HeroFrame
      testId="hero-pregnancy"
      headingId="hero-pregnancy-title"
      tone="lavender"
      Icon={Baby}
      title={t('dashboard.pregnancyHeroTitle')}
      sub={t('dashboard.pregnancyHeroBody')}
    >
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={onLogSymptoms} aria-haspopup="dialog" className="min-h-11">
          <HeartPulse size={16} aria-hidden="true" />
          {t('dashboard.logSymptoms')}
        </Button>
        {lastPeriodStart && (
          <p className="text-sm text-[var(--color-text-secondary)] tabular-nums">
            {t('dashboard.lastPeriod')}: {formatShortDate(language, parseISO(lastPeriodStart))}
          </p>
        )}
      </div>
    </HeroFrame>
  )
}

/** Perimenopause/menopause mode: days since the last period, no predictions. */
export function MenopauseHero({ name, language, today, lastPeriodStart }: {
  name: string
  language: string
  /** YYYY-MM-DD on the device clock. */
  today: string
  lastPeriodStart: string | null
}) {
  const { t } = useTranslation()
  const days = lastPeriodStart ? daysSince(today, lastPeriodStart) : null
  return (
    <HeroFrame
      testId="hero-menopause"
      headingId="hero-menopause-title"
      tone="sage"
      Icon={Flower2}
      title={t('dashboard.heroHello', { name })}
      sub={t('dashboard.menopauseHeroSub')}
    >
      <ul aria-label={t('dashboard.statsLabel')} className="mt-6 grid gap-2 sm:grid-cols-2">
        <Stat
          testId="stat-days-since"
          icon={<CalendarClock size={20} aria-hidden="true" className="text-accent-sage" />}
          title={days == null ? t('dashboard.noPeriodYet') : t('dashboard.daysSince', { count: days, n: formatCount(language, days) })}
          sub={
            lastPeriodStart
              ? t('dashboard.lastPeriodOn', { date: formatShortDate(language, parseISO(lastPeriodStart)) })
              : t('dashboard.noPeriodSub')
          }
        />
      </ul>
    </HeroFrame>
  )
}

/** Standard mode with no period logged: ask for the last period start, one action. */
export function FirstPeriodHero({ onLogPeriod }: { onLogPeriod: () => void }) {
  const { t } = useTranslation()
  return (
    <HeroFrame
      testId="hero-first-period"
      headingId="hero-first-period-title"
      tone="pink"
      Icon={Droplets}
      title={t('dashboard.firstPeriodQuestion')}
      sub={t('dashboard.firstPeriodBody')}
    >
      <Button variant="primary" onClick={onLogPeriod} aria-haspopup="dialog" className="mt-6 min-h-11" data-tour="log-button">
        {t('dashboard.logPeriod')}
      </Button>
    </HeroFrame>
  )
}
