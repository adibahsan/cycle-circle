'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { format, addDays, subDays, isToday } from 'date-fns';
import { useAppStore } from '@/lib/store';
import { SYMPTOMS_DATA } from '@/lib/dummy-data';
import type { SymptomCategory } from '@/lib/types';
import '@/lib/i18n';

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES: { key: SymptomCategory; labelKey: string }[] = [
  { key: 'physical', labelKey: 'symptoms.physical' },
  { key: 'mood', labelKey: 'symptoms.mood' },
  { key: 'discharge', labelKey: 'symptoms.discharge' },
  { key: 'lifestyle', labelKey: 'symptoms.lifestyle' },
];

const CATEGORY_COLORS: Record<SymptomCategory, { bg: string; border: string; text: string; ring: string }> = {
  physical: {
    bg: 'rgba(232,71,108,0.12)',
    border: 'rgba(232,71,108,0.35)',
    text: '#C93558',
    ring: 'rgba(232,71,108,0.4)',
  },
  mood: {
    bg: 'rgba(155,127,212,0.12)',
    border: 'rgba(155,127,212,0.35)',
    text: '#7A5CB8',
    ring: 'rgba(155,127,212,0.4)',
  },
  discharge: {
    bg: 'rgba(123,197,174,0.12)',
    border: 'rgba(123,197,174,0.35)',
    text: '#2D8C72',
    ring: 'rgba(123,197,174,0.4)',
  },
  lifestyle: {
    bg: 'rgba(255,140,107,0.12)',
    border: 'rgba(255,140,107,0.35)',
    text: '#C4592A',
    ring: 'rgba(255,140,107,0.4)',
  },
};

// Build date strip: 7 days ago → today → 2 days ahead
function buildDateStrip(): Date[] {
  const today = new Date();
  const dates: Date[] = [];
  for (let i = -7; i <= 2; i++) {
    dates.push(i < 0 ? subDays(today, Math.abs(i)) : addDays(today, i));
  }
  return dates;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface DateChipProps {
  date: Date;
  isSelected: boolean;
  onSelect: () => void;
}

function DateChip({ date, isSelected, onSelect }: DateChipProps) {
  const today = isToday(date);
  return (
    <button
      onClick={onSelect}
      className="flex flex-col items-center gap-0.5 min-w-[48px] relative"
      aria-label={format(date, 'MMMM d')}
    >
      <span
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: today ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
      >
        {format(date, 'EEE')}
      </span>
      <motion.div
        layout
        className="w-10 h-10 rounded-full flex items-center justify-center relative"
        style={{
          background: isSelected ? 'var(--color-primary)' : today ? 'rgba(232,71,108,0.1)' : 'transparent',
          boxShadow: isSelected ? '0 0 0 3px rgba(232,71,108,0.3)' : 'none',
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <span
          className="text-sm font-bold"
          style={{
            color: isSelected
              ? '#fff'
              : today
              ? 'var(--color-primary)'
              : 'var(--color-text-primary)',
          }}
        >
          {format(date, 'd')}
        </span>
      </motion.div>
      {today && !isSelected && (
        <span
          className="w-1 h-1 rounded-full"
          style={{ background: 'var(--color-primary)' }}
        />
      )}
    </button>
  );
}

interface SymptomChipProps {
  icon: string;
  name: string;
  selected: boolean;
  category: SymptomCategory;
  onToggle: () => void;
}

function SymptomChip({ icon, name, selected, category, onToggle }: SymptomChipProps) {
  const colors = CATEGORY_COLORS[category];
  return (
    <motion.button
      onClick={onToggle}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all duration-200 w-full"
      style={{
        background: selected ? colors.bg : 'var(--color-bg-card)',
        borderColor: selected ? colors.border : 'var(--color-border)',
        boxShadow: selected ? `0 0 0 2px ${colors.ring}` : 'none',
      }}
      aria-pressed={selected}
      aria-label={name}
    >
      <span className="text-2xl leading-none">{icon}</span>
      <span
        className="text-[11px] font-semibold text-center leading-tight"
        style={{ color: selected ? colors.text : 'var(--color-text-secondary)' }}
      >
        {name}
      </span>
      {selected && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: colors.text }}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4l2 2 3-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.span>
      )}
    </motion.button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SymptomsPage() {
  const { t, i18n } = useTranslation();
  const { activeProfileId, symptomLogs, toggleSymptom, language } = useAppStore();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeCategory, setActiveCategory] = useState<SymptomCategory>('physical');
  const [prevCount, setPrevCount] = useState(0);

  const dateStripRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef<HTMLDivElement>(null);
  const todayChipRef = useRef<HTMLButtonElement>(null);

  const dates = buildDateStrip();
  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');

  // Keep i18n in sync with store language
  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  // Scroll date strip to center today on mount
  useEffect(() => {
    if (dateStripRef.current) {
      const todayIndex = 7; // 7 past days + today
      const chipWidth = 56; // approx chip width
      const scrollLeft = todayIndex * chipWidth - dateStripRef.current.clientWidth / 2 + chipWidth / 2;
      dateStripRef.current.scrollLeft = Math.max(0, scrollLeft);
    }
  }, []);

  // Compute selected symptoms for each category for the current date
  const logsForDate = symptomLogs.filter(
    (l) => l.profileId === activeProfileId && l.date === selectedDateKey
  );

  function isSymptomSelected(symptomId: string) {
    return logsForDate.some((l) => l.symptomId === symptomId);
  }

  function categoryCount(cat: SymptomCategory) {
    return logsForDate.filter((l) => {
      const sym = SYMPTOMS_DATA.find((s) => s.id === l.symptomId);
      return sym?.category === cat;
    }).length;
  }

  const totalSelected = logsForDate.length;

  // Trigger count animation when totalSelected changes
  useEffect(() => {
    setPrevCount(totalSelected);
  }, [totalSelected]);

  const categorySymptoms = SYMPTOMS_DATA.filter((s) => s.category === activeCategory);

  function getSymptomName(s: (typeof SYMPTOMS_DATA)[0]) {
    return language === 'bn' ? s.nameBn : s.nameEn;
  }

  // Tab indicator position (calculated by active tab index)
  const activeTabIndex = CATEGORIES.findIndex((c) => c.key === activeCategory);

  return (
    <div className="flex flex-col min-h-[calc(100dvh-8rem)] pb-24">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="pt-3 pb-2"
      >
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
          {t('symptoms.title')}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
          {format(selectedDate, 'EEEE, MMMM d')}
        </p>
      </motion.div>

      {/* ── Date Strip ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.3 }}
        ref={dateStripRef}
        className="flex gap-1 overflow-x-auto scrollbar-hide py-2 -mx-4 px-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {dates.map((date) => {
          const key = format(date, 'yyyy-MM-dd');
          const isSelected = key === selectedDateKey;
          return (
            <DateChip
              key={key}
              date={date}
              isSelected={isSelected}
              onSelect={() => setSelectedDate(date)}
            />
          );
        })}
      </motion.div>

      {/* ── Category Tabs ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="relative mt-3 mb-4"
      >
        <div
          ref={tabRef}
          className="flex gap-1 rounded-2xl p-1"
          style={{ background: 'var(--color-bg-secondary)' }}
        >
          {/* Animated tab indicator */}
          <motion.div
            className="absolute top-1 bottom-1 rounded-xl"
            style={{ background: 'var(--color-bg-card)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
            animate={{
              left: `calc(${activeTabIndex} * 25% + 4px)`,
              width: 'calc(25% - 8px)',
            }}
            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
          />

          {CATEGORIES.map(({ key, labelKey }) => {
            const isActive = activeCategory === key;
            const count = categoryCount(key);
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className="relative flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-semibold transition-colors duration-200 z-10"
                style={{
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                }}
              >
                {t(labelKey)}
                {count > 0 && (
                  <span
                    className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center leading-none"
                    style={{
                      background: CATEGORY_COLORS[key].text,
                      color: '#fff',
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* ── Symptom Grid ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeCategory}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-3 flex-1"
        >
          {categorySymptoms.map((symptom, i) => {
            const selected = isSymptomSelected(symptom.id);
            return (
              <motion.div
                key={symptom.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="relative"
              >
                <SymptomChip
                  icon={symptom.icon}
                  name={getSymptomName(symptom)}
                  selected={selected}
                  category={symptom.category}
                  onToggle={() =>
                    toggleSymptom(activeProfileId, selectedDateKey, symptom.category, symptom.id)
                  }
                />
              </motion.div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* ── Fixed Bottom Summary Bar ── */}
      <AnimatePresence>
        <motion.div
          key="summary-bar"
          initial={false}
          className="fixed bottom-[60px] md:bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md md:max-w-xl px-4 z-30 pointer-events-none"
        >
          <AnimatePresence mode="wait">
            {totalSelected > 0 ? (
              <motion.div
                key="has-symptoms"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                className="rounded-2xl px-5 py-3.5 flex items-center justify-between pointer-events-auto shadow-glow"
                style={{
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2 8.5l3.5 3.5L13 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <motion.p
                      key={totalSelected}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-white font-bold text-sm"
                    >
                      {totalSelected} {totalSelected === 1 ? 'symptom' : 'symptoms'} logged
                    </motion.p>
                    <p className="text-white/70 text-[10px]">
                      {format(selectedDate, 'MMM d')}
                    </p>
                  </div>
                </div>
                {/* Pill dots for each category with logs */}
                <div className="flex gap-1">
                  {CATEGORIES.map(({ key }) => {
                    const count = categoryCount(key);
                    if (count === 0) return null;
                    return (
                      <span
                        key={key}
                        className="w-5 h-5 rounded-full bg-white/25 text-white text-[9px] font-bold flex items-center justify-center"
                      >
                        {count}
                      </span>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="no-symptoms"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl px-5 py-3 flex items-center justify-center pointer-events-auto"
                style={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <p className="text-[var(--color-text-muted)] text-sm">
                  Tap symptoms to log them for {format(selectedDate, 'MMM d')}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
