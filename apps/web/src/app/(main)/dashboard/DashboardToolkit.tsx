'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { BookOpen, CalendarDays, ChartLine, Droplets, HeartPulse, Users, type LucideIcon } from 'lucide-react'
import type { CyclePhase } from '@vesta/shared/types'
import { Button } from '@/components/ui/Button'
import { Card, type CardTint } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'

export interface PhaseArticle {
  id: string
  titleEn: string
  titleBn: string | null
}

interface DashboardToolkitProps {
  language: string
  phase: CyclePhase
  /** Published articles tagged with the current phase (already filtered on the server). */
  articles: PhaseArticle[]
  onLogPeriod: () => void
  onLogSymptoms: () => void
}

// Full literal classes so Tailwind sees them.
const BADGE_INK: Record<CardTint, string> = {
  peach: 'text-accent-peach',
  pink: 'text-accent-pink',
  mint: 'text-accent-mint',
  lavender: 'text-accent-lavender',
  sky: 'text-accent-sky',
  sage: 'text-accent-sage',
}

const ACTION =
  'inline-flex min-h-11 items-center justify-center gap-1.5 self-start rounded-full bg-[var(--color-bg-card)] px-5 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]'

function ToolCard({
  tone,
  Icon,
  title,
  body,
  children,
}: {
  tone: CardTint
  Icon: LucideIcon
  title: string
  body?: React.ReactNode
  /** The card's single action: one link or one button. */
  children: React.ReactNode
}) {
  return (
    <li data-testid="toolkit-card" className="list-none">
      <Card tone={tone} padding="md" className="flex h-full flex-col gap-3">
        <span
          aria-hidden="true"
          className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-bg-card)] ${BADGE_INK[tone]}`}
        >
          <Icon size={24} strokeWidth={1.75} />
        </span>
        <div className="flex-1">
          <h3 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h3>
          {body ? <div className="mt-1 text-sm text-[var(--color-text-secondary)]">{body}</div> : null}
        </div>
        {children}
      </Card>
    </li>
  )
}

export function DashboardToolkit({ language, phase, articles, onLogPeriod, onLogSymptoms }: DashboardToolkitProps) {
  const { t } = useTranslation()
  // Bengali shows only translated titles, so no English slips onto a Bengali page.
  const shown = articles.filter((a) => language !== 'bn' || !!a.titleBn).slice(0, 3)
  const title = (a: PhaseArticle) => (language === 'bn' && a.titleBn ? a.titleBn : a.titleEn)

  return (
    <section aria-labelledby="toolkit-title">
      <SectionHeader id="toolkit-title" title={t('dashboard.toolkitTitle')} subtitle={t('dashboard.toolkitSub')} variant="inline" />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <ToolCard tone="pink" Icon={Droplets} title={t('dashboard.toolLogPeriodTitle')} body={t('dashboard.toolLogPeriodBody')}>
          <Button variant="primary" onClick={onLogPeriod} className="min-h-11 self-start" data-tour="log-button">
            {t('dashboard.logPeriod')}
          </Button>
        </ToolCard>
        <ToolCard tone="peach" Icon={HeartPulse} title={t('dashboard.toolCheckInTitle')} body={t('dashboard.toolCheckInBody')}>
          <button type="button" onClick={onLogSymptoms} aria-haspopup="dialog" className={ACTION}>
            {t('dashboard.logSymptoms')}
          </button>
        </ToolCard>
        <ToolCard tone="sky" Icon={CalendarDays} title={t('nav.calendar')} body={t('dashboard.toolCalendarBody')}>
          <Link href="/calendar" className={ACTION}>
            {t('dashboard.toolCalendarAction')}
          </Link>
        </ToolCard>
        <ToolCard tone="lavender" Icon={ChartLine} title={t('nav.insights')} body={t('dashboard.toolInsightsBody')}>
          <Link href="/insights" className={ACTION}>
            {t('dashboard.toolInsightsAction')}
          </Link>
        </ToolCard>
        <ToolCard
          tone="mint"
          Icon={BookOpen}
          title={t('dashboard.toolReadTitle')}
          body={
            shown.length > 0 ? (
              <ul data-testid="phase-articles" className="flex flex-col gap-1">
                {shown.map((a) => (
                  <li key={a.id} className="line-clamp-2 font-medium text-[var(--color-text-primary)]">
                    {title(a)}
                  </li>
                ))}
              </ul>
            ) : (
              <p data-testid="phase-articles-empty">{t('dashboard.toolReadEmpty')}</p>
            )
          }
        >
          <Link href={`/content?phase=${phase.toUpperCase()}`} className={ACTION}>
            {t('dashboard.toolReadAction')}
          </Link>
        </ToolCard>
        <ToolCard tone="sage" Icon={Users} title={t('nav.profiles')} body={t('dashboard.toolProfilesBody')}>
          <Link href="/profiles" className={ACTION}>
            {t('dashboard.toolProfilesAction')}
          </Link>
        </ToolCard>
      </ul>
    </section>
  )
}
