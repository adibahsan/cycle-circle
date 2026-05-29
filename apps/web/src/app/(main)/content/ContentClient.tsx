'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { BookOpen, ChevronRight } from 'lucide-react'
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

export function ContentClient({ articles, activePhase }: ContentClientProps) {
  const { t } = useTranslation()
  const { language } = useAppStore()
  const router = useRouter()
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)

  const currentFilter = (activePhase as FilterTab) || 'all'

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
          className="flex items-center gap-1 text-sm text-[var(--color-primary)] font-medium mb-4 hover:underline"
        >
          ← {t('content.backToArticles')}
        </button>

        <article className="glass rounded-2xl p-6">
          {selectedArticle.category && (
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--color-primary)]/10 text-[var(--color-primary)] mb-3">
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

          <div
            className="prose prose-sm max-w-none text-[var(--color-text-secondary)] [&_h2]:text-[var(--color-text-primary)] [&_h3]:text-[var(--color-text-primary)] [&_strong]:text-[var(--color-text-primary)] [&_a]:text-[var(--color-primary)]"
            dangerouslySetInnerHTML={{ __html: getBody(selectedArticle) }}
          />
        </article>
      </div>
    )
  }

  return (
    <div className="py-4">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
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
            const accent = tab.id === 'all' ? 'var(--color-primary)' : getPhaseColor(tab.id.toLowerCase() as any)
            return (
              <button
                key={tab.id}
                onClick={() => handleFilterChange(tab.id)}
                className="flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 active:scale-95 whitespace-nowrap"
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
                <span>{tab.emoji}</span>
                {t(tab.labelKey)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Article list */}
      {articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-bg-secondary)] flex items-center justify-center mb-3">
            <BookOpen size={24} className="text-[var(--color-text-muted)]" />
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
          {articles.map(article => (
            <button
              key={article.id}
              onClick={() => setSelectedArticle(article)}
              className="w-full text-left glass rounded-2xl p-4 hover:border-[var(--color-primary)]/30 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {article.category && (
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--color-primary)]/10 text-[var(--color-primary)] mb-1.5">
                      {article.category.name}
                    </span>
                  )}
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
                  className="text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors mt-1 shrink-0"
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
