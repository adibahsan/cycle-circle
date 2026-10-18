'use client'

import { useState, useRef, useTransition, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'
import {
  ArrowLeft,
  Phone,
  Mail,
  Smartphone,
  Calendar,
  Shield,
  Crown,
  Ban,
  CheckCircle,
  Trash2,
  User,
  Heart,
  CreditCard,
  MessageSquare,
  AlertCircle,
  Clock,
  Activity,
  Bell,
  History,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { RefetchButton } from '@/components/ui/RefetchButton'
import { useUrlTab } from '@/lib/use-url-tab'
import type { PlanHistoryEntry } from '@vesta/shared/server/services'
import { adminCacheTags } from '@/lib/admin-cache-tags'
import { Select } from '@/components/ui/Select'
import {
  suspendUser,
  reactivateUser,
  softDeleteUser,
  restoreUser,
  setUserSubscriptionStatus,
  setUserNotificationPrefs,
} from '@/app/actions/user-actions'
import { sendUserReminders, type CronJobResult } from '@/app/actions/system-actions'
import { isWithinRestoreWindow, RESTORE_WINDOW_DAYS } from '@vesta/shared/utils/restore-window'
import { getTrialStatus, getTrialHoursLeft } from '@vesta/shared/utils/trial'
import { getSubscriptionTier } from '@vesta/shared/utils/subscription'

// ─────────────────────────────────────────────────────────────────────────────
// Types (mirror the Prisma include shape from getUserDetail)
// ─────────────────────────────────────────────────────────────────────────────

interface CaasTransaction {
  id: string
  amount?: number | null
  status?: string | null
  createdAt: Date
}

interface Subscription {
  id: string
  status: string
  adminOverride?: boolean | null
  adminOverrideBy?: string | null
  adminOverrideAt?: Date | null
  createdAt: Date
  caasTransactions: CaasTransaction[]
}

interface PeriodLog {
  id: string
  startDate: Date
  endDate?: Date | null
}

interface NotificationPref {
  id: string
  periodAlert: boolean
  fertileWindow: boolean
  loggingReminder: boolean
}

interface Profile {
  id: string
  name?: string | null
  relation?: string | null
  cycleLength?: number | null
  periodLength?: number | null
  notificationPref?: NotificationPref | null
  periodLogs: PeriodLog[]
  _count: { periodLogs: number; symptomLogs: number }
}

interface Feedback {
  id: string
  category: string
  message: string
  rating?: number | null
  createdAt: Date
}

interface UserDetail {
  id: string
  phone: string | null
  email: string | null
  fullName: string | null
  authMethod: string
  subscriptionStatus: string
  role: string
  profileCompleted?: boolean | null
  suspendedAt: Date | null
  suspendedBy?: string | null
  deletedAt: Date | null
  lastLoginAt: Date | null
  createdAt: Date
  emailTrialExpiresAt: Date | null
  profiles: Profile[]
  subscriptions: Subscription[]
  feedback: Feedback[]
}

interface UserDetailClientProps {
  user: UserDetail
  /** Loaded server-side only while the Plan history tab is open. */
  planHistory: PlanHistoryEntry[] | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(d: Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(d: Date | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

type UserStatus = 'active' | 'suspended' | 'deleted'

function getUserStatus(user: UserDetail): UserStatus {
  if (user.deletedAt) return 'deleted'
  if (user.suspendedAt) return 'suspended'
  return 'active'
}

function StatusBadge({ status }: { status: UserStatus }) {
  if (status === 'active') return <Badge variant="success">Active</Badge>
  if (status === 'suspended') return <Badge variant="danger">Suspended</Badge>
  return <Badge variant="neutral">Deleted</Badge>
}

type TabKey = 'profiles' | 'subscription' | 'plan' | 'feedback'

const TAB_KEYS = ['profiles', 'subscription', 'plan', 'feedback'] as const satisfies readonly TabKey[]

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'profiles', label: 'Profiles', icon: <Heart size={15} aria-hidden="true" /> },
  { key: 'subscription', label: 'Subscription', icon: <CreditCard size={15} aria-hidden="true" /> },
  { key: 'plan', label: 'Plan history', icon: <History size={15} aria-hidden="true" /> },
  { key: 'feedback', label: 'Feedback', icon: <MessageSquare size={15} aria-hidden="true" /> },
]

// ─────────────────────────────────────────────────────────────────────────────
// Confirm modal state
// ─────────────────────────────────────────────────────────────────────────────

type ModalAction = 'suspend' | 'delete' | 'reactivate' | 'restore' | 'setStatus' | null

const MODAL_CONFIG: Record<
  'suspend' | 'delete' | 'reactivate' | 'restore',
  { title: string; message: string; confirmLabel: string; variant: 'danger' | 'warning' }
> = {
  suspend: {
    title: 'Suspend User',
    message:
      'This signs the user out everywhere immediately, prevents them from logging in, and unsubscribes their number on BDApps. They can be reactivated at any time, but reactivating does not re-subscribe them.',
    confirmLabel: 'Suspend',
    variant: 'warning',
  },
  delete: {
    title: 'Delete User',
    message:
      `This soft-deletes the user account and unsubscribes their number on BDApps. The account can be restored for ${RESTORE_WINDOW_DAYS} days, after which it is purged. Restoring does not re-subscribe them.`,
    confirmLabel: 'Delete',
    variant: 'danger',
  },
  reactivate: {
    title: 'Reactivate User',
    message:
      'This lets the user log in again. It does not re-subscribe their number on BDApps; they subscribe again by logging in with their phone.',
    confirmLabel: 'Reactivate',
    variant: 'warning',
  },
  restore: {
    title: 'Restore User',
    message:
      'This restores the deleted account. It does not re-subscribe their number on BDApps; they subscribe again by logging in with their phone.',
    confirmLabel: 'Restore',
    variant: 'warning',
  },
}

const SUB_STATUS_OPTIONS = [
  { value: 'PRO', label: 'Pro' },
  { value: 'FREE', label: 'Free' },
  { value: 'LAPSED', label: 'Lapsed' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Accessible toggle (role="switch") — no external dep needed
// ─────────────────────────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}

function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border-strong)]'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Send reminder emails card
// ─────────────────────────────────────────────────────────────────────────────

function SendRemindersCard({ userId }: { userId: string }) {
  const [reminderResult, setReminderResult] = useState<CronJobResult | null>(null)
  const [isReminderPending, startReminderTransition] = useTransition()

  function handleSendReminders() {
    setReminderResult(null)
    startReminderTransition(async () => {
      const result = await sendUserReminders(userId)
      setReminderResult(result)
    })
  }

  const sent = reminderResult?.ok
    ? ((reminderResult.counts?.periodAlerts ?? 0) +
        (reminderResult.counts?.fertileAlerts ?? 0) +
        (reminderResult.counts?.reminders ?? 0) +
        (reminderResult.counts?.completionReminders ?? 0))
    : 0

  const breakdown: { label: string; key: string }[] = [
    { label: 'Period alerts', key: 'periodAlerts' },
    { label: 'Fertile window', key: 'fertileAlerts' },
    { label: 'Logging reminders', key: 'reminders' },
    { label: 'Profile completion', key: 'completionReminders' },
  ]

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-soft space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Bell size={14} aria-hidden="true" className="text-[var(--color-text-muted)]" />
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              Reminder emails
            </p>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
            Sends any reminder emails currently due for this user&apos;s profiles (period / fertile
            / logging / profile-completion), bypassing the once-per-day limit.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSendReminders}
          loading={isReminderPending}
          className="shrink-0"
        >
          <Bell size={14} aria-hidden="true" />
          Send reminder emails now
        </Button>
      </div>

      <div aria-live="polite">
        {reminderResult && reminderResult.ok && (
          <div className="rounded-xl bg-[var(--color-success-bg)] border border-[var(--color-success)] px-4 py-3 text-sm text-[var(--color-success)] space-y-1">
            {sent > 0 ? (
              <>
                <p className="font-medium">
                  Sent {sent} reminder email{sent !== 1 ? 's' : ''}.
                </p>
                <ul className="text-xs space-y-0.5 mt-1">
                  {breakdown
                    .filter((b) => (reminderResult.counts?.[b.key] ?? 0) > 0)
                    .map((b) => (
                      <li key={b.key} className="flex items-center gap-1.5">
                        <CheckCircle size={11} aria-hidden="true" className="shrink-0" />
                        {b.label}: {reminderResult.counts![b.key]}
                      </li>
                    ))}
                </ul>
              </>
            ) : (
              <p>No reminders are currently due for this user.</p>
            )}
          </div>
        )}
        {reminderResult && !reminderResult.ok && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-xl bg-[var(--color-danger-bg)] border border-[var(--color-danger)] px-4 py-3 text-sm text-[var(--color-danger)]"
          >
            <AlertCircle size={15} aria-hidden="true" className="shrink-0" />
            {reminderResult.error ?? 'Failed to send reminders.'}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-profile notification toggles card
// ─────────────────────────────────────────────────────────────────────────────

interface NotifPrefsCardProps {
  userId: string
  profile: Profile
}

function NotifPrefsCard({ userId, profile }: NotifPrefsCardProps) {
  const saved = profile.notificationPref
  const [prefs, setPrefs] = useState({
    periodAlert: saved?.periodAlert ?? true,
    fertileWindow: saved?.fertileWindow ?? true,
    loggingReminder: saved?.loggingReminder ?? true,
  })
  const savedRef = useRef(prefs)
  const [isPending, startTransition] = useTransition()

  function handleToggle(key: 'periodAlert' | 'fertileWindow' | 'loggingReminder') {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    startTransition(async () => {
      try {
        await setUserNotificationPrefs(userId, profile.id, { [key]: next[key] })
        savedRef.current = next
      } catch {
        setPrefs(savedRef.current)
      }
    })
  }

  const TOGGLE_ITEMS: { key: 'periodAlert' | 'fertileWindow' | 'loggingReminder'; label: string }[] = [
    { key: 'periodAlert', label: 'Period alerts' },
    { key: 'fertileWindow', label: 'Fertile window' },
    { key: 'loggingReminder', label: 'Logging reminders' },
  ]

  return (
    <div aria-live="polite" className="space-y-2.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        Notifications
      </p>
      {TOGGLE_ITEMS.map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between gap-3">
          <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
          <Toggle
            checked={prefs[key]}
            onChange={() => handleToggle(key)}
            label={label}
            disabled={isPending}
          />
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Profiles Tab
// ─────────────────────────────────────────────────────────────────────────────

function ProfilesTab({ profiles, userId }: { profiles: Profile[]; userId: string }) {
  if (profiles.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-[var(--color-text-muted)]">
        <User size={36} aria-hidden="true" className="opacity-30" />
        <p className="text-sm">No profiles created yet.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {profiles.map((profile) => (
        <div
          key={profile.id}
          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 space-y-4 shadow-soft"
        >
          {/* Profile header */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-action)] text-[var(--color-on-action)] font-bold text-sm shadow-soft">
              {(profile.name ?? 'P').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-[var(--color-text-primary)]">
                {profile.name ?? 'Unnamed Profile'}
              </p>
              {profile.relation && (
                <p className="text-xs text-[var(--color-text-muted)]">
                  {profile.relation}
                </p>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-[var(--color-bg-secondary)] px-3 py-2.5">
              <p className="text-xs text-[var(--color-text-muted)]">Cycle length</p>
              <p className="font-semibold text-[var(--color-text-primary)]">
                {profile.cycleLength ? `${profile.cycleLength} days` : '—'}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--color-bg-secondary)] px-3 py-2.5">
              <p className="text-xs text-[var(--color-text-muted)]">Period length</p>
              <p className="font-semibold text-[var(--color-text-primary)]">
                {profile.periodLength ? `${profile.periodLength} days` : '—'}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--color-bg-secondary)] px-3 py-2.5">
              <p className="text-xs text-[var(--color-text-muted)]">Period logs</p>
              <p className="font-semibold text-[var(--color-text-primary)]">
                {profile._count.periodLogs}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--color-bg-secondary)] px-3 py-2.5">
              <p className="text-xs text-[var(--color-text-muted)]">Symptom logs</p>
              <p className="font-semibold text-[var(--color-text-primary)]">
                {profile._count.symptomLogs}
              </p>
            </div>
          </div>

          {/* Notification preference toggles */}
          <div className="border-t border-[var(--color-border)] pt-4">
            <NotifPrefsCard userId={userId} profile={profile} />
          </div>

          {/* Recent logs */}
          {profile.periodLogs.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Recent Logs
              </p>
              <div className="space-y-1">
                {profile.periodLogs.slice(0, 3).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]"
                  >
                    <Activity size={10} aria-hidden="true" className="shrink-0 text-[var(--color-primary)] opacity-60" />
                    <span>
                      {formatDate(log.startDate)}
                      {log.endDate ? ` → ${formatDate(log.endDate)}` : ' (ongoing)'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscription Tab
// ─────────────────────────────────────────────────────────────────────────────

function SubscriptionTab({
  subscriptions,
  userStatus,
}: {
  subscriptions: Subscription[]
  userStatus: string
}) {
  const activeSub = subscriptions.find((s) => s.status === 'PRO') ?? subscriptions[0]

  return (
    <div className="space-y-5">
      {/* Current status card */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[var(--color-text-primary)]">Current Subscription</h3>
          {userStatus === 'PRO' ? (
            <Badge variant="success">Pro</Badge>
          ) : userStatus === 'LAPSED' ? (
            <Badge variant="warning">Lapsed</Badge>
          ) : (
            <Badge variant="neutral">Free</Badge>
          )}
        </div>
        {activeSub ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Status</p>
              <p className="font-medium text-[var(--color-text-primary)]">{activeSub.status}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Since</p>
              <p className="font-medium text-[var(--color-text-primary)]">{formatDate(activeSub.createdAt)}</p>
            </div>
            {activeSub.adminOverride && (
              <>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Source</p>
                  <p className="font-medium text-[var(--color-warning)]">Admin Override</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Override at</p>
                  <p className="font-medium text-[var(--color-text-primary)]">
                    {formatDate(activeSub.adminOverrideAt)}
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">No subscription record found.</p>
        )}
      </div>

      {/* Transactions */}
      {activeSub && activeSub.caasTransactions.length > 0 && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-soft">
          <h3 className="font-semibold text-[var(--color-text-primary)] mb-4">
            CAAS Transactions ({activeSub.caasTransactions.length})
          </h3>
          <div className="space-y-2">
            {activeSub.caasTransactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-xl bg-[var(--color-bg-secondary)] px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                  <Clock size={13} aria-hidden="true" className="shrink-0" />
                  <span>{formatDateTime(tx.createdAt)}</span>
                </div>
                <div className="flex items-center gap-3">
                  {tx.amount != null && (
                    <span className="font-medium text-[var(--color-text-primary)]">
                      ৳{tx.amount}
                    </span>
                  )}
                  {tx.status && (
                    <Badge
                      variant={
                        tx.status === 'SUCCESS'
                          ? 'success'
                          : tx.status === 'FAILED'
                          ? 'danger'
                          : 'warning'
                      }
                      size="sm"
                    >
                      {tx.status}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subscriptions.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-[var(--color-text-muted)]">
          <CreditCard size={36} aria-hidden="true" className="opacity-30" />
          <p className="text-sm">No subscription history.</p>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan history Tab (translog lines for this user)
// ─────────────────────────────────────────────────────────────────────────────

const CAUSE_LABELS: Record<string, string> = {
  'otp-verify': 'OTP sign-in',
  'phone-verify': 'Phone verified',
  'dev-login': 'Dev login',
  webhook: 'BDApps webhook',
  'nightly-check': 'Nightly check',
  unsubscribe: 'Unsubscribed',
  admin: 'Admin',
  unknown: 'Unknown',
}

function PlanHistoryTab({ entries }: { entries: PlanHistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-[var(--color-text-muted)]">
        <History size={36} aria-hidden="true" className="opacity-30" />
        <p className="text-sm">No plan changes recorded for this user.</p>
      </div>
    )
  }

  return (
    <ol className="space-y-3">
      {entries.map((e, i) => (
        <li
          key={`${e.ts}-${i}`}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-soft"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
              {e.event === 'plan.bdapps-unsubscribe' ? (
                <>
                  <Badge variant={e.unsubscribe?.result === 'failed' ? 'danger' : e.unsubscribe?.result === 'skipped' ? 'warning' : 'success'} size="sm">
                    {e.unsubscribe?.result ?? 'skipped'}
                  </Badge>
                  <span>BDApps unsubscribe</span>
                </>
              ) : e.event === 'plan.override-kept' ? (
                <>
                  <Badge variant="warning" size="sm">{e.to ?? '—'}</Badge>
                  <span>Admin override kept</span>
                </>
              ) : (
                <>
                  <Badge variant="neutral" size="sm">{e.from ?? 'None'}</Badge>
                  <span aria-hidden="true">→</span>
                  <span className="sr-only">to</span>
                  <Badge variant={e.to === 'PRO' ? 'success' : 'neutral'} size="sm">{e.to ?? '—'}</Badge>
                  {!e.changed && <span className="text-xs text-[var(--color-text-muted)]">(no change)</span>}
                </>
              )}
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              {CAUSE_LABELS[e.cause] ?? e.cause}
              {e.adminId && <> · by admin <span className="font-mono">{e.adminId}</span></>}
              {e.unsubscribe?.error && <> · {e.unsubscribe.error}</>}
            </p>
          </div>
          <time dateTime={e.ts} className="text-xs tabular-nums text-[var(--color-text-muted)]">
            {formatDateTime(new Date(e.ts))}
          </time>
        </li>
      ))}
    </ol>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Feedback Tab
// ─────────────────────────────────────────────────────────────────────────────

const FEEDBACK_CATEGORY_LABELS: Record<string, string> = {
  BUG: 'Bug',
  FEATURE: 'Feature',
  GENERAL: 'General',
  SATISFACTION: 'Satisfaction',
}

function FeedbackTab({ feedback }: { feedback: Feedback[] }) {
  if (feedback.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-[var(--color-text-muted)]">
        <MessageSquare size={36} aria-hidden="true" className="opacity-30" />
        <p className="text-sm">No feedback submitted yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {feedback.map((fb) => (
        <div
          key={fb.id}
          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 shadow-soft space-y-2"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="info" size="sm">
                {FEEDBACK_CATEGORY_LABELS[fb.category] ?? fb.category}
              </Badge>
              {fb.rating != null && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  Rating: {fb.rating}/5
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs text-[var(--color-text-muted)]">
                {formatDate(fb.createdAt)}
              </span>
              <Link
                href={`/feedback/${fb.id}`}
                className="text-xs font-medium text-[var(--color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)] rounded"
              >
                View
              </Link>
            </div>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed line-clamp-3">
            {fb.message}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function UserDetailClient({ user, planHistory }: UserDetailClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useUrlTab(TAB_KEYS, 'profiles')
  const toast = useToast()
  const [modalAction, setModalAction] = useState<ModalAction>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [suspendReason, setSuspendReason] = useState('')

  // Subscription status selector state
  const [pendingStatus, setPendingStatus] = useState<'PRO' | 'FREE' | 'LAPSED' | null>(null)

  function handleTabKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = TAB_KEYS.indexOf(activeTab)
    const next =
      e.key === 'ArrowRight' ? (i + 1) % TAB_KEYS.length
      : e.key === 'ArrowLeft' ? (i - 1 + TAB_KEYS.length) % TAB_KEYS.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? TAB_KEYS.length - 1
      : -1
    if (next < 0) return
    e.preventDefault()
    setActiveTab(TAB_KEYS[next])
    document.getElementById(`tab-${TAB_KEYS[next]}`)?.focus()
  }

  const status = getUserStatus(user)
  const isSuspended = status === 'suspended'
  const isDeleted = status === 'deleted'
  const userTier = getSubscriptionTier(user)
  const isPro = userTier === 'PRO'
  const canRestore = isDeleted && !!user.deletedAt && isWithinRestoreWindow(new Date(user.deletedAt))

  async function handleConfirm() {
    if (!modalAction) return
    setActionError(null)

    try {
      if (modalAction === 'suspend' || modalAction === 'delete') {
        const res = modalAction === 'suspend'
          ? await suspendUser(user.id, suspendReason.trim())
          : await softDeleteUser(user.id)
        if (res.bdappsError) {
          toast.error(`${modalAction === 'suspend' ? 'User suspended' : 'User deleted'}, but the BDApps unsubscribe failed: ${res.bdappsError}. The user may still be charged.`)
        }
      }
      else if (modalAction === 'reactivate') await reactivateUser(user.id)
      else if (modalAction === 'restore') await restoreUser(user.id)
      else if (modalAction === 'setStatus' && pendingStatus) {
        const res = await setUserSubscriptionStatus(user.id, pendingStatus)
        if (res.bdappsError) {
          toast.error(`Plan changed, but the BDApps unsubscribe failed: ${res.bdappsError}. The user may still be charged.`)
        }
        setPendingStatus(null)
      }

      setModalAction(null)
      setSuspendReason('')
      startTransition(() => router.refresh())
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'An error occurred. Please try again.')
    }
  }

  function handleStatusSelectChange(value: string) {
    const next = value as 'PRO' | 'FREE' | 'LAPSED'
    if (next === user.subscriptionStatus) return
    setPendingStatus(next)
    setModalAction('setStatus')
  }

  const displayName = user.fullName ?? user.email ?? user.phone ?? 'Unknown User'
  const initials = displayName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()

  return (
    <div className="space-y-6 page-enter">
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to users
        </button>
        <RefetchButton tags={[adminCacheTags.user(user.id), adminCacheTags.users]} />
      </div>

      {/* User header card */}
      <div className="glass rounded-2xl border border-[var(--color-border)] p-6 shadow-soft">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          {/* Avatar + info */}
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--color-action)] text-[var(--color-on-action)] text-xl font-bold shadow-glow">
              {initials}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
                  {displayName}
                </h1>
                <StatusBadge status={status} />
                {userTier === 'PRO' && <Badge variant="success">Pro</Badge>}
                {userTier === 'LAPSED' && <Badge variant="warning">Lapsed</Badge>}
                {user.role === 'ADMIN' && <Badge variant="info">Admin</Badge>}
                {(() => {
                  const trial = getTrialStatus(user)
                  if (trial === 'active') {
                    const hours = getTrialHoursLeft(user.emailTrialExpiresAt)
                    return (
                      <Badge variant="warning">
                        <span className="tabular-nums">Trial · {hours}h</span>
                      </Badge>
                    )
                  }
                  if (trial === 'expired') {
                    return <Badge variant="danger">Trial expired</Badge>
                  }
                  return null
                })()}
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-[var(--color-text-muted)]">
                {user.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail size={13} aria-hidden="true" />
                    {user.email}
                  </span>
                )}
                {user.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone size={13} aria-hidden="true" />
                    {user.phone}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Smartphone size={13} aria-hidden="true" />
                  {user.authMethod === 'OTP' ? 'Phone OTP' : 'Magic Link'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={13} aria-hidden="true" />
                  Joined {formatDate(user.createdAt)}
                </span>
                {user.lastLoginAt && (
                  <span className="flex items-center gap-1.5">
                    <Clock size={13} aria-hidden="true" />
                    Last seen {formatDate(user.lastLoginAt)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          {!isDeleted && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Subscription status 3-way selector */}
              <div className="flex items-center gap-1.5">
                <Crown size={14} aria-hidden="true" className="text-[var(--color-text-muted)] shrink-0" />
                <Select
                  options={SUB_STATUS_OPTIONS}
                  value={user.subscriptionStatus}
                  onChange={handleStatusSelectChange}
                  aria-label="Set subscription status"
                  selectSize="sm"
                  disabled={isPending}
                  containerClassName="w-[120px]"
                />
              </div>

              {isSuspended ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setModalAction('reactivate')}
                  disabled={isPending}
                >
                  <CheckCircle size={14} aria-hidden="true" />
                  Reactivate
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModalAction('suspend')}
                  disabled={isPending}
                >
                  <Ban size={14} aria-hidden="true" />
                  Suspend
                </Button>
              )}

              <Button
                variant="danger"
                size="sm"
                onClick={() => setModalAction('delete')}
                disabled={isPending}
              >
                <Trash2 size={14} aria-hidden="true" />
                Delete
              </Button>
            </div>
          )}

          {isDeleted && (
            <div className="flex shrink-0 items-center gap-3">
              <Badge variant="neutral">Deleted {formatDate(user.deletedAt)}</Badge>
              {canRestore ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setModalAction('restore')}
                  disabled={isPending}
                >
                  <CheckCircle size={14} aria-hidden="true" />
                  Restore
                </Button>
              ) : (
                <span className="text-xs text-[var(--color-text-muted)]">
                  Restore window ({RESTORE_WINDOW_DAYS} days) has passed
                </span>
              )}
            </div>
          )}
        </div>

        {/* Error banner */}
        {actionError && (
          <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--color-danger-bg)] border border-[var(--color-danger)] px-4 py-3 text-sm text-[var(--color-danger)]">
            <AlertCircle size={15} aria-hidden="true" className="shrink-0" />
            {actionError}
          </div>
        )}

        {/* Suspension note */}
        {isSuspended && user.suspendedAt && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--color-warning-bg)] border border-[var(--color-warning)] px-4 py-3 text-sm text-[var(--color-warning)]">
            <Shield size={15} aria-hidden="true" className="shrink-0" />
            Suspended on {formatDateTime(user.suspendedAt)}
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass rounded-2xl border border-[var(--color-border)] p-4 shadow-soft text-center">
          <p className="text-2xl font-bold tabular-nums text-[var(--color-text-primary)]">{user.profiles.length}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Profiles</p>
        </div>
        <div className="glass rounded-2xl border border-[var(--color-border)] p-4 shadow-soft text-center">
          <p className="text-2xl font-bold tabular-nums text-[var(--color-text-primary)]">
            {user.profiles.reduce((sum, p) => sum + p._count.periodLogs, 0)}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Period Logs</p>
        </div>
        <div className="glass rounded-2xl border border-[var(--color-border)] p-4 shadow-soft text-center">
          <p className="text-2xl font-bold tabular-nums text-[var(--color-text-primary)]">{user.feedback.length}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Feedback</p>
        </div>
      </div>

      {/* Send reminder emails */}
      {!isDeleted && <SendRemindersCard userId={user.id} />}

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="User details"
        className="flex gap-1 rounded-xl bg-[var(--color-bg-secondary)] p-1 w-fit max-w-full overflow-x-auto"
        onKeyDown={handleTabKeyDown}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`tab-${tab.key}`}
            aria-selected={activeTab === tab.key}
            aria-controls={`tabpanel-${tab.key}`}
            tabIndex={activeTab === tab.key ? 0 : -1}
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)] ${
              activeTab === tab.key
                ? 'bg-[var(--color-bg-card)] text-[var(--color-primary)] shadow-soft'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={`tab-${activeTab}`} tabIndex={0} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-xl">
        {activeTab === 'profiles' && <ProfilesTab profiles={user.profiles} userId={user.id} />}
        {activeTab === 'subscription' && (
          <SubscriptionTab
            subscriptions={user.subscriptions}
            userStatus={userTier}
          />
        )}
        {activeTab === 'plan' && <PlanHistoryTab entries={planHistory ?? []} />}
        {activeTab === 'feedback' && <FeedbackTab feedback={user.feedback} />}
      </div>

      {/* Confirm modals */}
      <ConfirmModal
        open={modalAction !== null}
        onClose={() => { setModalAction(null); setPendingStatus(null); setSuspendReason('') }}
        onConfirm={handleConfirm}
        loading={isPending}
        confirmDisabled={modalAction === 'suspend' && !suspendReason.trim()}
        title={
          modalAction === 'setStatus'
            ? 'Change Subscription Status'
            : modalAction
            ? MODAL_CONFIG[modalAction].title
            : ''
        }
        message={
          modalAction === 'setStatus'
            ? `Set ${displayName}'s subscription to ${pendingStatus}? This will override their current subscription status.`
            : modalAction
            ? MODAL_CONFIG[modalAction].message
            : ''
        }
        confirmLabel={
          modalAction === 'setStatus'
            ? `Set ${pendingStatus}`
            : modalAction
            ? MODAL_CONFIG[modalAction].confirmLabel
            : 'Confirm'
        }
        variant={
          modalAction === 'setStatus'
            ? 'warning'
            : modalAction
            ? MODAL_CONFIG[modalAction].variant
            : 'danger'
        }
      >
        {modalAction === 'suspend' && (
          <div className="mb-6">
            <label htmlFor="suspend-reason" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Reason (required, saved to the audit log)
            </label>
            <textarea
              id="suspend-reason"
              name="suspend-reason"
              rows={3}
              required
              maxLength={500}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Why is this account being suspended…"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            />
          </div>
        )}
      </ConfirmModal>
    </div>
  )
}
