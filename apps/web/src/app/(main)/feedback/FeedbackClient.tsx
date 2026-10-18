'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Bug, Lightbulb, MessageSquare, Heart, Star, CheckCircle2 } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { submitFeedback } from '@/app/actions/feedback-actions'
import type { AuthUser } from '@vesta/shared/server/auth'
import '@vesta/shared/utils/i18n'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'

// ── Prisma Feedback shape (from DB) ───────────────────────────────────────────
interface DbFeedback {
  id: string
  userId: string
  profileId: string | null
  category: 'BUG' | 'FEATURE' | 'GENERAL' | 'SATISFACTION'
  message: string
  rating: number | null
  createdAt: Date
}

// ── Animation presets ──────────────────────────────────────────────────────────
const EASE_OUT = 'easeOut' as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FADE_UP: any = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.4, ease: EASE_OUT },
  }),
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const POP: any = {
  hidden: { opacity: 0, scale: 0.85 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: EASE_OUT } },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.25 } },
}

// ── Category config ────────────────────────────────────────────────────────────
type UiCategory = 'bug' | 'feature' | 'general' | 'satisfaction'
// Mapping from UI lowercase to Prisma enum
const UI_TO_DB: Record<UiCategory, DbFeedback['category']> = {
  bug: 'BUG',
  feature: 'FEATURE',
  general: 'GENERAL',
  satisfaction: 'SATISFACTION',
}
const DB_TO_UI: Record<DbFeedback['category'], UiCategory> = {
  BUG: 'bug',
  FEATURE: 'feature',
  GENERAL: 'general',
  SATISFACTION: 'satisfaction',
}

interface CategoryConfig {
  id: UiCategory
  labelKey: string
  Icon: React.ElementType
  color: string
  on: string
  bg: string
}

const CATEGORIES: CategoryConfig[] = [
  { id: 'bug', labelKey: 'feedback.bug', Icon: Bug, color: 'var(--color-error)', on: 'var(--color-on-action)', bg: 'color-mix(in srgb, var(--color-error) 8%, transparent)' },
  {
    id: 'feature',
    labelKey: 'feedback.feature',
    Icon: Lightbulb,
    color: 'var(--color-secondary)',
    on: 'var(--color-on-luteal)',
    bg: 'color-mix(in srgb, var(--color-secondary) 8%, transparent)',
  },
  { id: 'general', labelKey: 'feedback.general', Icon: MessageSquare, color: 'var(--color-coral)', on: 'var(--color-on-fertile)', bg: 'color-mix(in srgb, var(--color-coral) 10%, transparent)' },
  {
    id: 'satisfaction',
    labelKey: 'feedback.satisfaction',
    Icon: Heart,
    color: 'var(--goal-accent)',
    on: 'var(--color-on-accent)',
    bg: 'var(--color-bg-secondary)',
  },
]

const MAX_CHARS = 500

// ── Star Rating ────────────────────────────────────────────────────────────────
function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(0)

  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={t('feedback.starRating')}>
      {[1, 2, 3, 4, 5].map(star => {
        const filled = star <= (hovered || value)
        return (
          <motion.button
            key={star}
            type="button"
            whileTap={{ scale: 0.85 }}
            whileHover={{ scale: 1.15 }}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(value === star ? 0 : star)}
            aria-label={t('feedback.starCount', { count: star })}
            className="p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
          >
            <Star aria-hidden="true"
              size={28}
              className="transition-colors duration-150"
              fill={filled ? 'var(--goal-accent)' : 'transparent'}
              stroke={filled ? 'var(--goal-accent)' : 'var(--color-border)'}
              strokeWidth={1.8}
            />
          </motion.button>
        )
      })}
      {value > 0 && (
        <span className="ml-1 text-xs text-[var(--color-text-muted)] font-medium">
          {value === 1
            ? t('feedback.poor')
            : value === 2
              ? t('feedback.fair')
              : value === 3
                ? t('feedback.good')
                : value === 4
                  ? t('feedback.great')
                  : t('feedback.excellent')}
        </span>
      )}
    </div>
  )
}

// ── Mini Star display (read-only) ──────────────────────────────────────────────
function StarDisplay({ rating }: { rating?: number | null }) {
  if (!rating) return null
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          size={12}
          fill={s <= rating ? 'var(--goal-accent)' : 'transparent'}
          stroke={s <= rating ? 'var(--goal-accent)' : 'var(--color-border)'}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

// ── Category badge (for history) ───────────────────────────────────────────────
function CategoryHistoryBadge({ category }: { category: DbFeedback['category'] }) {
  const uiCat = DB_TO_UI[category]
  const cfg = CATEGORIES.find(c => c.id === uiCat)!
  const { Icon } = cfg
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      <Icon size={10} />
      {uiCat.charAt(0).toUpperCase() + uiCat.slice(1)}
    </span>
  )
}

// ── History item ───────────────────────────────────────────────────────────────
function HistoryItem({ item, index }: { item: DbFeedback; index: number }) {
  const date = new Date(item.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <motion.div custom={index} variants={FADE_UP} initial="hidden" animate="show">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 mb-3 last:mb-0">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <CategoryHistoryBadge category={item.category} />
          <span className="text-[11px] text-[var(--color-text-muted)] flex-none">{date}</span>
        </div>
        {item.message && (
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-1.5 line-clamp-2">
            {item.message}
          </p>
        )}
        <StarDisplay rating={item.rating} />
      </div>
    </motion.div>
  )
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface FeedbackClientProps {
  user: AuthUser
  feedbackHistory: DbFeedback[]
}

// ── Main Client Component ──────────────────────────────────────────────────────
export function FeedbackClient({ feedbackHistory }: FeedbackClientProps) {
  const { t } = useTranslation()
  const activeProfileId = useAppStore((s) => s.activeProfileId)

  const [selectedCategory, setSelectedCategory] = useState<UiCategory | null>(null)
  const [rating, setRating] = useState(0)
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!selectedCategory) return

    setSubmitting(true)
    setError(null)
    try {
      await submitFeedback({
        profileId: activeProfileId || undefined,
        category: UI_TO_DB[selectedCategory],
        message: message.trim() || 'No message',
        rating: rating || undefined,
      })
      setSubmitted(true)
      setTimeout(() => {
        setSubmitted(false)
        setSelectedCategory(null)
        setRating(0)
        setMessage('')
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageContainer width="canvas">
      {/* ── Page header ── */}
      <PageHeader title={t('feedback.title')} subtitle={t('feedback.helpUs')} />

      {/* ── Feedback Form Card + History (side-by-side on desktop) ── */}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start">
        <motion.div custom={1} variants={FADE_UP} initial="hidden" animate="show">
          <Card padding="md">
            <AnimatePresence mode="wait">
              {submitted ? (
                /* ── Success state ── */
                <motion.div
                  key="success"
                  variants={POP}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="flex flex-col items-center py-8 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                    style={{
                      background:
                        'linear-gradient(135deg, var(--goal-accent) 0%, var(--color-secondary) 100%)',
                    }}
                  >
                    <CheckCircle2 size={32} className="text-[var(--color-on-accent)]" aria-hidden="true" />
                  </motion.div>
                  <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">
                    {t('feedback.success')}
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {t('feedback.yourFeedbackHelps')}
                  </p>
                </motion.div>
              ) : (
                /* ── Form state ── */
                <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {/* Category selector */}
                  <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">
                    {t('feedback.category')}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
                    {CATEGORIES.map(cat => {
                      const { Icon } = cat
                      const isSelected = selectedCategory === cat.id
                      return (
                        <motion.button
                          key={cat.id}
                          type="button"
                          whileTap={{ scale: 0.96 }}
                          onClick={() => setSelectedCategory(cat.id)}
                          className="relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-colors duration-200 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
                          style={
                            isSelected
                              ? { borderColor: cat.color, backgroundColor: cat.bg }
                              : {
                                  borderColor: 'var(--color-border)',
                                  backgroundColor: 'var(--color-bg-primary)',
                                }
                          }
                        >
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{
                              backgroundColor: isSelected ? cat.color : 'var(--color-bg-secondary)',
                            }}
                          >
                            <Icon size={18} style={{ color: isSelected ? cat.on : cat.color }} />
                          </div>
                          <span
                            className="text-xs font-semibold leading-tight"
                            style={{
                              color: isSelected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                            }}
                          >
                            {t(cat.labelKey)}
                          </span>
                          {isSelected && (
                            <motion.div
                              layoutId="category-check"
                              className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: cat.color }}
                            >
                              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                                <path
                                  d="M1.5 4l2 2 3-3"
                                  stroke={cat.on}
                                  strokeWidth="1.4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </motion.div>
                          )}
                        </motion.button>
                      )
                    })}
                  </div>

                  {/* Star rating */}
                  <div className="mb-5">
                    <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
                      {t('feedback.rating')}{' '}
                      <span className="text-[var(--color-text-muted)] font-normal">
                        ({t('feedback.optional')})
                      </span>
                    </p>
                    <StarRating value={rating} onChange={setRating} />
                  </div>

                  {/* Message textarea */}
                  <div className="mb-5">
                    <label htmlFor="feedback-message" className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2 block">
                      {t('feedback.messageLabel')}{' '}
                      <span className="text-[var(--color-text-muted)] font-normal">
                        ({t('feedback.optional')})
                      </span>
                    </label>
                    <div className="relative">
                      <textarea
                        id="feedback-message"
                        rows={4}
                        maxLength={MAX_CHARS}
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        placeholder={t('feedback.message')}
                        className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]/30 focus-visible:border-[var(--goal-accent)] transition-colors transition-shadow duration-200"
                      />
                      <span
                        className="absolute bottom-2.5 right-3 text-[11px] font-medium"
                        style={{
                          color:
                            message.length > MAX_CHARS * 0.9
                              ? 'var(--goal-accent)'
                              : 'var(--color-text-muted)',
                        }}
                      >
                        {message.length}/{MAX_CHARS}
                      </span>
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <p className="mb-3 text-xs text-[var(--color-error)] text-center">{error}</p>
                  )}

                  {/* Submit */}
                  <div aria-live="polite" aria-atomic="true" className="sr-only">
                    {submitting ? t('feedback.submitting') : ''}
                  </div>
                  <Button
                    fullWidth
                    size="lg"
                    disabled={!selectedCategory || submitting}
                    onClick={handleSubmit}
                    className="rounded-2xl font-bold"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8H4z"
                          />
                        </svg>
                        {t('feedback.submitting')}
                      </span>
                    ) : (
                      t('feedback.submit')
                    )}
                  </Button>

                  {!selectedCategory && (
                    <p className="mt-2 text-center text-xs text-[var(--color-text-muted)]">
                      {t('feedback.selectCategory')}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>

        {/* ── Feedback History ── */}
        <motion.div custom={2} variants={FADE_UP} initial="hidden" animate="show">
          <Card padding="md">
            <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-3">
              {t('feedback.previousFeedback')}
            </h2>
            {feedbackHistory.length > 0 ? (
              feedbackHistory.map((item, i) => (
                <HistoryItem key={item.id} item={item} index={i} />
              ))
            ) : (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-6">
                {t('feedback.noFeedbackYet')}
              </p>
            )}
          </Card>
        </motion.div>
      </div>
    </PageContainer>
  )
}
