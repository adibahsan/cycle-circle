'use client';

import { useTranslation } from 'react-i18next';
import { normalizeGoal, goalAccentVar } from '@vesta/shared/utils/goal';
import { GOAL_ICON_COMPONENTS, GOAL_I18N_KEYS } from '@/lib/goal-display';
import '@vesta/shared/utils/i18n';

interface GoalBadgeProps {
  goal: string | null;
  className?: string;
}

export function GoalBadge({ goal, className }: GoalBadgeProps) {
  const { t } = useTranslation();
  const g = normalizeGoal(goal);
  if (!g) return null;
  return (
    <span
      className={['inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold', className ?? ''].join(' ').trim()}
      style={{
        ['--goal-accent' as string]: goalAccentVar(g),
        background: 'color-mix(in srgb, var(--goal-accent) 12%, transparent)',
        color: 'var(--goal-accent)',
        border: '1px solid color-mix(in srgb, var(--goal-accent) 35%, transparent)',
      } as React.CSSProperties}
    >
      {GOAL_ICON_COMPONENTS[g]}
      <span>{t(GOAL_I18N_KEYS[g])}</span>
    </span>
  );
}
