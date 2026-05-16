'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { X, ChevronRight, BookOpen } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { DEMO_ARTICLES } from '@/lib/dummy-data';
import { getCurrentCycleDay, getCurrentPhase, getPhaseEmoji, getPhaseColor } from '@/lib/cycle-utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { CyclePhase, Article } from '@/lib/types';
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
const SLIDE_IN: any = {
  hidden: { opacity: 0, x: 20 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: EASE_OUT } },
  exit: { opacity: 0, x: 20, transition: { duration: 0.25, ease: EASE_OUT } },
};

// ── Phase filter config ────────────────────────────────────────────────────
type FilterTab = 'for-you' | CyclePhase | 'all';

interface TabConfig {
  id: FilterTab;
  labelKey: string;
  emoji?: string;
}

const STATIC_TABS: TabConfig[] = [
  { id: 'menstrual', labelKey: 'dashboard.menstrual', emoji: '🩸' },
  { id: 'follicular', labelKey: 'dashboard.follicular', emoji: '🌱' },
  { id: 'ovulation', labelKey: 'dashboard.ovulation', emoji: '🌸' },
  { id: 'luteal', labelKey: 'dashboard.luteal', emoji: '🌙' },
];

// ── Phase name map for display ─────────────────────────────────────────────
function getPhaseName(phase: CyclePhase, t: (k: string) => string): string {
  const map: Record<CyclePhase, string> = {
    menstrual: t('dashboard.menstrual'),
    follicular: t('dashboard.follicular'),
    ovulation: t('dashboard.ovulation'),
    luteal: t('dashboard.luteal'),
  };
  return map[phase];
}

// ── Phase tag chip ─────────────────────────────────────────────────────────
function PhaseChip({ phase }: { phase: CyclePhase }) {
  const color = getPhaseColor(phase);
  const emoji = getPhaseEmoji(phase);
  const labels: Record<CyclePhase, string> = {
    menstrual: 'Menstrual',
    follicular: 'Follicular',
    ovulation: 'Ovulation',
    luteal: 'Luteal',
  };
  return (
    <span
      className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {emoji} {labels[phase]}
    </span>
  );
}

// ── Category badge ─────────────────────────────────────────────────────────
function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--color-bg-secondary)] text-[var(--color-secondary)] border border-[var(--color-border)]">
      {category}
    </span>
  );
}

// ── Expanded Article Modal/Panel ───────────────────────────────────────────
function ArticleExpanded({
  article,
  language,
  onClose,
}: {
  article: Article;
  language: string;
  onClose: () => void;
}) {
  const isEn = language === 'en';
  const title = isEn ? article.titleEn : article.titleBn;
  const body = isEn ? article.bodyBn || article.bodyEn : article.bodyBn;
  const missingTranslation = !isEn && !article.bodyBn;

  return (
    <motion.div
      key="article-expanded"
      variants={SLIDE_IN}
      initial="hidden"
      animate="show"
      exit="exit"
      className="fixed inset-0 z-50 flex flex-col bg-[var(--color-bg-primary)] max-w-md mx-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 glass px-4 py-3 flex items-center gap-3">
        <button
          onClick={onClose}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors active:scale-95"
          aria-label="Close article"
        >
          <X size={18} className="text-[var(--color-text-secondary)]" />
        </button>
        <span className="text-sm font-semibold text-[var(--color-text-secondary)] truncate flex-1">
          {article.category}
        </span>
        {article.phaseTags.length > 0 && (
          <PhaseChip phase={article.phaseTags[0]} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
        {missingTranslation && (
          <div className="mb-4 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700 font-medium">
            Showing in English — Bengali translation coming soon
          </div>
        )}

        <h1 className="text-xl font-bold text-[var(--color-text-primary)] leading-snug mb-4">
          {title}
        </h1>

        <div className="flex flex-wrap gap-1.5 mb-5">
          {article.phaseTags.map(tag => (
            <PhaseChip key={tag} phase={tag} />
          ))}
        </div>

        <p className="text-[var(--color-text-secondary)] leading-relaxed text-sm whitespace-pre-wrap">
          {isEn ? article.bodyEn : (article.bodyBn || article.bodyEn)}
        </p>
      </div>
    </motion.div>
  );
}

// ── Article Card ───────────────────────────────────────────────────────────
function ArticleCard({
  article,
  language,
  index,
  onExpand,
}: {
  article: Article;
  language: string;
  index: number;
  onExpand: (article: Article) => void;
}) {
  const { t } = useTranslation();
  const isEn = language === 'en';
  const title = isEn ? article.titleEn : (article.titleBn || article.titleEn);
  const body = isEn ? article.bodyEn : (article.bodyBn || article.bodyEn);
  const preview = body.slice(0, 100) + (body.length > 100 ? '…' : '');

  return (
    <motion.div
      custom={index}
      variants={FADE_UP}
      initial="hidden"
      animate="show"
    >
      <Card hover padding="md" className="mb-3">
        {/* Category + phase tags row */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <CategoryBadge category={article.category} />
          {article.phaseTags.map(tag => (
            <PhaseChip key={tag} phase={tag} />
          ))}
        </div>

        {/* Title */}
        <h3 className="text-[var(--color-text-primary)] font-bold text-sm leading-snug mb-1.5">
          {title}
        </h3>

        {/* Preview */}
        <p className="text-[var(--color-text-muted)] text-xs leading-relaxed mb-3">
          {preview}
        </p>

        {/* Read more */}
        <button
          onClick={() => onExpand(article)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors active:scale-95"
        >
          {t('content.readMore')}
          <ChevronRight size={13} />
        </button>
      </Card>
    </motion.div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function ContentPage() {
  const { t } = useTranslation();
  const { profiles, activeProfileId, language } = useAppStore();

  const [activeFilter, setActiveFilter] = useState<FilterTab>('for-you');
  const [expandedArticle, setExpandedArticle] = useState<Article | null>(null);

  // Derive current phase from active profile
  const activeProfile = profiles.find(p => p.id === activeProfileId) ?? profiles[0];
  const cycleDay = activeProfile
    ? getCurrentCycleDay(activeProfile.lastPeriodStart, activeProfile.cycleLength)
    : 1;
  const currentPhase: CyclePhase = activeProfile
    ? getCurrentPhase(cycleDay, activeProfile.periodLength, activeProfile.cycleLength)
    : 'follicular';

  const phaseEmoji = getPhaseEmoji(currentPhase);
  const phaseColor = getPhaseColor(currentPhase);
  const phaseName = getPhaseName(currentPhase, t);

  // Build tab list with "For You" and "All" bookending phase tabs
  const tabs: TabConfig[] = [
    { id: 'for-you', labelKey: '', emoji: phaseEmoji },
    ...STATIC_TABS,
    { id: 'all', labelKey: 'content.allArticles' },
  ];

  // Filter articles
  const filteredArticles = useMemo(() => {
    const published = DEMO_ARTICLES.filter(a => a.published);
    if (activeFilter === 'all') return published;
    if (activeFilter === 'for-you') {
      return published.filter(a => a.phaseTags.includes(currentPhase));
    }
    return published.filter(a => a.phaseTags.includes(activeFilter as CyclePhase));
  }, [activeFilter, currentPhase]);

  function getTabLabel(tab: TabConfig): string {
    if (tab.id === 'for-you') return t('content.forYourPhase');
    if (tab.id === 'all') return t('content.allArticles');
    return t(tab.labelKey);
  }

  function getTabAccentColor(tab: TabConfig): string {
    if (tab.id === 'for-you') return phaseColor;
    if (tab.id === 'all') return 'var(--color-text-muted)';
    return getPhaseColor(tab.id as CyclePhase);
  }

  return (
    <>
      {/* Page content */}
      <div className="py-4">
        {/* ── Phase Header ── */}
        <motion.div
          custom={0}
          variants={FADE_UP}
          initial="hidden"
          animate="show"
          className="mb-5"
        >
          <div
            className="rounded-2xl p-4 border"
            style={{
              background: `linear-gradient(135deg, ${phaseColor}15 0%, ${phaseColor}08 100%)`,
              borderColor: `${phaseColor}30`,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shadow-soft"
                style={{ backgroundColor: `${phaseColor}20` }}
              >
                {phaseEmoji}
              </div>
              <div>
                <p className="text-xs font-medium text-[var(--color-text-muted)] mb-0.5">
                  {t('content.title')}
                </p>
                <h2 className="text-base font-bold text-[var(--color-text-primary)] leading-tight">
                  Articles for your{' '}
                  <span style={{ color: phaseColor }}>{phaseName}</span> phase
                </h2>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Day {cycleDay} of your cycle
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Phase Filter Tabs ── */}
        <motion.div
          custom={1}
          variants={FADE_UP}
          initial="hidden"
          animate="show"
          className="mb-5 -mx-4 px-4"
        >
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {tabs.map(tab => {
              const isActive = activeFilter === tab.id;
              const accent = getTabAccentColor(tab);
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className="flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 active:scale-95 whitespace-nowrap"
                  style={
                    isActive
                      ? {
                          backgroundColor: accent,
                          borderColor: accent,
                          color: '#fff',
                        }
                      : {
                          backgroundColor: 'var(--color-bg-card)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text-secondary)',
                        }
                  }
                >
                  {tab.emoji && <span>{tab.emoji}</span>}
                  {getTabLabel(tab)}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* ── Article count ── */}
        <motion.p
          custom={2}
          variants={FADE_UP}
          initial="hidden"
          animate="show"
          className="text-xs text-[var(--color-text-muted)] mb-3"
        >
          {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}
        </motion.p>

        {/* ── Article List ── */}
        <AnimatePresence mode="wait">
          {filteredArticles.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-[var(--color-bg-secondary)] flex items-center justify-center mb-3">
                <BookOpen size={24} className="text-[var(--color-text-muted)]" />
              </div>
              <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
                No articles for this phase yet
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Check back soon for new content
              </p>
            </motion.div>
          ) : (
            <motion.div key={activeFilter} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {filteredArticles.map((article, i) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  language={language}
                  index={i}
                  onExpand={setExpandedArticle}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Expanded Article Overlay ── */}
      <AnimatePresence>
        {expandedArticle && (
          <ArticleExpanded
            article={expandedArticle}
            language={language}
            onClose={() => setExpandedArticle(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
