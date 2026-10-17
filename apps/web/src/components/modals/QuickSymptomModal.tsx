'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { useHasMounted } from '@/components/motion/useHasMounted';
import { useAppStore } from '@/lib/store';
import { SYMPTOMS_DATA } from '@/lib/symptoms-data';
import { saveSymptoms } from '@/app/actions/tracking-actions';
import {
  SymptomChip,
  CATEGORIES,
  CATEGORY_COLORS,
  toDbCategory,
} from '@/app/(main)/symptoms/SymptomsClient';
import { deviceDayString } from '@/lib/local-date';
import { goalAccentVar } from '@vesta/shared/utils/goal';
import type { SymptomCategory } from '@vesta/shared/types';
import '@vesta/shared/utils/i18n';

// ─── Props ────────────────────────────────────────────────────────────────────

interface QuickSymptomModalProps {
  open: boolean;
  onClose: () => void;
  profileId: string;
  goal: string | null;
  initialSelected?: string[];
  /** Date to log against in YYYY-MM-DD format. Defaults to today. */
  initialDate?: string;
  onSaved?: (savedCount: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuickSymptomModal({
  open,
  onClose,
  profileId,
  goal,
  initialSelected = [],
  initialDate,
  onSaved,
}: QuickSymptomModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const language = useAppStore((s) => s.language);

  const mounted = useHasMounted();
  const reduce = useReducedMotion() ?? false;
  const prefersReduced = mounted && reduce;

  const [activeCategory, setActiveCategory] = useState<SymptomCategory>(CATEGORIES[0].key);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected));
  const [saving, setSaving] = useState(false);

  // Reset selection each time the modal opens
  useEffect(() => {
    if (open) {
      setSelected(new Set(initialSelected));
      setActiveCategory(CATEGORIES[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const initialSet = new Set(initialSelected);

  // Diff vs initialSelected
  const added = [...selected].filter((id) => !initialSet.has(id));
  const removed = [...initialSet].filter((id) => !selected.has(id));
  const hasChanges = added.length > 0 || removed.length > 0;

  const isEmpty = selected.size === 0;

  const accentVar = goalAccentVar(goal);

  // Date to log against — defaults to today in YYYY-MM-DD format.
  // When `initialDate` is provided (backfill from ConsistencyGrid), we log against that date.
  const logDate = initialDate ?? deviceDayString();

  const handleToggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  async function handleSave() {
    if (!hasChanges || saving) return;
    setSaving(true);
    try {
      const addedPayload = added.flatMap((id) => {
        const symptom = SYMPTOMS_DATA.find((s) => s.id === id);
        return symptom
          ? [{ symptomId: id, category: toDbCategory(symptom.category), value: id }]
          : [];
      });
      const removedPayload = removed.filter((id) => SYMPTOMS_DATA.some((s) => s.id === id));
      if (addedPayload.length || removedPayload.length) {
        await saveSymptoms({ profileId, date: logDate, added: addedPayload, removed: removedPayload });
      }
      router.refresh();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vesta:profile-updated'));
      }
      const savedCount = added.length;
      onSaved?.(savedCount);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function getSymptomName(s: (typeof SYMPTOMS_DATA)[0]) {
    return language === 'bn' ? s.nameBn : s.nameEn;
  }

  const categorySymptoms = SYMPTOMS_DATA.filter((s) => s.category === activeCategory);
  const activeTabIndex = CATEGORIES.findIndex((c) => c.key === activeCategory);

  const header = (
    <div style={{ '--goal-accent': accentVar } as React.CSSProperties}>
        <div className="px-5 pt-5 pb-2 pr-14">
          <h2
            id="quick-symptom-title"
            className="text-lg font-bold text-[var(--color-text-primary)] leading-snug"
          >
            {t('quickSymptom.header')}
          </h2>
          <p
            id="quick-symptom-desc"
            className="text-sm text-[var(--color-text-muted)] mt-0.5"
          >
            {t('quickSymptom.subheader')}
          </p>
        </div>
    </div>
  );

  const footer = (
    <div className="px-5 pt-3 pb-5" style={{ '--goal-accent': accentVar } as React.CSSProperties}>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          aria-label={
            saving ? t('quickSymptom.saving') : t('quickSymptom.save')
          }
          className="w-full rounded-2xl px-5 py-3.5 flex items-center justify-center gap-2.5 font-bold text-sm text-[var(--color-on-accent)] transition-opacity duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
          style={{
            background: `linear-gradient(135deg, var(--goal-accent, var(--color-primary)) 0%, color-mix(in srgb, var(--goal-accent, var(--color-primary)) 70%, var(--color-secondary)) 100%)`,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ['--tw-ring-color' as any]: `color-mix(in srgb, var(--goal-accent, var(--color-primary)) 50%, transparent)`,
          }}
        >
          {saving ? (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                className="animate-spin"
              >
                <circle
                  cx="8"
                  cy="8"
                  r="6"
                  stroke="var(--color-on-accent)"
                  strokeWidth="2"
                  strokeDasharray="28"
                  strokeDashoffset="10"
                  strokeLinecap="round"
                />
              </svg>
              <span>{t('quickSymptom.saving')}</span>
            </>
          ) : (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 8.5l3.5 3.5L13 4"
                  stroke="var(--color-on-accent)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{t('quickSymptom.save')}</span>
            </>
          )}
        </button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId="quick-symptom-title"
      descId="quick-symptom-desc"
      accentVar={accentVar}
      closeOnBackdrop={false}
      header={header}
      footer={footer}
    >
      <div
        className="flex flex-col gap-4 px-5 pb-3 pt-2"
        style={{ '--goal-accent': accentVar } as React.CSSProperties}
      >
        {/* ── Category tabs ── */}
        <div className="relative">
          <div
            role="tablist"
            className="flex gap-1 rounded-2xl p-1"
            style={{ background: 'var(--color-bg-secondary)' }}
          >
            {!prefersReduced && (
              <motion.div
                className="absolute top-1 bottom-1 rounded-xl"
                style={{
                  background: 'var(--color-bg-card)',
                  boxShadow: '0 2px 8px color-mix(in srgb, var(--color-brand-navy) 8%, transparent)',
                }}
                animate={{
                  left: `calc(${activeTabIndex} * 25% + 4px)`,
                  width: 'calc(25% - 8px)',
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}

            {CATEGORIES.map(({ key, labelKey }) => {
              const isActive = activeCategory === key;
              const count = SYMPTOMS_DATA.filter(
                (s) => s.category === key && selected.has(s.id)
              ).length;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveCategory(key)}
                  className="relative flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold transition-colors duration-200 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
                  style={{
                    color: isActive
                      ? 'var(--color-text-primary)'
                      : 'var(--color-text-muted)',
                    ...(prefersReduced && isActive
                      ? { background: 'var(--color-bg-card)' }
                      : {}),
                  }}
                >
                  {t(labelKey)}
                  {count > 0 && (
                    <span
                      className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full text-[11px] font-bold flex items-center justify-center leading-none"
                      style={{
                        background: CATEGORY_COLORS[key].text,
                        color: CATEGORY_COLORS[key].on,
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Symptom grid ── */}
        <AnimatePresence mode="wait">
          {prefersReduced ? (
            <div
              key={activeCategory}
              className="grid grid-cols-3 gap-2"
            >
              {categorySymptoms.map((symptom) => (
                <div key={symptom.id} className="h-full">
                  <SymptomChip
                    id={symptom.id}
                    icon={symptom.icon}
                    name={getSymptomName(symptom)}
                    selected={selected.has(symptom.id)}
                    category={symptom.category}
                    onToggle={handleToggle}
                  />
                </div>
              ))}
            </div>
          ) : (
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-3 gap-2"
            >
              {categorySymptoms.map((symptom, i) => (
                <motion.div
                  key={symptom.id}
                  className="h-full"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: i * 0.03,
                    duration: 0.25,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <SymptomChip
                    id={symptom.id}
                    icon={symptom.icon}
                    name={getSymptomName(symptom)}
                    selected={selected.has(symptom.id)}
                    category={symptom.category}
                    onToggle={handleToggle}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Empty helper text ── */}
        <AnimatePresence>
          {isEmpty && (
            <motion.p
              key="empty-text"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              aria-live="polite"
              className="text-xs text-center text-[var(--color-text-muted)]"
            >
              {t('quickSymptom.empty')}
            </motion.p>
          )}
        </AnimatePresence>

      </div>
    </Modal>
  );
}
