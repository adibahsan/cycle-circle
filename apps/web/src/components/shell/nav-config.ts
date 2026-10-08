/** Navigation destinations for the signed-in shell. Pure data, no React. */

export type NavIconKey =
  | 'home' | 'calendar' | 'symptoms' | 'insights' | 'content'
  | 'settings' | 'profiles' | 'feedback' | 'subscription'

export interface NavItem {
  href: string
  icon: NavIconKey
  labelKey: string
  tourKey?: string
}

const DASHBOARD: NavItem = { href: '/dashboard', icon: 'home', labelKey: 'nav.dashboard' }
const CALENDAR: NavItem = { href: '/calendar', icon: 'calendar', labelKey: 'nav.calendar', tourKey: 'nav-calendar' }
const SYMPTOMS: NavItem = { href: '/symptoms', icon: 'symptoms', labelKey: 'nav.symptoms' }
const INSIGHTS: NavItem = { href: '/insights', icon: 'insights', labelKey: 'nav.insights', tourKey: 'nav-insights' }
const CONTENT: NavItem = { href: '/content', icon: 'content', labelKey: 'nav.content' }
const SETTINGS: NavItem = { href: '/settings', icon: 'settings', labelKey: 'nav.settings' }
const PROFILES: NavItem = { href: '/profiles', icon: 'profiles', labelKey: 'nav.profiles' }
const FEEDBACK: NavItem = { href: '/feedback', icon: 'feedback', labelKey: 'nav.feedback' }
const SUBSCRIPTION: NavItem = { href: '/subscription', icon: 'subscription', labelKey: 'nav.subscription' }

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
