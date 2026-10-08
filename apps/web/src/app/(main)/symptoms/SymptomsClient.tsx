'use client';

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
} from 'date-fns';
import { bn } from 'date-fns/locale/bn';
import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useAppStore } from '@/lib/store';
import { SYMPTOMS_DATA } from '@/lib/symptoms-data';
import { ALL_GOOD_SYMPTOM_ID } from '@vesta/shared/utils/symptoms';
import { toggleSymptom, markAllGoodToday, saveSymptoms } from '@/app/actions/tracking-actions';
import { CelebrationModal } from '@/components/modals/CelebrationModal';
import type { Profile, PrismaSymptomLog, SymptomCategory } from '@vesta/shared/types';
import '@vesta/shared/utils/i18n';

// ─── Constants ───────────────────────────────────────────────────────────────

export const CATEGORIES: { key: SymptomCategory; labelKey: string }[] = [
  { key: 'physical', labelKey: 'symptoms.physical' },
  { key: 'mood', labelKey: 'symptoms.mood' },
  { key: 'discharge', labelKey: 'symptoms.discharge' },
  { key: 'lifestyle', labelKey: 'symptoms.lifestyle' },
];

export const CATEGORY_COLORS: Record<SymptomCategory, { bg: string; border: string; text: string; ring: string; on: string }> = {
  physical: {
    bg: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
    border: 'color-mix(in srgb, var(--color-primary) 35%, transparent)',
    text: 'var(--color-primary)',
    ring: 'color-mix(in srgb, var(--color-primary) 40%, transparent)',
    on: 'var(--color-on-accent)',
  },
  mood: {
    bg: 'color-mix(in srgb, var(--color-secondary) 12%, transparent)',
    border: 'color-mix(in srgb, var(--color-secondary) 35%, transparent)',
    text: 'var(--color-secondary)',
    ring: 'color-mix(in srgb, var(--color-secondary) 40%, transparent)',
    on: 'var(--color-on-luteal)',
  },
  discharge: {
    bg: 'color-mix(in srgb, var(--color-coral) 12%, transparent)',
    border: 'color-mix(in srgb, var(--color-coral) 35%, transparent)',
    text: 'var(--color-coral)',
    ring: 'color-mix(in srgb, var(--color-coral) 40%, transparent)',
    on: 'var(--color-on-fertile)',
  },
  lifestyle: {
    bg: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
    border: 'color-mix(in srgb, var(--color-accent) 35%, transparent)',
    text: 'var(--color-accent)',
    ring: 'color-mix(in srgb, var(--color-accent) 40%, transparent)',
    on: 'var(--color-on-ovulation)',
  },
};

export function toDbCategory(
  category: SymptomCategory
): 'PHYSICAL' | 'MOOD' | 'DISCHARGE' | 'LIFESTYLE' {
  return category.toUpperCase() as 'PHYSICAL' | 'MOOD' | 'DISCHARGE' | 'LIFESTYLE';
}

// ─── Mini Calendar ──────────────────────────────────────────────────────────

interface MiniCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

const MiniCalendar = memo(function MiniCalendar({ selectedDate, onDateSelect }: MiniCalendarProps) {
  const { t } = useTranslation();
  const { language } = useAppStore();
  const dateLocale = language === 'bn' ? bn : undefined;
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selectedDate));

  const gridDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [viewMonth]);

  const DOW = [
    t('calendar.sun'), t('calendar.mon'), t('calendar.tue'), t('calendar.wed'),
    t('calendar.thu'), t('calendar.fri'), t('calendar.sat'),
  ];

  const today = new Date();

  return (
    <Card padding="md">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          aria-label="Previous month"
          className="p-2 rounded-xl hover:bg-[var(--color-bg-secondary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
        >
          <ChevronLeft size={20} className="text-[var(--color-text-secondary)]" aria-hidden="true" />
        </button>
        <h2 className="text-base font-bold text-[var(--color-text-primary)]">
          {format(viewMonth, 'MMMM yyyy', { locale: dateLocale })}
        </h2>
        <button
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          aria-label="Next month"
          className="p-2 rounded-xl hover:bg-[var(--color-bg-secondary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
        >
          <ChevronRight size={20} className="text-[var(--color-text-secondary)]" aria-hidden="true" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-2">
        {DOW.map((d) => (
          <div key={d} className="flex items-center justify-center">
            <span className="text-[10px] md:text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
              {d}
            </span>
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5 md:gap-1">
        {gridDays.map((date) => {
          const inMonth = isSameMonth(date, viewMonth);
          const isSelected = isSameDay(date, selectedDate);
          const isToday = isSameDay(date, today);

          return (
            <button
              key={format(date, 'yyyy-MM-dd')}
              onClick={() => onDateSelect(date)}
              className={`aspect-square flex items-center justify-center rounded-xl text-sm md:text-base font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 ${
                !inMonth ? 'text-[var(--color-text-muted)] opacity-40' : ''
              }`}
              style={{
                backgroundColor: isSelected
                  ? 'var(--color-primary)'
                  : isToday
                    ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
                    : 'transparent',
                color: isSelected
                  ? 'var(--color-on-accent)'
                  : isToday
                    ? 'var(--color-primary)'
                    : inMonth
                      ? 'var(--color-text-primary)'
                      : 'var(--color-text-muted)',
                fontWeight: isToday || isSelected ? 700 : 500,
              }}
            >
              {format(date, 'd')}
            </button>
          );
        })}
      </div>
    </Card>
  );
});

// ─── Symptom Chip ───────────────────────────────────────────────────────────

interface SymptomChipProps {
  id: string;
  icon: string;
  name: string;
  selected: boolean;
  category: SymptomCategory;
  onToggle: (id: string) => void;
}

export const SymptomChip = memo(function SymptomChip({ id, icon, name, selected, category, onToggle }: SymptomChipProps) {
  return (
    <motion.button
      onClick={() => onToggle(id)}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-colors duration-200 w-full h-full min-h-[88px] relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
      style={{
        background: selected ? 'color-mix(in srgb, var(--goal-accent) 14%, transparent)' : 'var(--color-bg-card)',
        borderColor: selected ? 'var(--goal-accent)' : 'var(--color-border)',
        boxShadow: selected ? '0 0 0 2px color-mix(in srgb, var(--goal-accent) 40%, transparent)' : 'none',
      }}
      aria-pressed={selected}
      aria-label={name}
    >
      <span className="text-2xl leading-none">{icon}</span>
      <span
        className="text-[11px] font-semibold text-center leading-tight"
        style={{ color: selected ? 'var(--goal-accent)' : 'var(--color-text-secondary)' }}
      >
        {name}
      </span>
      {selected && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: 'var(--goal-accent)' }}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
            <path d="M1.5 4l2 2 3-3" stroke="var(--color-on-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.span>
      )}
    </motion.button>
  );
});

// ─── Main Client Component ──────────────────────────────────────────────────

interface SymptomsClientProps {
  profiles: Profile[];
  activeProfileId: string;
  date: string;
  symptomLogs: PrismaSymptomLog[];
  goal: string | null;
}

export function SymptomsClient({
  profiles,
  activeProfileId,
  date,
  symptomLogs,
  goal,
}: SymptomsClientProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { language } = useAppStore();
  const dateLocale = language === 'bn' ? bn : undefined;
  const [activeCategory, setActiveCategory] = useState<SymptomCategory>('physical');
  const [saving, setSaving] = useState(false);
  const [celebrationCount, setCelebrationCount] = useState<number | null>(null);

  const selectedDate = useMemo(() => parseISO(date), [date]);

  const [localSelected, setLocalSelected] = useState<Set<string>>(() =>
    new Set(symptomLogs.map((l) => l.symptomId))
  );

  const initialSelected = useMemo(
    () => new Set(symptomLogs.map((l) => l.symptomId)),
    [symptomLogs]
  );

  useEffect(() => {
    setLocalSelected(new Set(symptomLogs.map((l) => l.symptomId)));
  }, [symptomLogs]);

  // "All good" sentinel is tracked separately from real symptoms so the Save
  // diff (and counts) only ever reflect real symptoms — the sentinel is handled
  // by its own immediate toggle (markAllGoodToday / clear).
  const isAllGood = localSelected.has(ALL_GOOD_SYMPTOM_ID);
  const realSelected = useMemo(() => {
    const s = new Set(localSelected);
    s.delete(ALL_GOOD_SYMPTOM_ID);
    return s;
  }, [localSelected]);
  const realInitial = useMemo(() => {
    const s = new Set(initialSelected);
    s.delete(ALL_GOOD_SYMPTOM_ID);
    return s;
  }, [initialSelected]);

  const added = useMemo(
    () => [...realSelected].filter((id) => !realInitial.has(id)),
    [realSelected, realInitial]
  );
  const removed = useMemo(
    () => [...realInitial].filter((id) => !realSelected.has(id)),
    [realSelected, realInitial]
  );
  const hasChanges = added.length > 0 || removed.length > 0;
  const changeCount = added.length + removed.length;

  function isSymptomSelected(symptomId: string) {
    return localSelected.has(symptomId);
  }

  function categoryCount(cat: SymptomCategory) {
    return SYMPTOMS_DATA.filter((s) => s.category === cat && localSelected.has(s.id)).length;
  }

  const totalSelected = realSelected.size;
  const categorySymptoms = SYMPTOMS_DATA.filter((s) => s.category === activeCategory);

  function getSymptomName(s: (typeof SYMPTOMS_DATA)[0]) {
    return language === 'bn' ? s.nameBn : s.nameEn;
  }

  const handleDateSelect = useCallback((newDate: Date) => {
    const newDateStr = format(newDate, 'yyyy-MM-dd');
    router.push(`/symptoms?profileId=${activeProfileId}&date=${newDateStr}`);
  }, [router, activeProfileId]);

  const handleToggle = useCallback((symptomId: string) => {
    setLocalSelected((prev) => {
      const next = new Set(prev);
      // Selecting a real symptom clears the "all good" state (mutually exclusive).
      next.delete(ALL_GOOD_SYMPTOM_ID);
      if (next.has(symptomId)) {
        next.delete(symptomId);
      } else {
        next.add(symptomId);
      }
      return next;
    });
  }, []);

  // "All good / no issues" — immediate toggle (owns the sentinel for the day).
  async function handleToggleAllGood() {
    if (saving) return;
    setSaving(true);
    try {
      if (isAllGood) {
        // Clear the existing sentinel → nothing logged for the day.
        await toggleSymptom({
          profileId: activeProfileId,
          date,
          category: 'MOOD',
          symptomId: ALL_GOOD_SYMPTOM_ID,
          value: ALL_GOOD_SYMPTOM_ID,
        });
        setLocalSelected(new Set());
      } else {
        // Mark the day all-good → clears any real logs + sets the sentinel.
        await markAllGoodToday(activeProfileId, date);
        setLocalSelected(new Set([ALL_GOOD_SYMPTOM_ID]));
      }
      router.refresh();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vesta:profile-updated'));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    const savedCount = added.length;
    setSaving(true);
    try {
      const addedPayload = added.flatMap((id) => {
        const symptom = SYMPTOMS_DATA.find((s) => s.id === id);
        return symptom
          ? [{ symptomId: id, category: toDbCategory(symptom.category), value: id }]
          : [];
      });
      const removedPayload = removed.filter((id) =>
        SYMPTOMS_DATA.some((s) => s.id === id),
      );
      if (addedPayload.length || removedPayload.length) {
        await saveSymptoms({
          profileId: activeProfileId,
          date,
          added: addedPayload,
          removed: removedPayload,
        });
      }
      // Re-fetch server components so dashboard/symptom data reflects new logs.
      router.refresh();
      // Notify layout so completion-pill updates (firstLog nudge, etc.).
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vesta:profile-updated'));
      }
      // Celebrate only when new symptoms were added.
      if (savedCount > 0) {
        setCelebrationCount(savedCount);
      }
    } finally {
      setSaving(false);
    }
  }

  const activeTabIndex = CATEGORIES.findIndex((c) => c.key === activeCategory);

  return (
    <div className="flex flex-col gap-4 py-3 pb-24">
      {/* ── Desktop: calendar left, symptoms right ── */}
      <div className="flex flex-col lg:flex-row gap-4">

        {/* ── Left: month calendar + summary ── */}
        <div className="lg:w-[480px] lg:shrink-0 lg:sticky lg:top-4 lg:self-start flex flex-col gap-3">
          {/* Header */}
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
              {t('symptoms.title')}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              {format(selectedDate, 'EEEE, MMMM d', { locale: dateLocale })}
            </p>
          </div>

          {/* Full month calendar */}
          <MiniCalendar
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
          />

          {/* Summary card (desktop) */}
          {totalSelected > 0 && (
            <Card padding="sm">
              <div className="text-center">
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                  {totalSelected} {totalSelected === 1 ? t('symptoms.symptomLabel') : t('symptoms.symptomsLabel')}
                </p>
                <div className="flex justify-center gap-1.5 mt-2">
                  {CATEGORIES.map(({ key }) => {
                    const count = categoryCount(key);
                    if (count === 0) return null;
                    return (
                      <span
                        key={key}
                        className="min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center leading-none"
                        style={{ background: CATEGORY_COLORS[key].text, color: CATEGORY_COLORS[key].on }}
                      >
                        {count}
                      </span>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* ── Right: category tabs + symptom grid + save ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* All good / no issues — quick toggle for "nothing to report" days */}
          <button
            type="button"
            onClick={handleToggleAllGood}
            disabled={saving}
            aria-pressed={isAllGood}
            className={[
              'w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold',
              'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] disabled:opacity-60',
              isAllGood
                ? 'text-[var(--color-on-accent)]'
                : 'border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:border-[var(--goal-accent)] hover:text-[var(--color-text-primary)]',
            ].join(' ')}
            style={
              isAllGood
                ? {
                    background:
                      'linear-gradient(135deg, var(--goal-accent, var(--color-primary)) 0%, color-mix(in srgb, var(--goal-accent, var(--color-primary)) 70%, var(--color-secondary)) 100%)',
                  }
                : undefined
            }
          >
            <CheckCircle2 size={16} aria-hidden="true" />
            {isAllGood ? t('symptoms.allGoodActive') : t('symptoms.allGood')}
          </button>

          {/* Category tabs */}
          <div className="relative">
            <div
              role="tablist"
              className="flex gap-1 rounded-2xl p-1"
              style={{ background: 'var(--color-bg-secondary)' }}
            >
              <motion.div
                className="absolute top-1 bottom-1 rounded-xl"
                style={{ background: 'var(--color-bg-card)', boxShadow: '0 2px 8px color-mix(in srgb, var(--color-brand-navy) 8%, transparent)' }}
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
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveCategory(key)}
                    className="relative flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-colors duration-200 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]"
                    style={{
                      color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                    }}
                  >
                    {t(labelKey)}
                    {count > 0 && (
                      <span
                        className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center leading-none"
                        style={{ background: CATEGORY_COLORS[key].text, color: CATEGORY_COLORS[key].on }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Symptom grid */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2"
            >
              {categorySymptoms.map((symptom, i) => {
                const selected = isSymptomSelected(symptom.id);
                return (
                  <motion.div
                    key={symptom.id}
                    className="h-full"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <SymptomChip
                      id={symptom.id}
                      icon={symptom.icon}
                      name={getSymptomName(symptom)}
                      selected={selected}
                      category={symptom.category}
                      onToggle={handleToggle}
                    />
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>

          {/* Inline save button (desktop) */}
          <AnimatePresence mode="wait">
            {hasChanges && (
              <motion.button
                key="save-inline"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.2 }}
                onClick={handleSave}
                disabled={saving}
                aria-label={`Save ${changeCount} changes`}
                className="hidden lg:flex w-full rounded-2xl px-5 py-3.5 items-center justify-center gap-3 shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] disabled:opacity-70 transition-colors duration-200"
                style={{
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
                }}
              >
                {saving ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="animate-spin">
                    <circle cx="8" cy="8" r="6" stroke="var(--color-on-accent)" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 8.5l3.5 3.5L13 4" stroke="var(--color-on-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                <span className="text-[var(--color-on-accent)] font-bold text-sm">
                  {saving
                    ? t('symptoms.saving')
                    : t('symptoms.saveChanges', { count: changeCount })}
                </span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Fixed bottom bar (mobile only) ── */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-[60px] md:bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-30 lg:hidden"
      >
        <AnimatePresence mode="wait">
          {hasChanges ? (
            <motion.button
              key="save-bar"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              onClick={handleSave}
              disabled={saving}
              aria-label={`Save ${changeCount} changes`}
              className="w-full rounded-2xl px-5 py-3.5 flex items-center justify-center gap-3 shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] disabled:opacity-70 transition-colors duration-200"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
              }}
            >
              {saving ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="animate-spin">
                  <circle cx="8" cy="8" r="6" stroke="var(--color-on-accent)" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8.5l3.5 3.5L13 4" stroke="var(--color-on-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <span className="text-[var(--color-on-accent)] font-bold text-sm">
                {saving
                  ? t('symptoms.saving')
                  : t('symptoms.saveChanges', { count: changeCount })}
              </span>
            </motion.button>
          ) : isAllGood ? (
            <motion.div
              key="all-good-bar"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl px-5 py-3 flex items-center justify-center gap-2"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
            >
              <CheckCircle2 size={15} style={{ color: 'var(--goal-accent)' }} aria-hidden="true" />
              <p className="text-[var(--color-text-muted)] text-sm">
                {t('symptoms.allGoodActive')}
              </p>
            </motion.div>
          ) : totalSelected > 0 ? (
            <motion.div
              key="saved-summary"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl px-5 py-3 flex items-center justify-center"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-[var(--color-text-muted)] text-sm">
                {totalSelected} {t('symptoms.symptomsLabel')} {t('symptoms.forDate', { date: format(selectedDate, 'MMM d', { locale: dateLocale }) })}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="no-symptoms"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="rounded-2xl px-5 py-3 flex items-center justify-center"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-[var(--color-text-muted)] text-sm">
                {t('symptoms.tapToLog', { date: format(selectedDate, 'MMM d', { locale: dateLocale }) })}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CelebrationModal
        open={celebrationCount != null}
        onClose={() => setCelebrationCount(null)}
        goal={goal}
        kind="symptom"
        count={celebrationCount ?? 0}
      />
    </div>
  );
}
