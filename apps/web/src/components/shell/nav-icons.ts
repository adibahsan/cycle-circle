import {
  Home,
  CalendarDays,
  Activity,
  TrendingUp,
  BookOpen,
  Settings,
  MessageSquare,
  Users,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';
import type { NavIconKey } from '@/components/shell/nav-config';

/** The one NavIconKey -> icon map (sidebar, bottom nav, More sheet). */
export const NAV_ICONS: Record<NavIconKey, LucideIcon> = {
  home: Home,
  calendar: CalendarDays,
  symptoms: Activity,
  insights: TrendingUp,
  content: BookOpen,
  settings: Settings,
  profiles: Users,
  feedback: MessageSquare,
  subscription: CreditCard,
};
