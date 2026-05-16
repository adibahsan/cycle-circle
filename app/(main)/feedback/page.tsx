'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Bug, Lightbulb, MessageSquare, Heart, Star, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { FeedbackCategory, FeedbackSubmission } from '@/lib/types';
import '@/lib/i18n';

// ── Animation presets ──────────────────────────────────────────────────────
const EASE_OUT = 'easeOut' as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FADE_UP: any = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.4, ease: EASE_OUT },
  }),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const POP: any = {
  hidden: { opacity: 0, scale: 0.85 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: EASE_OUT } },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.25 } },
};

// ── Category config ────────────────────────────────────────────────────────
interface CategoryConfig {
  id: FeedbackCategory;
  labelKey: string;
  Icon: React.ElementType;
  color: string;
  bg: string;
}

const CATEGORIES: CategoryConfig[] = [
  {
    id: 'bug',
    labelKey: 'feedback.bug',
    Icon: Bug,
    color: '#EF4444',
    bg: '#FEF2F2',
  },
  {
    id: 'feature',
    labelKey: 'feedback.feature',
    Icon: Lightbulb,
    color: 'var(--color-secondary)',
    bg: '#F5F0FF',
  },
  {
    id: 'general',
    labelKey: 'feedback.general',
    Icon: MessageSquare,
    color: '#3B82F6',
    bg: '#EFF6FF',
  },
  {
    id: 'satisfaction',
    labelKey: 'feedback.satisfaction',
    Icon: Heart,
    color: 'var(--color-primary)',
    bg: 'var(--color-bg-secondary)',
  },
];

const MAX_CHARS = 500;

// ── Star Rating ────────────────────────────────────────────────────────────
function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map(star => {
        const filled = star <= (hovered || value);
        return (
          <motion.button
            key={star}
            type="button"
            whileTap={{ scale: 0.85 }}
            whileHover={{ scale: 1.15 }}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(value === star ? 0 : star)}
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
            className="p-0.5 transition-colors focus:outline-none"
          >
            <Star
              size={28}
              className="transition-colors duration-150"
              fill={filled ? 'var(--color-primary)' : 'transparent'}
              stroke={filled ? 'var(--color-primary)' : 'var(--color-border)'}
              strokeWidth={1.8}
            />
          </motion.button>
        );
      })}
      {value > 0 && (
        <span className="ml-1 text-xs text-[var(--color-text-muted)] font-medium">
          {value === 1 ? 'Poor' : value === 2 ? 'Fair' : value === 3 ? 'Good' : value === 4 ? 'Great' : 'Excellent'}
        </span>
      )}
    </div>
  );
}

// ── Mini Star display (read-only) ──────────────────────────────────────────
function StarDisplay({ rating }: { rating?: number }) {
  if (!rating) return null;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star
          key={s}
          size={12}
          fill={s <= rating ? 'var(--color-primary)' : 'transparent'}
          stroke={s <= rating ? 'var(--color-primary)' : 'var(--color-border)'}
          strokeWidth={1.8}
        />
      ))}
    </div>
  );
}

// ── Category badge (for history) ───────────────────────────────────────────
function CategoryHistoryBadge({ category }: { category: FeedbackCategory }) {
  const cfg = CATEGORIES.find(c => c.id === category)!;
  const { Icon } = cfg;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      <Icon size={10} />
      {category.charAt(0).toUpperCase() + category.slice(1)}
    </span>
  );
}

// ── History item ───────────────────────────────────────────────────────────
function HistoryItem({ item, index }: { item: FeedbackSubmission; index: number }) {
  const date = new Date(item.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <motion.div
      custom={index}
      variants={FADE_UP}
      initial="hidden"
      animate="show"
    >
      <Card padding="sm" className="mb-3">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <CategoryHistoryBadge category={item.category} />
          <span className="text-[10px] text-[var(--color-text-muted)] flex-none">{date}</span>
        </div>
        {item.message && (
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-1.5 line-clamp-2">
            {item.message}
          </p>
        )}
        <StarDisplay rating={item.rating} />
      </Card>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function FeedbackPage() {
  const { t } = useTranslation();
  const { user, activeProfileId, feedbackHistory, submitFeedback } = useAppStore();

  const [selectedCategory, setSelectedCategory] = useState<FeedbackCategory | null>(null);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Only show feedback for the current user
  const userFeedback = feedbackHistory.filter(f => f.userId === (user?.id ?? 'user-1'));

  async function handleSubmit() {
    if (!selectedCategory) return;

    setSubmitting(true);
    await new Promise(res => setTimeout(res, 700)); // simulate network

    submitFeedback({
      userId: user?.id ?? 'user-1',
      profileId: activeProfileId,
      category: selectedCategory,
      message: message.trim(),
      rating: rating || undefined,
    });

    setSubmitting(false);
    setSubmitted(true);

    // Reset form after success display
    setTimeout(() => {
      setSubmitted(false);
      setSelectedCategory(null);
      setRating(0);
      setMessage('');
    }, 3000);
  }

  return (
    <div className="py-4">
      {/* ── Page header ── */}
      <motion.div
        custom={0}
        variants={FADE_UP}
        initial="hidden"
        animate="show"
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          {t('feedback.title')}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
          Help us make Vesta better for you
        </p>
      </motion.div>

      {/* ── Feedback Form Card ── */}
      <motion.div
        custom={1}
        variants={FADE_UP}
        initial="hidden"
        animate="show"
      >
        <Card padding="md" className="mb-6">
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
                  style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)' }}
                >
                  <CheckCircle2 size={32} className="text-white" />
                </motion.div>
                <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">
                  {t('feedback.success')}
                </h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Your feedback helps us improve Vesta
                </p>
              </motion.div>
            ) : (
              /* ── Form state ── */
              <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {/* Category selector */}
                <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-3">
                  Category
                </p>
                <div className="grid grid-cols-2 gap-2 mb-5">
                  {CATEGORIES.map(cat => {
                    const { Icon } = cat;
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <motion.button
                        key={cat.id}
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setSelectedCategory(cat.id)}
                        className="relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-200 text-center"
                        style={
                          isSelected
                            ? {
                                borderColor: cat.color,
                                backgroundColor: cat.bg,
                              }
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
                          <Icon
                            size={18}
                            style={{ color: isSelected ? '#fff' : cat.color }}
                          />
                        </div>
                        <span
                          className="text-xs font-semibold leading-tight"
                          style={{
                            color: isSelected ? cat.color : 'var(--color-text-secondary)',
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
                              <path d="M1.5 4l2 2 3-3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Star rating */}
                <div className="mb-5">
                  <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                    {t('feedback.rating')}{' '}
                    <span className="text-[var(--color-text-muted)] normal-case font-normal tracking-normal">
                      (optional)
                    </span>
                  </p>
                  <StarRating value={rating} onChange={setRating} />
                </div>

                {/* Message textarea */}
                <div className="mb-5">
                  <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                    Message{' '}
                    <span className="text-[var(--color-text-muted)] normal-case font-normal tracking-normal">
                      (optional)
                    </span>
                  </p>
                  <div className="relative">
                    <textarea
                      rows={4}
                      maxLength={MAX_CHARS}
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder={t('feedback.message')}
                      className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200"
                    />
                    <span
                      className="absolute bottom-2.5 right-3 text-[10px] font-medium"
                      style={{
                        color: message.length > MAX_CHARS * 0.9
                          ? 'var(--color-primary)'
                          : 'var(--color-text-muted)',
                      }}
                    >
                      {message.length}/{MAX_CHARS}
                    </span>
                  </div>
                </div>

                {/* Submit */}
                <Button
                  fullWidth
                  size="lg"
                  disabled={!selectedCategory || submitting}
                  onClick={handleSubmit}
                  className="rounded-2xl font-bold"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Submitting…
                    </span>
                  ) : (
                    t('feedback.submit')
                  )}
                </Button>

                {!selectedCategory && (
                  <p className="mt-2 text-center text-xs text-[var(--color-text-muted)]">
                    Please select a category to submit
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>

      {/* ── Feedback History ── */}
      {userFeedback.length > 0 && (
        <motion.div
          custom={2}
          variants={FADE_UP}
          initial="hidden"
          animate="show"
        >
          <h2 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-3">
            Your Previous Feedback
          </h2>
          {[...userFeedback].reverse().map((item, i) => (
            <HistoryItem key={item.id} item={item} index={i} />
          ))}
        </motion.div>
      )}

      {userFeedback.length === 0 && (
        <motion.div
          custom={2}
          variants={FADE_UP}
          initial="hidden"
          animate="show"
          className="text-center py-6"
        >
          <p className="text-xs text-[var(--color-text-muted)]">
            No feedback submitted yet — your input means a lot!
          </p>
        </motion.div>
      )}
    </div>
  );
}
