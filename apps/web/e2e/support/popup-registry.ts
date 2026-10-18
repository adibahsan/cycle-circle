/**
 * The pop-up registry: every pop-up a user can open in the web app, and the e2e spec that proves the contract
 * (ESC closes it, Tab stays inside, focus returns to the trigger, the page behind does not scroll).
 *
 * ADDING A POP-UP: put its component here (`source`, path under apps/web/src), and either
 *  - add a case to e2e/tests/popup-contract.spec.ts (`sweep: true`), or
 *  - point `spec` at the existing guard that already covers it, or
 *  - set `sameAs` to the pop-up whose component it reuses.
 * __tests__/ui/popup-contract.test.ts fails when a component using the shell Modal is missing from this list.
 * Plain data only (no Playwright imports) so vitest can read it.
 */
export interface PopupEntry {
  id: string
  /** Component file (under apps/web/src) that renders the pop-up. */
  source: string
  /** Spec file (under e2e/tests) that proves the contract for it. */
  spec: string
  /** True when e2e/tests/popup-contract.spec.ts contains the case. */
  sweep?: boolean
  /** Reuses another entry's component: covered by that entry's spec. */
  sameAs?: string
  note?: string
}

export const POPUPS: PopupEntry[] = [
  { id: 'period-log', source: 'components/PeriodLogModal.tsx', spec: 'dashboard-popups.spec.ts' },
  { id: 'period-log-edit', source: 'app/(main)/calendar/CalendarClient.tsx', spec: 'popup-contract.spec.ts', sweep: true, note: 'edit a period from Recent periods' },
  { id: 'quick-symptom', source: 'components/modals/QuickSymptomModal.tsx', spec: 'dashboard-popups.spec.ts' },
  { id: 'check-in', source: 'components/engagement/TodayCheckInModal.tsx', spec: 'dashboard-popups.spec.ts' },
  { id: 'check-in-strip', source: 'components/engagement/TodayCheckInStrip.tsx', spec: 'dashboard-popups.spec.ts', sameAs: 'check-in' },
  { id: 'profile-completion', source: 'components/ProfileCompletionModal.tsx', spec: 'dashboard-popups.spec.ts' },
  { id: 'late-period-alert', source: 'components/modals/LatePeriodFullScreenAlert.tsx', spec: 'account-popups.spec.ts' },
  { id: 'trial-lock', source: 'components/TrialExpiredLock.tsx', spec: 'account-popups.spec.ts', note: 'not dismissible: never closes' },
  { id: 'trial-add-number', source: 'components/AddPhoneDialog.tsx', spec: 'popup-shell.spec.ts', note: 'opened from the trial pill and the subscription Upgrade button' },
  { id: 'subscription-dialogs', source: 'app/(main)/subscription/SubscriptionClient.tsx', spec: 'account-popups.spec.ts', note: 'BDApps unsubscribe confirm (Upgrade reuses AddPhoneDialog)' },
  { id: 'profile-edit-delete', source: 'app/(main)/profiles/ProfilesClient.tsx', spec: 'account-popups.spec.ts' },
  { id: 'logout-confirm', source: 'components/LogoutConfirmModal.tsx', spec: 'account-popups.spec.ts', note: 'opened from Settings; AccountControl (onboarding) reuses it' },
  { id: 'logout-confirm-onboarding', source: 'components/onboarding/AccountControl.tsx', spec: 'account-popups.spec.ts', sameAs: 'logout-confirm' },
  { id: 'more-sheet', source: 'components/shell/MoreSheet.tsx', spec: 'popup-contract.spec.ts', sweep: true, note: 'phone bottom nav only' },
  { id: 'onboarding-tour', source: 'components/onboarding/OnboardingTour.tsx', spec: 'popup-contract.spec.ts', sweep: true, note: 'spotlight tour, not on the Modal shell; page behind must stay scrollable to reach anchors' },
  { id: 'calendar-backfill', source: 'app/(main)/calendar/CalendarClient.tsx', spec: 'dashboard-popups.spec.ts', sameAs: 'quick-symptom' },
]

/** Pop-ups of the admin app: no admin e2e harness exists, so they are held by __tests__/ui/admin-popups.test.ts. */
export const ADMIN_POPUP_SOURCES = [
  'app/(admin)/content/ContentClient.tsx',
  'app/(admin)/layout.tsx',
  'app/(admin)/sms/CreateBroadcastModal.tsx',
  'app/(admin)/sms/EditBroadcastModal.tsx',
  'app/(admin)/sms/RescheduleModal.tsx',
  'components/ui/ConfirmModal.tsx',
  'components/ui/Drawer.tsx',
]
