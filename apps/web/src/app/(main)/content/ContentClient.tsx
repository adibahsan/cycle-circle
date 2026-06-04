'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { ChevronRight, X } from 'lucide-react'
import DOMPurify from 'dompurify'
import { motion, AnimatePresence } from 'motion/react'
import { useAppStore } from '@/lib/store'
import {
  fadeInUp,
  staggerContainer,
  staggerItem,
  cardHover,
  popIn,
  useMotionSafe,
} from '@/lib/motion'
import { EmptyState } from '@/components/illustrations'
import { getPhaseColor, getPhaseEmoji } from '@vesta/shared/utils/cycle-utils'
import type { CyclePhase } from '@vesta/shared/types'
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

/** Convert uppercase phase string (e.g. "MENSTRUAL") to CyclePhase type */
function toCyclePhase(phase: string): CyclePhase {
  return phase.toLowerCase() as CyclePhase
}

export function ContentClient({ articles, activePhase }: ContentClientProps) {
  const { t } = useTranslation()
  const { language } = useAppStore()
  const router = useRouter()
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const { variants, props } = useMotionSafe()
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const currentFilter = (activePhase as FilterTab) || 'all'

  // ESC-to-close the article modal
  useEffect(() => {
    if (!selectedArticle) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedArticle(null)
    }
    document.addEventListener('keydown', onKey)
    // Focus the close button when modal opens
    closeButtonRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [selectedArticle])

  // Prevent body scroll while modal is open
  useEffect(() => {
    if (selectedArticle) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [selectedArticle])

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

  return (
    <div className="py-4">
      {/* Page heading */}
      <motion.div
        className="mb-5"
        variants={variants(fadeInUp)}
        initial="hidden"
        animate="visible"
      >
        <h2 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)]">
          {t('content.title')}
        </h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          {t('content.subtitle')}
        </p>
      </motion.div>

      {/* Phase filter tabs — animated active pill via layoutId */}
      <div className="mb-5 -mx-4 px-4">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" role="tablist" aria-label={t('content.filterByPhase', 'Filter by phase')}>
          {PHASE_TABS.map(tab => {
            const isActive = currentFilter === tab.id
            const accent =
              tab.id === 'all'
                ? 'var(--color-primary)'
                : getPhaseColor(toCyclePhase(tab.id))
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => handleFilterChange(tab.id)}
                className="relative flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors duration-200 active:scale-95 whitespace-nowrap focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500"
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
                {/* Animated background pill slides between active tabs */}
                {isActive && (
                  <motion.span
                    layoutId="active-tab-pill"
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundColor: accent, zIndex: -1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    aria-hidden="true"
                  />
                )}
                <span aria-hidden="true">{tab.emoji}</span>
                {t(tab.labelKey)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Article list or empty state */}
      {articles.length === 0 ? (
        <motion.div
          variants={variants(fadeInUp)}
          initial="hidden"
          animate="visible"
        >
          <EmptyState
            illustration="articles"
            title={t('content.noArticles')}
            description={t('content.contentComingSoon')}
            animated
          />
        </motion.div>
      ) : (
        <motion.div
          className="space-y-3"
          variants={variants(staggerContainer)}
          initial="hidden"
          animate="visible"
        >
          {articles.map(article => {
            // Derive the primary phase accent from the first cyclePhase tag
            const primaryPhase =
              article.cyclePhases.length > 0
                ? toCyclePhase(article.cyclePhases[0])
                : null
            const phaseAccent = primaryPhase ? getPhaseColor(primaryPhase) : undefined

            return (
              <motion.div
                key={article.id}
                variants={variants(staggerItem)}
                {...props(cardHover)}
              >
                <button
                  onClick={() => setSelectedArticle(article)}
                  className="w-full text-left rounded-2xl p-4 bg-[var(--color-bg-card)] border shadow-soft hover:shadow-glow transition-[color,background-color,border-color,box-shadow] duration-200 group focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500"
                  style={
                    phaseAccent
                      ? ({
                          '--phase-color': phaseAccent,
                          borderColor: `color-mix(in srgb, ${phaseAccent} 35%, transparent)`,
                          backgroundColor: `color-mix(in srgb, ${phaseAccent} 5%, var(--color-bg-card))`,
                        } as React.CSSProperties)
                      : undefined
                  }
                >
                  {/* Phase accent bar at top of card */}
                  {phaseAccent && (
                    <div
                      className="w-8 h-1 rounded-full mb-3"
                      style={{ backgroundColor: phaseAccent }}
                      aria-hidden="true"
                    />
                  )}

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
                                backgroundColor: `${getPhaseColor(toCyclePhase(phase))}20`,
                                color: getPhaseColor(toCyclePhase(phase)),
                              }}
                            >
                              {getPhaseEmoji(toCyclePhase(phase))} {phase}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors mt-1 shrink-0"
                      aria-hidden="true"
                    />
                  </div>
                </button>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* Article modal — AnimatePresence wraps open/close for scale+fade */}
      <AnimatePresence>
        {selectedArticle && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSelectedArticle(null)}
              aria-hidden="true"
            />

            {/* Dialog panel */}
            <motion.div
              key="article-modal"
              role="dialog"
              aria-modal="true"
              aria-label={getTitle(selectedArticle)}
              className="fixed inset-x-4 inset-y-6 z-50 flex flex-col rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-soft overflow-hidden sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-lg sm:inset-y-8"
              style={{ overscrollBehavior: 'contain' }}
              variants={variants(popIn)}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--color-border)]">
                <button
                  ref={closeButtonRef}
                  onClick={() => setSelectedArticle(null)}
                  aria-label={t('common.close', 'Close')}
                  className="flex items-center gap-1 text-sm text-[var(--color-primary)] font-medium hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 rounded"
                >
                  ← {t('content.backToArticles')}
                </button>
                <button
                  onClick={() => setSelectedArticle(null)}
                  aria-label={t('common.close', 'Close')}
                  className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>

              {/* Modal body — scrollable */}
              <div className="flex-1 overflow-y-auto p-5" style={{ overscrollBehavior: 'contain' }}>
                <article>
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
                          style={{ backgroundColor: getPhaseColor(toCyclePhase(phase)) }}
                        >
                          {getPhaseEmoji(toCyclePhase(phase))} {phase}
                        </span>
                      ))}
                    </div>
                  )}

                  <div
                    className="prose prose-sm max-w-none text-[var(--color-text-secondary)] [&_h2]:text-[var(--color-text-primary)] [&_h3]:text-[var(--color-text-primary)] [&_strong]:text-[var(--color-text-primary)] [&_a]:text-[var(--color-primary)]"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(getBody(selectedArticle)) }}
                  />
                </article>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
