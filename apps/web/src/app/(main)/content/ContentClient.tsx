'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { BookOpen, ChevronRight, Info, Loader2 } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { getPhaseColor, getPhaseEmoji } from '@vesta/shared/utils/cycle-utils'
import '@vesta/shared/utils/i18n'
import { getArticleBody } from '@/app/actions/content-actions'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'

type FilterTab = 'all' | 'MENSTRUAL' | 'FOLLICULAR' | 'OVULATION' | 'LUTEAL'

/** Shape of each item returned by listPublishedArticles (excerpts, no full body). */
interface Article {
  id: string
  slug: string
  titleEn: string
  titleBn: string | null
  excerptEn: string
  excerptBn: string
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

export function ContentClient({ articles, activePhase, currentPhase }: ContentClientProps) {
  const { t } = useTranslation()
  const { language } = useAppStore()
  const router = useRouter()
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)

  // Body is fetched on demand when the reader opens.
  const [isBodyLoading, setIsBodyLoading] = useState(false)
  const [bodyError, setBodyError] = useState(false)
  // Sanitized HTML for each locale, stored separately so language switches work
  // without re-fetching.
  const [sanitizedBodyEn, setSanitizedBodyEn] = useState<string | null>(null)
  const [sanitizedBodyBn, setSanitizedBodyBn] = useState<string | null>(null)

  const currentFilter = (activePhase as FilterTab) || 'all'

  // Locale fallback helpers — BN→EN only
  const titleIsFallback = (a: Article) => language === 'bn' && !a.titleBn
  // Excerpt fallback: BN user, no BN excerpt available for the card.
  const excerptIsFallback = (a: Article) => language === 'bn' && !a.excerptBn
  // Body fallback: BN user, body loaded, no BN version available.
  const isBodyFallback = language === 'bn' && sanitizedBodyEn !== null && sanitizedBodyBn === null

  // Resolved body HTML for the current locale.
  const resolvedBodyHtml =
    sanitizedBodyEn !== null
      ? language === 'bn' && sanitizedBodyBn
        ? sanitizedBodyBn
        : sanitizedBodyEn
      : ''

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

  async function handleOpenArticle(article: Article) {
    setSelectedArticle(article)
    setIsBodyLoading(true)
    setBodyError(false)
    setSanitizedBodyEn(null)
    setSanitizedBodyBn(null)

    try {
      const result = await getArticleBody(article.id)
      if (!result) {
        setBodyError(true)
        return
      }
      // Lazy-load DOMPurify: keeps it out of the route's first-load JS bundle.
      const DOMPurify = (await import('dompurify')).default
      setSanitizedBodyEn(DOMPurify.sanitize(result.bodyEn))
      setSanitizedBodyBn(result.bodyBn ? DOMPurify.sanitize(result.bodyBn) : null)
    } catch {
      setBodyError(true)
    } finally {
      setIsBodyLoading(false)
    }
  }

  if (selectedArticle) {
    return (
      <PageContainer>
        <PageHeader title={getTitle(selectedArticle)} />
        <button
          onClick={() => setSelectedArticle(null)}
          className="flex items-center gap-1 text-sm text-[var(--goal-accent)] font-medium mb-4 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] rounded"
        >
          ← {t('content.backToArticles')}
        </button>

        <article className="glass rounded-2xl p-6">
          {selectedArticle.category && (
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[var(--goal-accent)]/10 text-[var(--color-text-primary)] mb-3">
              {selectedArticle.category.name}
            </span>
          )}

          {selectedArticle.cyclePhases.length > 0 && (
            <div className="flex gap-1.5 mb-4">
              {selectedArticle.cyclePhases.map(phase => (
                <span
                  key={phase}
                  className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                  style={{ backgroundColor: getPhaseColor(phase.toLowerCase() as any), color: `var(--color-on-${phase.toLowerCase()})` }}
                >
                  {getPhaseEmoji(phase.toLowerCase() as any)} {phase}
                </span>
              ))}
            </div>
          )}

          {/* Locale fallback banner — BN user viewing EN-only article */}
          {isBodyFallback && (
            <div
              role="note"
              className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] text-xs"
            >
              <Info size={13} aria-hidden="true" className="shrink-0" />
              <span>{t('content.showingInEnglish')}</span>
            </div>
          )}

          {/* Body loading / error / content */}
          {isBodyLoading && (
            <div
              className="flex items-center justify-center py-12"
              aria-live="polite"
              aria-label={t('common.loading')}
            >
              <Loader2
                size={24}
                className="text-[var(--goal-accent)] animate-spin"
                aria-hidden="true"
              />
            </div>
          )}

          {!isBodyLoading && bodyError && (
            <p
              className="text-sm text-[var(--color-text-muted)] py-8 text-center"
              aria-live="polite"
            >
              {t('common.errorLoadingContent')}
            </p>
          )}

          {!isBodyLoading && !bodyError && resolvedBodyHtml && (
            <div
              className="prose prose-sm max-w-none text-[var(--color-text-secondary)] [&_h2]:text-[var(--color-text-primary)] [&_h3]:text-[var(--color-text-primary)] [&_strong]:text-[var(--color-text-primary)] [&_a]:text-[var(--goal-accent)]"
              dangerouslySetInnerHTML={{ __html: resolvedBodyHtml }}
            />
          )}
        </article>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader title={t('content.title')} subtitle={t('content.subtitle')} />

      {/* Phase filter tabs */}
      <div className="mb-5 -mx-4 px-4">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {PHASE_TABS.map(tab => {
            const isActive = currentFilter === tab.id
            const isCurrentPhaseTab = tab.id !== 'all' && tab.id === currentPhase
            const accent = tab.id === 'all' ? 'var(--goal-accent)' : getPhaseColor(tab.id.toLowerCase() as any)
            const onAccent = tab.id === 'all' ? 'var(--color-on-accent)' : `var(--color-on-${tab.id.toLowerCase()})`
            return (
              <button
                key={tab.id}
                onClick={() => handleFilterChange(tab.id)}
                className="flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors duration-200 active:scale-95 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
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
            // EN chip: shown when a BN user's article falls back to English for its
            // title or excerpt. The reader confirms body fallback via its own banner.
            const showEnChip = excerptIsFallback(article) || titleIsFallback(article)

            return (
              <button
                key={article.id}
                onClick={() => handleOpenArticle(article)}
                className="w-full text-left glass rounded-2xl p-4 hover:border-[var(--goal-accent)]/30 hover:shadow-soft transition-[color,background-color,border-color,box-shadow] duration-200 group focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      {article.category && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[var(--goal-accent)]/10 text-[var(--color-text-primary)]">
                          {article.category.name}
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
                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] border border-[var(--color-border)]">
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
                            className="px-1.5 py-0.5 rounded text-[9px] font-semibold"
                            style={{
                              backgroundColor: `color-mix(in srgb, ${getPhaseColor(phase.toLowerCase() as any)} 13%, transparent)`,
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
    </PageContainer>
  )
}