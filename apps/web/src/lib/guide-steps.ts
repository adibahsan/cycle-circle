import { Smartphone, UserRound, ClipboardPen, CalendarHeart, Users, BellOff } from 'lucide-react'

/** The six user-guide steps, shared by the landing "How it works" section and /guide. */
export const GUIDE_STEPS = [
  { key: 'login', icon: Smartphone },
  { key: 'profile', icon: UserRound },
  { key: 'log', icon: ClipboardPen },
  { key: 'predict', icon: CalendarHeart },
  { key: 'family', icon: Users },
  { key: 'unsubscribe', icon: BellOff },
] as const
