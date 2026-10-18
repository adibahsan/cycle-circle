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
import { useLanguage } from '@/lib/use-language';
import { SYMPTOMS_DATA, toDbCategory } from '@/lib/symptoms-data';
import { SymptomChip } from '@/components/symptoms/SymptomChip';
import { SymptomCategoryTabs, CATEGORIES, CATEGORY_TINTS } from '@/components/symptoms/SymptomCategoryTabs';
import { TINT_CLASSES } from '@/components/ui/tints';
import { cn } from '@/lib/cn';
import { SaveErrorStatus } from '@/components/symptoms/SaveErrorStatus';
import { ALL_GOOD_SYMPTOM_ID } from '@vesta/shared/utils/symptoms';
import { toggleSymptom, markAllGoodToday, saveSymptoms } from '@/app/actions/tracking-actions';
import { useToast } from '@/components/ui/Toast';
import type { Profile, PrismaSymptomLog, SymptomCategory } from '@vesta/shared/types';
import '@vesta/shared/utils/i18n';
import { TODAY_GLOW } from '@/lib/calendar-day-style';
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'

// ─── Mini Calendar ──────────────────────────────────────────────────────────

interface MiniCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

const MiniCalendar = memo(function MiniCalendar({ selectedDate, onDateSelect }: MiniCalendarProps) {
  const { t } = useTranslation();
  const language = useLanguage();
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
    <Card tone="panel" padding="sm" className="md:p-5 xl:p-4">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-1 md:mb-3">
        <button
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          aria-label={t('calendar.previousMonth')}
          className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-xl hover:bg-[var(--color-bg-secondary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
        >
          <ChevronLeft size={20} className="text-[var(--color-text-secondary)]" aria-hidden="true" />
        </button>
        <h2 className="text-base font-bold text-[var(--color-text-primary)]">
          {format(viewMonth, 'MMMM yyyy', { locale: dateLocale })}
        </h2>
        <button
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          aria-label={t('calendar.nextMonth')}
          className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-xl hover:bg-[var(--color-bg-secondary)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
        >
          <ChevronRight size={20} className="text-[var(--color-text-secondary)]" aria-hidden="true" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1 md:mb-2">
        {DOW.map((d) => (
          <div key={d} className="flex items-center justify-center">
            <span className="text-xs font-bold text-[var(--color-text-muted)]">
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
              aria-current={isToday ? 'date' : undefined}
              className={`h-11 md:h-auto md:aspect-square xl:aspect-auto xl:h-11 flex items-center justify-center rounded-xl text-sm md:text-base font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 ${
                !inMonth ? 'text-[var(--color-text-muted)] opacity-40' : ''
              }${isToday ? ' relative z-[1]' : ''}`}
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
                boxShadow: isToday ? TODAY_GLOW : undefined,
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
  const language = useLanguage();
  const dateLocale = language === 'bn' ? bn : undefined;
  const [activeCategory, setActiveCategory] = useState<SymptomCategory>('physical');
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const toast = useToast();

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
    setSaveFailed(false);
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

  async function handleToggleAllGood() {
    if (saving) return;
    setSaving(true);
    setSaveFailed(false);
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
    } catch (err) {
      console.error('Failed to update all-good check-in:', err);
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (saving) return;
    const savedCount = added.length;
    setSaving(true);
    setSaveFailed(false);
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
        toast.celebrate('symptom', savedCount);
      }
    } catch (err) {
      // Keep the selection so she can retry; say so in the live region.
      console.error('Failed to save symptoms:', err);
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer width="canvas" className="gap-3 md:gap-5 pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+5rem)] xl:pb-4">
      <PageHeader
        title={t('symptoms.title')}
        subtitle={format(selectedDate, 'EEEE, MMMM d', { locale: dateLocale })}
      />
      {/* ── Desktop: calendar left, symptoms right ── */}
      <div className="flex flex-col xl:flex-row gap-3 md:gap-5">

        {/* ── Left: month calendar + summary ── */}
        <div className="xl:w-[440px] 2xl:w-[480px] xl:shrink-0 xl:sticky xl:top-4 xl:self-start flex flex-col gap-2 md:gap-3">
          {/* Full month calendar */}
          <MiniCalendar
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
          />

          {/* Summary card (desktop) */}
          {totalSelected > 0 && (
            <Card tone="panel" padding="sm">
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
                        className={cn('min-w-[20px] h-5 px-1.5 rounded-full text-xs tabular-nums font-bold flex items-center justify-center leading-none', TINT_CLASSES[CATEGORY_TINTS[key]].solid)}
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
        <div className="flex-1 min-w-0 flex flex-col gap-2 md:gap-4">

          {/* Category tabs + the active category's chips */}
          <SymptomCategoryTabs
            action={(
              <button
                type="button"
                onClick={handleToggleAllGood}
                disabled={saving}
                aria-pressed={isAllGood}
                className={cn(
                  'w-full xl:w-auto xl:px-6 min-h-[44px] flex items-center justify-center gap-2 py-2 xl:py-3 rounded-full border text-sm font-semibold',
                  'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent-mint disabled:opacity-60',
                  isAllGood
                    ? 'bg-tint-mint text-accent-mint border-accent-mint'
                    : 'bg-[var(--color-bg-card)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                )}
              >
                <CheckCircle2 size={16} aria-hidden="true" />
                {isAllGood ? t('symptoms.allGoodActive') : t('symptoms.allGood')}
              </button>
            )}
            active={activeCategory}
            onChange={setActiveCategory}
            counts={{
              physical: categoryCount('physical'),
              mood: categoryCount('mood'),
              discharge: categoryCount('discharge'),
              lifestyle: categoryCount('lifestyle'),
            }}
          >
            {/* Symptom grid */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCategory}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 auto-rows-fr gap-1.5 md:gap-2"
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
                        onToggle={handleToggle}
                      />
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </SymptomCategoryTabs>

          <SaveErrorStatus show={saveFailed} className="hidden xl:block" />

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
                aria-label={t('symptoms.saveChanges', { count: changeCount })}
                className="hidden xl:flex w-full min-h-[44px] rounded-full px-5 py-3.5 items-center justify-center gap-3 bg-[var(--color-action)] text-[var(--color-on-action)] shadow-soft hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-action)] disabled:opacity-70 transition-opacity duration-200"
              >
                {saving ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="animate-spin">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                <span className="font-bold text-sm">
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
        className="fixed bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+0.75rem)] md:bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-30 xl:hidden"
      >
        <SaveErrorStatus
          show={saveFailed}
          className={saveFailed ? 'mb-2 rounded-2xl px-4 py-2.5 bg-[var(--color-bg-card)] border border-[var(--color-border)]' : ''}
        />
        <div aria-live="polite" aria-atomic="true">
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
                aria-label={t('symptoms.saveChanges', { count: changeCount })}
                className="w-full min-h-[44px] rounded-full px-5 py-3.5 flex items-center justify-center gap-3 bg-[var(--color-action)] text-[var(--color-on-action)] shadow-soft hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-action)] disabled:opacity-70 transition-opacity duration-200"
              >
                {saving ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="animate-spin">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                <span className="font-bold text-sm">
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
                <CheckCircle2 size={15} className="text-accent-mint" aria-hidden="true" />
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
      </div>

    </PageContainer>
  );
}
