'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { NotebookPen } from 'lucide-react'
import type { CyclePhase } from '@vesta/shared/types'
import '@vesta/shared/utils/i18n'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SYMPTOMS_DATA } from '@/lib/symptoms-data'
import { useLanguage } from '@/lib/use-language'
import { cn } from '@/lib/cn'
import { formatCount } from './format'

export interface PhasePatternItem {
  symptomId: string
  count: number
}

// Full literal classes so Tailwind sees them; one pastel per rank.
const TILE_TINTS = ['bg-tint-mint', 'bg-tint-lavender', 'bg-tint-peach'] as const
const TILE_INK = ['text-accent-mint', 'text-accent-lavender', 'text-accent-peach'] as const

interface PhasePatternCardProps {
  phase: CyclePhase
  /** Most-logged symptoms in this phase across completed past cycles, ranked. */
  pattern: PhasePatternItem[]
}

/** Phase pattern (#75): what this profile has logged most often in the current phase before. */
export function PhasePatternCard({ phase, pattern }: PhasePatternCardProps) {
  const { t } = useTranslation()
  const language = useLanguage()
  const items = pattern.flatMap((p) => {
    const symptom = SYMPTOMS_DATA.find((s) => s.id === p.symptomId)
    return symptom ? [{ ...p, symptom }] : []
  })

  return (
    <Card tone="panel" padding="md" className="h-full">
      <section aria-labelledby="phase-pattern-title" data-testid="phase-pattern">
        <SectionHeader
          id="phase-pattern-title"
          title={t('dashboard.patternTitle')}
          subtitle={t('dashboard.patternSub', { phase: t(`dashboard.${phase}`) })}
        />
        {items.length > 0 ? (
          <ul data-testid="phase-pattern-list" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {items.map(({ symptomId, count, symptom }, i) => {
              const Icon = symptom.icon
              return (
                <li
                  key={symptomId}
                  className={cn('flex items-center gap-3 rounded-2xl p-3 sm:flex-col sm:items-start', TILE_TINTS[i % 3])}
                >
                  <span
                    className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-card)]', TILE_INK[i % 3])}
                    aria-hidden="true"
                  >
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-[var(--color-text-primary)]">
                      {language === 'bn' ? symptom.nameBn : symptom.nameEn}
                    </span>
                    <span className="block text-xs text-[var(--color-text-secondary)] tabular-nums">
                      {t('dashboard.patternCount', { count, n: formatCount(language, count) })}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <div data-testid="phase-pattern-empty" className="flex items-start gap-3 rounded-2xl bg-tint-sky p-4">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-card)] text-accent-sky"
              aria-hidden="true"
            >
              <NotebookPen size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-[var(--color-text-primary)]">{t('dashboard.patternEmpty')}</p>
              <Link
                href="/symptoms"
                className="mt-3 inline-flex min-h-11 items-center rounded-full bg-[var(--color-bg-card)] px-5 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
              >
                {t('dashboard.patternLogCta')}
              </Link>
            </div>
          </div>
        )}
      </section>
    </Card>
  )
}
