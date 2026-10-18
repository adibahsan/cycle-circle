'use client';

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { SymptomCategory } from '@vesta/shared/types';
import '@vesta/shared/utils/i18n';

export const CATEGORIES: { key: SymptomCategory; labelKey: string }[] = [
  { key: 'physical', labelKey: 'symptoms.physical' },
  { key: 'mood', labelKey: 'symptoms.mood' },
  { key: 'discharge', labelKey: 'symptoms.discharge' },
  { key: 'lifestyle', labelKey: 'symptoms.lifestyle' },
];

export const CATEGORY_COLORS: Record<SymptomCategory, { text: string; on: string }> = {
  physical: { text: 'var(--color-primary)', on: 'var(--color-on-accent)' },
  mood: { text: 'var(--color-secondary)', on: 'var(--color-on-luteal)' },
  discharge: { text: 'var(--color-coral)', on: 'var(--color-on-fertile)' },
  lifestyle: { text: 'var(--color-accent)', on: 'var(--color-on-ovulation)' },
};

interface SymptomCategoryTabsProps {
  active: SymptomCategory;
  onChange: (category: SymptomCategory) => void;
  /** Selected-symptom count per category, shown as a badge on the tab. */
  counts: Record<SymptomCategory, number>;
  /** The active category's chips; wrapped in a tab panel and a group labelled with the category. */
  children: ReactNode;
}

/**
 * WAI-ARIA tabs for symptom categories: roving tabindex, Arrow/Home/End move and activate,
 * the panel holds the active category's chips as a labelled group.
 */
export function SymptomCategoryTabs({ active, onChange, counts, children }: SymptomCategoryTabsProps) {
  const { t } = useTranslation();
  const base = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = CATEGORIES.findIndex((c) => c.key === active);
  const tabId = (i: number) => `${base}-tab-${i}`;
  const panelId = (i: number) => `${base}-panel-${i}`;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const last = CATEGORIES.length - 1;
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = activeIndex === last ? 0 : activeIndex + 1;
    else if (e.key === 'ArrowLeft') next = activeIndex === 0 ? last : activeIndex - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    if (next === null) return;
    e.preventDefault();
    onChange(CATEGORIES[next].key);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label={t('symptoms.categoriesLabel')}
        onKeyDown={onKeyDown}
        className="flex gap-1 rounded-2xl p-1"
        style={{ background: 'var(--color-bg-secondary)' }}
      >
        {CATEGORIES.map(({ key, labelKey }, i) => {
          const isActive = i === activeIndex;
          const count = counts[key];
          return (
            <button
              key={key}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={tabId(i)}
              aria-selected={isActive}
              aria-controls={panelId(i)}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(key)}
              className="relative flex-1 min-w-0 min-h-[44px] flex items-center justify-center gap-1 px-1 py-2 rounded-xl text-xs font-semibold leading-tight text-center transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent,var(--color-primary))]"
              style={{
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                background: isActive ? 'var(--color-bg-card)' : 'transparent',
                boxShadow: isActive ? '0 2px 8px color-mix(in srgb, var(--color-brand-navy) 8%, transparent)' : 'none',
              }}
            >
              {t(labelKey)}
              {count > 0 && (
                <span
                  className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-xs font-bold flex items-center justify-center leading-none tabular-nums"
                  style={{ background: CATEGORY_COLORS[key].text, color: CATEGORY_COLORS[key].on }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={panelId(activeIndex)} aria-labelledby={tabId(activeIndex)}>
        <div role="group" aria-label={t(CATEGORIES[activeIndex].labelKey)}>
          {children}
        </div>
      </div>
    </div>
  );
}
