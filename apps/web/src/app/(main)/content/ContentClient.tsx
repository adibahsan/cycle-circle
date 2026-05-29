'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { BookOpen } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { getPhaseColor, getPhaseEmoji } from '@vesta/shared/utils/cycle-utils'
import type { CyclePhase } from '@vesta/shared/types'
import '@vesta/shared/utils/i18n'

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

// ── Phase filter config ────────────────────────────────────────────────────────
type FilterTab = 'for-you' | CyclePhase | 'all'

interface TabConfig {
  id: FilterTab
  labelKey: string
  emoji?: string
}

const STATIC_TABS: TabConfig[] = [
  { id: 'menstrual', labelKey: 'dashboard.menstrual', emoji: '🩸' },
  { id: 'follicular', labelKey: 'dashboard.follicular', emoji: '🌱' },
  { id: 'ovulation', labelKey: 'dashboard.ovulation', emoji: '🌸' },
  { id: 'luteal', labelKey: 'dashboard.luteal', emoji: '🌙' },
]

function getPhaseName(phase: CyclePhase, t: (k: string) => string): string {
  const map: Record<CyclePhase, string> = {
    menstrual: t('dashboard.menstrual'),
    follicular: t('dashboard.follicular'),
    ovulation: t('dashboard.ovulation'),
    luteal: t('dashboard.luteal'),
  }
  return map[phase]
}

// ── Main Client Component ──────────────────────────────────────────────────────
export function ContentClient() {
  const { t } = useTranslation()
  const { language } = useAppStore()

  const [activeFilter, setActiveFilter] = useState<FilterTab>('for-you')

  // With no CMS yet, we show an empty state. We still render the phase header
  // with a default phase so the UI structure is ready for when articles arrive.
  const currentPhase: CyclePhase = 'follicular'
  const phaseEmoji = getPhaseEmoji(currentPhase)
  const phaseColor = getPhaseColor(currentPhase)
  const phaseName = getPhaseName(currentPhase, t)

  const tabs: TabConfig[] = [
    { id: 'for-you', labelKey: '', emoji: phaseEmoji },
    ...STATIC_TABS,
    { id: 'all', labelKey: 'content.allArticles' },
  ]

  function getTabLabel(tab: TabConfig): string {
    if (tab.id === 'for-you') return t('content.forYourPhase')
    if (tab.id === 'all') return t('content.allArticles')
    return t(tab.labelKey)
  }

  function getTabAccentColor(tab: TabConfig): string {
    if (tab.id === 'for-you') return phaseColor
    if (tab.id === 'all') return 'var(--color-text-muted)'
    return getPhaseColor(tab.id as CyclePhase)
  }

  return (
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
                {t('content.articlesForPhase', { phase: phaseName })}
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {t('content.contentComingSoonNote')}
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
            const isActive = activeFilter === tab.id
            const accent = getTabAccentColor(tab)
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
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
                {tab.emoji && <span>{tab.emoji}</span>}
                {getTabLabel(tab)}
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* ── Empty state ── */}
      <motion.div
        custom={2}
        variants={FADE_UP}
        initial="hidden"
        animate="show"
        className="flex flex-col items-center justify-center py-16 text-center"
      >
        <div className="w-14 h-14 rounded-2xl bg-[var(--color-bg-secondary)] flex items-center justify-center mb-3">
          <BookOpen size={24} className="text-[var(--color-text-muted)]" />
        </div>
        <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
          {t('content.noArticles')}
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          {t('content.contentComingSoon')}
        </p>
      </motion.div>
    </div>
  )
}
