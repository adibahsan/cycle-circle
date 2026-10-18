'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { BookOpen, CalendarDays, ChartLine, Droplets, HeartPulse, Users, type LucideIcon } from 'lucide-react'
import type { CyclePhase } from '@vesta/shared/types'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { TINT_CLASSES, type CardTint } from '@/components/ui/tints'
import { PILL_ACTION } from '@/components/ui/action-styles'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { cn } from '@/lib/cn'

export interface PhaseArticle {
  id: string
  titleEn: string
  titleBn: string | null
}

interface DashboardToolkitProps {
  language: string
  /** Null outside a live cycle (pregnancy, menopause, no period): the read card links to all articles. */
  phase: CyclePhase | null
  /** Published articles tagged with the current phase (already filtered on the server). */
  articles: PhaseArticle[]
  /** Null hides the Log period card (the first-run hero holds the only Log period button). */
  onLogPeriod: (() => void) | null
  onLogSymptoms: () => void
  className?: string
}

const ACTION = `${PILL_ACTION} ml-auto shrink-0 whitespace-nowrap px-4`

function ToolCard({
  tone,
  Icon,
  title,
  body,
  keepBody = false,
  children,
}: {
  tone: CardTint
  Icon: LucideIcon
  title: string
  body?: React.ReactNode
  /** Body is content, not a description: shown at every width. */
  keepBody?: boolean
  /** The card's single action: one link or one button. */
  children: React.ReactNode
}) {
  return (
    <li data-testid="toolkit-card" className="@container list-none">
      {/* One compact row: icon, what it is, the action. Keeps the whole toolkit in the first view. */}
      <Card tone={tone} padding="sm" className="flex h-full flex-wrap items-center gap-x-3 gap-y-2 pr-3.5">
        <span
          aria-hidden="true"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-bg-card)] ${TINT_CLASSES[tone].ink}`}
        >
          <Icon size={20} strokeWidth={1.75} />
        </span>
        {/* The title keeps room to read; a long action label (Bengali) wraps to its own line instead of covering it. */}
        <div className="min-w-[4rem] flex-1">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{title}</h3>
          {/* A plain description only where the tile has room for it; title and action carry it otherwise. */}
          {body ? (
            <div className={cn('mt-0.5 text-xs text-[var(--color-text-secondary)]', keepBody ? 'line-clamp-3' : 'hidden @[20rem]:line-clamp-2')}>
              {body}
            </div>
          ) : null}
        </div>
        {children}
      </Card>
    </li>
  )
}

export function DashboardToolkit({ language, phase, articles, onLogPeriod, onLogSymptoms, className }: DashboardToolkitProps) {
  const { t } = useTranslation()
  // Bengali shows only translated titles, so no English slips onto a Bengali page.
  const shown = articles.filter((a) => language !== 'bn' || !!a.titleBn).slice(0, 3)
  const title = (a: PhaseArticle) => (language === 'bn' && a.titleBn ? a.titleBn : a.titleEn)

  return (
    <section aria-labelledby="toolkit-title" className={className}>
      <SectionHeader id="toolkit-title" title={t('dashboard.toolkitTitle')} subtitle={t('dashboard.toolkitSub')} variant="inline" />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {onLogPeriod && (
          <ToolCard tone="pink" Icon={Droplets} title={t('dashboard.toolLogPeriodTitle')} body={t('dashboard.toolLogPeriodBody')}>
            <Button variant="primary" size="sm" onClick={onLogPeriod} className="ml-auto min-h-11 shrink-0 whitespace-nowrap px-4" data-tour="log-button">
              {t('dashboard.logPeriod')}
            </Button>
          </ToolCard>
        )}
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
          title={phase ? t('dashboard.toolReadTitle') : t('dashboard.toolReadAllTitle')}
          keepBody={!!phase}
          body={
            !phase ? (
              t('dashboard.toolReadAllBody')
            ) : shown.length > 0 ? (
              <ul data-testid="phase-articles" className="flex flex-col gap-0.5">
                {shown.map((a) => (
                  <li key={a.id} className="truncate font-medium text-[var(--color-text-primary)]">
                    {title(a)}
                  </li>
                ))}
              </ul>
            ) : (
              <p data-testid="phase-articles-empty">{t('dashboard.toolReadEmpty')}</p>
            )
          }
        >
          <Link href={phase ? `/content?phase=${phase.toUpperCase()}` : '/content'} className={ACTION}>
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
