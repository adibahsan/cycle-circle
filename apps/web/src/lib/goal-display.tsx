import { CalendarHeart, Sprout, Flower2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { GoalValue } from '@vesta/shared/utils/goal';

export const GOAL_ICON_COMPONENTS: Record<GoalValue, ReactNode> = {
  tracking: <CalendarHeart size={18} aria-hidden="true" />,
  conceive: <Sprout size={18} aria-hidden="true" />,
  perimenopause: <Flower2 size={18} aria-hidden="true" />,
};

export const GOAL_I18N_KEYS: Record<GoalValue, string> = {
  tracking: 'onboarding.goalTracking',
  conceive: 'onboarding.goalConceive',
  perimenopause: 'onboarding.goalPerimenopause',
};
