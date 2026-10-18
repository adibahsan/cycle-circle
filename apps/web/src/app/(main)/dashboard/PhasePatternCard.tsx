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
import { TINT_CLASSES, type CardTint } from '@/components/ui/tints'
import { PILL_ACTION } from '@/components/ui/action-styles'
import { formatCount } from './format'

export interface PhasePatternItem {
  symptomId: string
  count: number
}

/** One pastel per rank. */
const TILE_TINTS: CardTint[] = ['mint', 'lavender', 'peach']

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
                  className={cn('flex items-center gap-3 rounded-2xl p-3 sm:flex-col sm:items-start', TINT_CLASSES[TILE_TINTS[i % TILE_TINTS.length]].surface)}
                >
                  <span
                    className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-card)]', TINT_CLASSES[TILE_TINTS[i % TILE_TINTS.length]].ink)}
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
          <div data-testid="phase-pattern-empty" className={cn('flex items-start gap-3 rounded-2xl p-4', TINT_CLASSES.sky.surface)}>
            <span
              className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-card)]', TINT_CLASSES.sky.ink)}
              aria-hidden="true"
            >
              <NotebookPen size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-[var(--color-text-primary)]">{t('dashboard.patternEmpty')}</p>
              <Link
                href="/symptoms"
                className={cn(PILL_ACTION, 'mt-3')}
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
