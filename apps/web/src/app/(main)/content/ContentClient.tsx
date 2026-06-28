'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { BookOpen, ChevronRight, Info } from 'lucide-react'
import DOMPurify from 'dompurify'
import { useAppStore } from '@/lib/store'
import { getPhaseColor, getPhaseEmoji } from '@vesta/shared/utils/cycle-utils'
import '@vesta/shared/utils/i18n'

type FilterTab = 'all' | 'MENSTRUAL' | 'FOLLICULAR' | 'OVULATION' | 'LUTEAL'

interface Article {
  id: string
  slug: string
  titleEn: string
  titleBn: string | null
  bodyEn: string
  bodyBn: string | null
  cyclePhases: string[]
  publishedAt: Date | string | null
  category: { name: string } | null
  author: { fullName: string | null } | null
}

interface ContentClientProps {
  articles: Article[]
  activePhase?: string
  currentPhase?: string | null
}

const PHASE_TABS: { id: FilterTab; labelKey: string; emoji: string }[] = [
  { id: 'all', labelKey: 'content.allArticles', emoji: '📚' },
  { id: 'MENSTRUAL', labelKey: 'dashboard.menstrual', emoji: '🩸' },
  { id: 'FOLLICULAR', labelKey: 'dashboard.follicular', emoji: '🌱' },
  { id: 'OVULATION', labelKey: 'dashboard.ovulation', emoji: '🌸' },
  { id: 'LUTEAL', labelKey: 'dashboard.luteal', emoji: '🌙' },
]

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

export function ContentClient({ articles, activePhase, currentPhase }: ContentClientProps) {
  const { t } = useTranslation()
  const { language } = useAppStore()
  const router = useRouter()
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)

  const currentFilter = (activePhase as FilterTab) || 'all'

  // Locale fallback helpers — BN→EN only
  const titleIsFallback = (a: Article) => language === 'bn' && !a.titleBn
  const bodyIsFallback = (a: Article) => language === 'bn' && !a.bodyBn

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

  function getBody(a: Article) {
    if (language === 'bn' && a.bodyBn) return a.bodyBn
    return a.bodyEn
  }

  function getExcerpt(a: Article) {
    const text = stripHtml(getBody(a))
    return text.length > 120 ? text.slice(0, 120) + '…' : text
  }

  if (selectedArticle) {
    return (
      <div className="py-4">
        <button
          onClick={() => setSelectedArticle(null)}
          className="flex items-center gap-1 text-sm text-[var(--goal-accent)] font-medium mb-4 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] rounded"
        >
          ← {t('content.backToArticles')}
        </button>

        <article className="glass rounded-2xl p-6">
          {selectedArticle.category && (
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--goal-accent)]/10 text-[var(--goal-accent)] mb-3">
              {selectedArticle.category.name}
            </span>
          )}

          <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
            {getTitle(selectedArticle)}
          </h1>

          {selectedArticle.cyclePhases.length > 0 && (
            <div className="flex gap-1.5 mb-4">
              {selectedArticle.cyclePhases.map(phase => (
                <span
                  key={phase}
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                  style={{ backgroundColor: getPhaseColor(phase.toLowerCase() as any) }}
                >
                  {getPhaseEmoji(phase.toLowerCase() as any)} {phase}
                </span>
              ))}
            </div>
          )}

          {/* Locale fallback banner — BN user viewing EN-only article */}
          {bodyIsFallback(selectedArticle) && (
            <div
              role="note"
              className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] text-xs"
            >
              <Info size={13} aria-hidden="true" className="shrink-0" />
              <span>{t('content.showingInEnglish')}</span>
            </div>
          )}

          <div
            className="prose prose-sm max-w-none text-[var(--color-text-secondary)] [&_h2]:text-[var(--color-text-primary)] [&_h3]:text-[var(--color-text-primary)] [&_strong]:text-[var(--color-text-primary)] [&_a]:text-[var(--goal-accent)]"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(getBody(selectedArticle)) }}
          />
        </article>
      </div>
    )
  }

  return (
    <div className="py-4">
      <div className="mb-5">
        <h2 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)]">
          {t('content.title')}
        </h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          {t('content.subtitle')}
        </p>
      </div>

      {/* Phase filter tabs */}
      <div className="mb-5 -mx-4 px-4">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {PHASE_TABS.map(tab => {
            const isActive = currentFilter === tab.id
            const isCurrentPhaseTab = tab.id !== 'all' && tab.id === currentPhase
            const accent = tab.id === 'all' ? 'var(--goal-accent)' : getPhaseColor(tab.id.toLowerCase() as any)
            return (
              <button
                key={tab.id}
                onClick={() => handleFilterChange(tab.id)}
                className="flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors duration-200 active:scale-95 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
                style={
                  isActive
                    ? { backgroundColor: accent, borderColor: accent, color: '#fff' }
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
                    style={{ backgroundColor: isActive ? '#fff' : accent }}
                    aria-label="your current phase"
                  />
                )}
                <span aria-hidden="true">{tab.emoji}</span>
                {t(tab.labelKey)}
              </button>
            )
          })}
        </div>
      </div>

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
        <div className="flex flex-col items-center justify-center py-16 text-center">
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
        <div className="space-y-3">
          {displayedArticles.map(article => {
            const isForCurrentPhase = isSurfacing && article.cyclePhases.includes(currentPhase!)
            const showEnChip = bodyIsFallback(article) || titleIsFallback(article)

            return (
              <button
                key={article.id}
                onClick={() => setSelectedArticle(article)}
                className="w-full text-left glass rounded-2xl p-4 hover:border-[var(--goal-accent)]/30 hover:shadow-soft transition-[color,background-color,border-color,box-shadow] duration-200 group focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      {article.category && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--goal-accent)]/10 text-[var(--goal-accent)]">
                          {article.category.name}
                        </span>
                      )}
                      {/* "For you" badge when surfacing */}
                      {isForCurrentPhase && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                          style={{ backgroundColor: 'var(--goal-accent)' }}
                        >
                          {t('content.forYou')}
                        </span>
                      )}
                      {/* EN locale chip */}
                      {showEnChip && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] border border-[var(--color-border)]">
                          EN
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-1 leading-snug">
                      {getTitle(article)}
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)] line-clamp-2">
                      {getExcerpt(article)}
                    </p>
                    {article.cyclePhases.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {article.cyclePhases.map(phase => (
                          <span
                            key={phase}
                            className="px-1.5 py-0.5 rounded text-[9px] font-semibold"
                            style={{
                              backgroundColor: `${getPhaseColor(phase.toLowerCase() as any)}20`,
                              color: getPhaseColor(phase.toLowerCase() as any),
                            }}
                          >
                            {getPhaseEmoji(phase.toLowerCase() as any)} {phase}
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
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
