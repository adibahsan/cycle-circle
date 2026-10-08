/**
 * Named pop-ups the screenshot script can open. Each lists candidate trigger
 * selectors (first visible wins) on a route. Add a pop-up: add an entry.
 * `route` is used when the caller does not pass --route.
 */
export interface PopupDef { route: string; triggers: string[] }

export const POPUPS: Record<string, PopupDef> = {
  'period-log': { route: '/dashboard', triggers: ['button:has-text("Log Period")', 'button:has-text("পিরিয়ড লগ করুন")'] },
  'quick-symptom': { route: '/dashboard', triggers: ['button:has-text("Log Symptoms")', 'button:has-text("লক্ষণ লগ করুন")'] },
  checkin: { route: '/dashboard', triggers: ['button[aria-label="Check in"]', 'button:has-text("Check in")'] },
  'profile-completion': { route: '/dashboard', triggers: ['[data-tour="profile-ring"] button', '[data-tour="profile-ring"]'] },
  'calendar-day': { route: '/calendar', triggers: ['[role="gridcell"] button', 'button[aria-label*="2026"]'] },
  'settings-logout': { route: '/settings', triggers: ['button:has-text("Log Out")', 'button:has-text("লগ আউট")'] },
  'profile-edit': { route: '/profiles', triggers: ['button[aria-label^="Edit "]', 'button[aria-label^="প্রোফাইল সম্পাদনা"]'] },
  'profile-delete': { route: '/profiles', triggers: ['button[aria-label^="Delete "]', 'button[aria-label^="মুছুন"]'] },
  paywall: { route: '/subscription', triggers: ['button:has-text("Upgrade to Pro")'] },
  'trial-pill': { route: '/dashboard', triggers: ['button[aria-label*="Trial ends"]', 'button:has-text("Add number")'] },
}
