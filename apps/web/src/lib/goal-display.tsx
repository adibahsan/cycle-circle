import { Baby } from 'lucide-react';
import type { ReactNode } from 'react';
import type { GoalValue } from '@vesta/shared/utils/goal';

export const GOAL_ICON_COMPONENTS: Record<GoalValue, ReactNode> = {
  tracking: <span aria-hidden="true" className="text-lg leading-none">📅</span>,
  conceive: <span aria-hidden="true" className="text-lg leading-none">🌱</span>,
  pregnancy: <Baby size={20} aria-hidden="true" />,
  perimenopause: <span aria-hidden="true" className="text-lg leading-none">🌸</span>,
};

export const GOAL_I18N_KEYS: Record<GoalValue, string> = {
  tracking: 'onboarding.goalTracking',
  conceive: 'onboarding.goalConceive',
  pregnancy: 'onboarding.goalPregnancy',
  perimenopause: 'onboarding.goalPerimenopause',
};
