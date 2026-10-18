/** Navigation destinations for the signed-in shell. Pure data, no React. */

import type { CardTint } from '@/components/ui/tints'
import { GOAL_ACCENT_FILL } from '@/components/ui/action-styles'

export type NavIconKey =
  | 'home' | 'calendar' | 'symptoms' | 'insights' | 'content'
  | 'settings' | 'profiles' | 'feedback' | 'subscription'

export interface NavItem {
  href: string
  icon: NavIconKey
  labelKey: string
  tourKey?: string
  /** Pastel badge behind the icon in the More sheet (a `--color-tint-*` name). */
  tint?: CardTint
}

/**
 * The active nav item: the goal accent filled, with the on-accent ink (>= 4.5:1 for every goal,
 * both themes). The only goal-accent surface in the shell besides focus rings and the profile ring.
 */
export const NAV_ACTIVE = GOAL_ACCENT_FILL

const DASHBOARD: NavItem = { href: '/dashboard', icon: 'home', labelKey: 'nav.dashboard' }
const CALENDAR: NavItem = { href: '/calendar', icon: 'calendar', labelKey: 'nav.calendar', tourKey: 'nav-calendar' }
const SYMPTOMS: NavItem = { href: '/symptoms', icon: 'symptoms', labelKey: 'nav.symptoms' }
const INSIGHTS: NavItem = { href: '/insights', icon: 'insights', labelKey: 'nav.insights', tourKey: 'nav-insights' }
const CONTENT: NavItem = { href: '/content', icon: 'content', labelKey: 'nav.content', tint: 'peach' }
const SETTINGS: NavItem = { href: '/settings', icon: 'settings', labelKey: 'nav.settings', tint: 'sage' }
const PROFILES: NavItem = { href: '/profiles', icon: 'profiles', labelKey: 'nav.profiles', tint: 'lavender' }
const FEEDBACK: NavItem = { href: '/feedback', icon: 'feedback', labelKey: 'nav.feedback', tint: 'sky' }
const SUBSCRIPTION: NavItem = { href: '/subscription', icon: 'subscription', labelKey: 'nav.subscription', tint: 'mint' }

/** The four link slots of the phone bottom nav; the fifth slot is the More button. */
export const BOTTOM_NAV_ITEMS: NavItem[] = [DASHBOARD, CALENDAR, SYMPTOMS, INSIGHTS]

/** Destinations behind the phone "More" sheet. */
export const MORE_ITEMS: NavItem[] = [CONTENT, PROFILES, SUBSCRIPTION, FEEDBACK, SETTINGS]

/** Desktop sidebar groups. */
export const SIDEBAR_MENU_ITEMS: NavItem[] = [DASHBOARD, CALENDAR, SYMPTOMS, INSIGHTS, CONTENT, SETTINGS]
export const SIDEBAR_MORE_ITEMS: NavItem[] = [PROFILES, FEEDBACK, SUBSCRIPTION]

export function isNavActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function isMoreActive(pathname: string | null): boolean {
  return MORE_ITEMS.some((i) => isNavActive(i.href, pathname))
}
