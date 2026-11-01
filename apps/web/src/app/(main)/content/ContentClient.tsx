'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, ChevronRight, Droplets, Flower2, Moon, Sprout, type LucideIcon } from 'lucide-react'
import { useLanguage } from '@/lib/use-language'
import { getPhaseColor, parseCyclePhase } from '@vesta/shared/utils/cycle-utils'

/** Phase accent colour for a phase name (article tag / tab id); neutral accent when unknown. */
function phaseColorFor(name: string): string {
  const phase = parseCyclePhase(name)
  return phase ? getPhaseColor(phase) : 'var(--goal-accent)'
}

import '@vesta/shared/utils/i18n'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import { PhaseIcon } from '@/components/ui/PhaseIcon'

type FilterTab = 'all' | 'MENSTRUAL' | 'FOLLICULAR' | 'OVULATION' | 'LUTEAL'

/** Shape of each item returned by listPublishedArticles (excerpts, no full body). */
export interface Article {
  id: string
  slug: string
  titleEn: string
  titleBn: string | null
  excerptEn: string
  excerptBn: string
  cyclePhases: string[]
  publishedAt: Date | string | null
  category: { id?: string; name: string; nameBn?: string | null } | null
  author: { fullName: string | null } | null
}

/** Category chip, already in the order the admin set. */
export interface CategoryChip {
  id: string
  name: string
  nameBn: string | null
}

interface ContentClientProps {
  articles: Article[]
  categories?: CategoryChip[]
  activePhase?: string
  currentPhase?: string | null
}

const PHASE_TABS: { id: FilterTab; labelKey: string; Icon: LucideIcon }[] = [
  { id: 'all', labelKey: 'content.allArticles', Icon: BookOpen },
  { id: 'MENSTRUAL', labelKey: 'dashboard.menstrual', Icon: Droplets },
  { id: 'FOLLICULAR', labelKey: 'dashboard.follicular', Icon: Sprout },
  { id: 'OVULATION', labelKey: 'dashboard.ovulation', Icon: Flower2 },
  { id: 'LUTEAL', labelKey: 'dashboard.luteal', Icon: Moon },
]

export function ContentClient({ articles: allArticles, categories = [], activePhase, currentPhase }: ContentClientProps) {
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const articles = categoryId ? allArticles.filter(a => a.category?.id === categoryId) : allArticles
  const { t } = useTranslation()
  const language = useLanguage()
  const router = useRouter()
  const currentFilter = (activePhase as FilterTab) || 'all'

  // Locale fallback helpers — BN→EN only
  const categoryLabel = (c: { name: string; nameBn?: string | null }) =>
    language === 'bn' && c.nameBn ? c.nameBn : c.name

  const titleIsFallback = (a: Article) => language === 'bn' && !a.titleBn
  // Excerpt fallback: BN user, no BN excerpt available for the card.
  const excerptIsFallback = (a: Article) => language === 'bn' && !a.excerptBn
  // Current-phase surfacing: only when filter is 'all' and currentPhase is known
  const isSurfacing = currentFilter === 'all' && !!currentPhase

  // Stable sort: current-phase articles first, original order preserved within each group
  const displayedArticles = isSurfacing
    ? [
        ...articles.filter(a => a.cyclePhases.includes(currentPhase!)),
        ...articles.filter(a => !a.cyclePhases.includes(currentPhase!)),
      ]
    : articles

  const hasSurfacedArticles =
    isSurfacing && articles.some(a => a.cyclePhases.includes(currentPhase!))

  function handleFilterChange(tab: FilterTab) {
    if (tab === 'all') {
      router.push('/content')
    } else {
      router.push(`/content?phase=${tab}`)
    }
  }

  function getTitle(a: Article) {
    if (language === 'bn' && a.titleBn) return a.titleBn
    return a.titleEn
  }

  function getExcerpt(a: Article) {
    if (language === 'bn' && a.excerptBn) return a.excerptBn
    return a.excerptEn
  }

  return (
    <PageContainer width="canvas" fill>
      <PageHeader title={t('content.title')} subtitle={t('content.subtitle')} />

      {/* Phase filter tabs */}
      <div className="mb-5 -mx-4 px-4">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {PHASE_TABS.map(tab => {
            const isActive = currentFilter === tab.id
            const isCurrentPhaseTab = tab.id !== 'all' && tab.id === currentPhase
            const accent = tab.id === 'all' ? 'var(--goal-accent)' : phaseColorFor(tab.id)
            const onAccent = tab.id === 'all' ? 'var(--color-on-accent)' : `var(--color-on-${tab.id.toLowerCase()})`
            return (
              <button
                key={tab.id}
                onClick={() => handleFilterChange(tab.id)}
                className="flex-none flex items-center gap-1.5 min-h-11 px-4 rounded-full text-sm font-semibold border transition-colors duration-200 active:scale-95 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
                style={
                  isActive
                    ? { backgroundColor: accent, borderColor: accent, color: onAccent }
                    : {
                        backgroundColor: 'var(--color-bg-card)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-secondary)',
                      }
                }
              >
                {/* Subtle current-phase indicator dot */}
                {isCurrentPhaseTab && (
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: isActive ? onAccent : accent }}
                    aria-label={t('content.currentPhase')}
                  />
                )}
                <tab.Icon size={14} aria-hidden="true" />
                {t(tab.labelKey)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Category filter chips, in admin order */}
      {categories.length > 0 && (
        <div className="mb-5 -mx-4 px-4">
          <div
            role="group"
            aria-label={t('content.categoryFilter')}
            className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
          >
            {[{ id: null, label: t('content.allCategories') }, ...categories.map(c => ({ id: c.id, label: categoryLabel(c) }))].map(chip => {
              const isActive = categoryId === chip.id
              return (
                <button
                  key={chip.id ?? 'all'}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setCategoryId(chip.id)}
                  className="flex-none min-h-11 px-4 rounded-full text-sm font-semibold border transition-colors duration-200 active:scale-95 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
                  style={
                    isActive
                      ? { backgroundColor: 'var(--goal-accent)', borderColor: 'var(--goal-accent)', color: 'var(--color-on-accent)' }
                      : { backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }
                  }
                >
                  {chip.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Current-phase surfacing note */}
      {hasSurfacedArticles && (
        <p
          className="text-xs text-[var(--color-text-muted)] mb-3"
          aria-live="polite"
        >
          {t('content.phaseFirstNote', {
            phase: t(`dashboard.${currentPhase!.toLowerCase()}`),
          })}
        </p>
      )}

      {/* Article list */}
      {displayedArticles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center xl:flex-1">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-bg-secondary)] flex items-center justify-center mb-3">
            <BookOpen size={24} className="text-[var(--color-text-muted)]" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
            {t('content.noArticles')}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {t('content.contentComingSoon')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
          {displayedArticles.map(article => {
            const isForCurrentPhase = isSurfacing && article.cyclePhases.includes(currentPhase!)
            // EN chip: shown when a BN user's article falls back to English for its
            // title or excerpt. The reader confirms body fallback via its own banner.
            const showEnChip = excerptIsFallback(article) || titleIsFallback(article)

            return (
              <Link
                key={article.id}
                href={`/content/${article.id}`}
                className="block w-full text-left glass rounded-2xl p-4 hover:border-[var(--goal-accent)]/30 hover:shadow-soft transition-[color,background-color,border-color,box-shadow] duration-200 group focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      {article.category && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--goal-accent)]/10 text-[var(--color-text-primary)]">
                          {categoryLabel(article.category)}
                        </span>
                      )}
                      {/* "For you" badge when surfacing */}
                      {isForCurrentPhase && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold text-[var(--color-on-accent)]"
                          style={{ backgroundColor: 'var(--goal-accent)' }}
                        >
                          {t('content.forYou')}
                        </span>
                      )}
                      {/* EN locale chip */}
                      {showEnChip && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold text-[var(--color-text-muted)] border border-[var(--color-border)]">
                          EN
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-1 leading-snug">
                      {getTitle(article)}
                    </h3>
                    {getExcerpt(article) && (
                      <p className="text-xs text-[var(--color-text-muted)] line-clamp-2">
                        {getExcerpt(article)}
                      </p>
                    )}
                    {article.cyclePhases.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {article.cyclePhases.map(phase => (
                          <span
                            key={phase}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold"
                            style={{
                              backgroundColor: `color-mix(in srgb, ${phaseColorFor(phase)} 13%, transparent)`,
                              color: phaseColorFor(phase),
                            }}
                          >
                            {parseCyclePhase(phase) && <PhaseIcon phase={parseCyclePhase(phase)!} size={11} />}
                            {t(`dashboard.${phase.toLowerCase()}`)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-[var(--color-text-muted)] group-hover:text-[var(--goal-accent)] transition-colors mt-1 shrink-0"
                    aria-hidden="true"
                  />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </PageContainer>
  )
}