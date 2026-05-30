'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { RefetchButton } from '@/components/ui/RefetchButton'
import { adminCacheTags } from '@/lib/admin-cache-tags'
import {
  suspendUser,
  reactivateUser,
  softDeleteUser,
  grantProAccess,
  revokeProAccess,
} from '@/app/actions/user-actions'

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
  enabled?: boolean
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
  profiles: Profile[]
  subscriptions: Subscription[]
  feedback: Feedback[]
}

interface UserDetailClientProps {
  user: UserDetail
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

type TabKey = 'profiles' | 'subscription' | 'feedback'

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'profiles', label: 'Profiles', icon: <Heart size={15} aria-hidden="true" /> },
  { key: 'subscription', label: 'Subscription', icon: <CreditCard size={15} aria-hidden="true" /> },
  { key: 'feedback', label: 'Feedback', icon: <MessageSquare size={15} aria-hidden="true" /> },
]

// ─────────────────────────────────────────────────────────────────────────────
// Confirm modal state
// ─────────────────────────────────────────────────────────────────────────────

type ModalAction = 'suspend' | 'delete' | 'revoke' | null

const MODAL_CONFIG: Record<
  NonNullable<ModalAction>,
  { title: string; message: string; confirmLabel: string; variant: 'danger' | 'warning' }
> = {
  suspend: {
    title: 'Suspend User',
    message:
      'This will prevent the user from logging in. They can be reactivated at any time.',
    confirmLabel: 'Suspend',
    variant: 'warning',
  },
  delete: {
    title: 'Delete User',
    message:
      'This soft-deletes the user account. Their data is retained but the account will be inaccessible.',
    confirmLabel: 'Delete',
    variant: 'danger',
  },
  revoke: {
    title: 'Revoke Pro Access',
    message:
      'This will downgrade the user from Pro. Any admin-granted override will be removed.',
    confirmLabel: 'Revoke Pro',
    variant: 'warning',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Profiles Tab
// ─────────────────────────────────────────────────────────────────────────────

function ProfilesTab({ profiles }: { profiles: Profile[] }) {
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
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full gradient-primary text-white font-bold text-sm shadow-soft">
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
                  <p className="font-medium text-amber-600">Admin Override</p>
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
                className="text-xs font-medium text-[var(--color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 rounded"
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

export function UserDetailClient({ user }: UserDetailClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<TabKey>('profiles')
  const [modalAction, setModalAction] = useState<ModalAction>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const status = getUserStatus(user)
  const isSuspended = status === 'suspended'
  const isDeleted = status === 'deleted'
  const isPro = user.subscriptionStatus === 'PRO'

  async function handleConfirm() {
    if (!modalAction) return
    setActionError(null)

    try {
      if (modalAction === 'suspend') await suspendUser(user.id)
      else if (modalAction === 'delete') await softDeleteUser(user.id)
      else if (modalAction === 'revoke') await revokeProAccess(user.id)

      setModalAction(null)
      startTransition(() => router.refresh())
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'An error occurred. Please try again.')
    }
  }

  function handleReactivate() {
    setActionError(null)
    startTransition(async () => {
      try {
        await reactivateUser(user.id)
        router.refresh()
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Failed to reactivate user.')
      }
    })
  }

  function handleGrantPro() {
    setActionError(null)
    startTransition(async () => {
      try {
        await grantProAccess(user.id)
        router.refresh()
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Failed to grant Pro access.')
      }
    })
  }

  const displayName = user.fullName ?? user.email ?? user.phone ?? 'Unknown User'
  const initials = displayName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()

  return (
    <div className="space-y-6 page-enter">
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500"
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
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full gradient-primary text-white text-xl font-bold shadow-glow">
              {initials}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
                  {displayName}
                </h1>
                <StatusBadge status={status} />
                {isPro && <Badge variant="success">Pro</Badge>}
                {user.role === 'ADMIN' && <Badge variant="info">Admin</Badge>}
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
                  {user.authMethod === 'PHONE_OTP' ? 'Phone OTP' : 'Magic Link'}
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
              {isPro ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModalAction('revoke')}
                  disabled={isPending}
                >
                  <Crown size={14} aria-hidden="true" />
                  Revoke Pro
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleGrantPro}
                  loading={isPending}
                >
                  <Crown size={14} aria-hidden="true" />
                  Grant Pro
                </Button>
              )}

              {isSuspended ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReactivate}
                  loading={isPending}
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
            <Badge variant="neutral" className="shrink-0">
              Deleted {formatDate(user.deletedAt)}
            </Badge>
          )}
        </div>

        {/* Error banner */}
        {actionError && (
          <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            <AlertCircle size={15} aria-hidden="true" className="shrink-0" />
            {actionError}
          </div>
        )}

        {/* Suspension note */}
        {isSuspended && user.suspendedAt && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
            <Shield size={15} aria-hidden="true" className="shrink-0" />
            Suspended on {formatDateTime(user.suspendedAt)}
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
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

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-[var(--color-bg-secondary)] p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors transition-shadow duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 ${
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
      <div>
        {activeTab === 'profiles' && <ProfilesTab profiles={user.profiles} />}
        {activeTab === 'subscription' && (
          <SubscriptionTab
            subscriptions={user.subscriptions}
            userStatus={user.subscriptionStatus}
          />
        )}
        {activeTab === 'feedback' && <FeedbackTab feedback={user.feedback} />}
      </div>

      {/* Confirm modals */}
      <ConfirmModal
        open={modalAction !== null}
        onClose={() => setModalAction(null)}
        onConfirm={handleConfirm}
        loading={isPending}
        title={modalAction ? MODAL_CONFIG[modalAction].title : ''}
        message={modalAction ? MODAL_CONFIG[modalAction].message : ''}
        confirmLabel={modalAction ? MODAL_CONFIG[modalAction].confirmLabel : 'Confirm'}
        variant={modalAction ? MODAL_CONFIG[modalAction].variant : 'danger'}
      />
    </div>
  )
}
