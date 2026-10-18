'use client';

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { SymptomCategory } from '@vesta/shared/types';
import { Card } from '@/components/ui/Card';
import type { CardTint } from '@/components/ui/tints';
import { cn } from '@/lib/cn';
import { SymptomTintContext } from './tints';
import { TINT_CLASSES } from '@/components/ui/tints';
import '@vesta/shared/utils/i18n';

export const CATEGORIES: { key: SymptomCategory; labelKey: string }[] = [
  { key: 'physical', labelKey: 'symptoms.physical' },
  { key: 'mood', labelKey: 'symptoms.mood' },
  { key: 'discharge', labelKey: 'symptoms.discharge' },
  { key: 'lifestyle', labelKey: 'symptoms.lifestyle' },
];

/** Each category's pastel tint: its tab, card and chip badges. */
export const CATEGORY_TINTS: Record<SymptomCategory, CardTint> = {
  physical: 'pink',
  mood: 'lavender',
  discharge: 'sky',
  lifestyle: 'sage',
};

interface SymptomCategoryTabsProps {
  active: SymptomCategory;
  onChange: (category: SymptomCategory) => void;
  /** Selected-symptom count per category, shown as a badge on the tab. */
  counts: Record<SymptomCategory, number>;
  /** The active category's chips; wrapped in a tab panel and a group labelled with the category. */
  children: ReactNode;
  /** Optional action (e.g. "All good"); sits above the tabs below xl, right of them on xl+. */
  action?: ReactNode;
  className?: string;
}

/**
 * WAI-ARIA tabs for symptom categories: roving tabindex, Arrow/Home/End move and activate,
 * the panel holds the active category's chips as a labelled group.
 */
export function SymptomCategoryTabs({ active, onChange, counts, children, action, className }: SymptomCategoryTabsProps) {
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

  const activeTint = CATEGORY_TINTS[active];

  return (
    <div className={cn('flex flex-col gap-2 md:gap-3', className)}>
      <div className="flex flex-col gap-2 md:gap-4 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between xl:gap-3">
      <div
        role="tablist"
        aria-label={t('symptoms.categoriesLabel')}
        onKeyDown={onKeyDown}
        className="flex gap-1 rounded-full p-1 bg-[var(--color-bg-secondary)] xl:w-fit xl:max-w-full"
      >
        {CATEGORIES.map(({ key, labelKey }, i) => {
          const isActive = i === activeIndex;
          const count = counts[key];
          const c = TINT_CLASSES[CATEGORY_TINTS[key]];
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
              className={cn(
                'relative flex-1 min-w-0 min-h-[40px] md:min-h-[44px] xl:flex-none xl:px-4 xl:text-sm flex items-center justify-center gap-1 px-1 py-2 rounded-full text-xs font-semibold leading-tight text-center',
                'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2',
                c.ring,
                isActive ? cn(c.surface, c.ink) : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
              )}
            >
              {t(labelKey)}
              {count > 0 && (
                <span
                  className={cn('ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-xs font-bold flex items-center justify-center leading-none tabular-nums', c.solid)}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {action && <div className="order-first xl:order-last xl:shrink-0">{action}</div>}
      </div>

      <Card tone={activeTint} padding="sm" className="p-2 md:p-4">
        <div role="tabpanel" id={panelId(activeIndex)} aria-labelledby={tabId(activeIndex)}>
          <div role="group" aria-label={t(CATEGORIES[activeIndex].labelKey)}>
            <SymptomTintContext.Provider value={activeTint}>{children}</SymptomTintContext.Provider>
          </div>
        </div>
      </Card>
    </div>
  );
}
