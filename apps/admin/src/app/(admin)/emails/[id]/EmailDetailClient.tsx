'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'
import { getEmailLogPreviewHtml } from '@/app/actions/email-preview-actions'
import { refreshEmailDeliveryStatus } from '@/app/actions/email-delivery-actions'

type EmailLogDetail = {
  id: string
  type: string
  to: string
  subject: string
  status: string
  error: string | null
  provider: string
  resendId: string | null
  deliveryStatus: string
  sentAt: Date
  user: { id: string; fullName: string | null; email: string | null } | null
  profile: { id: string; name: string } | null
}

function typeBadge(type: string) {
  const map: Record<string, { variant: 'info' | 'success' | 'warning' | 'neutral'; label: string }> = {
    MAGIC_LINK: { variant: 'info', label: 'Magic Link' },
    PERIOD_ALERT: { variant: 'warning', label: 'Period Alert' },
    FERTILE_ALERT: { variant: 'success', label: 'Fertile Alert' },
    LOGGING_REMINDER: { variant: 'neutral', label: 'Logging Reminder' },
  }
  const cfg = map[type] ?? { variant: 'neutral' as const, label: type }
  return <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
}

function statusBadge(status: string) {
  return (
    <Badge variant={status === 'SENT' ? 'success' : 'danger'} size="sm">
      {status}
    </Badge>
  )
}

function deliveryBadge(status: string) {
  const variant =
    status === 'DELIVERED'
      ? 'success'
      : status === 'BOUNCED' || status === 'COMPLAINED'
        ? 'danger'
        : status === 'DELAYED'
          ? 'warning'
          : 'neutral'
  return (
    <Badge variant={variant} size="sm">
      {status}
    </Badge>
  )
}

function formatDateTime(d: Date) {
  return new Date(d).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-36 shrink-0 text-sm font-medium text-[var(--color-text-muted)]">{label}</dt>
      <dd className="text-sm text-[var(--color-text-primary)]">{children}</dd>
    </div>
  )
}

interface EmailDetailClientProps {
  log: EmailLogDetail
}

export function EmailDetailClient({ log }: EmailDetailClientProps) {
  const [previewHtml, setPreviewHtml] = useState<string>('')
  const [previewSubject, setPreviewSubject] = useState<string>(log.subject)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [deliveryStatus, setDeliveryStatus] = useState(log.deliveryStatus)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [isRefreshing, startRefresh] = useTransition()

  function handleRefreshStatus() {
    if (!log.resendId) return
    startRefresh(async () => {
      setRefreshError(null)
      const result = await refreshEmailDeliveryStatus(log.id)
      setDeliveryStatus(result.deliveryStatus)
      if (result.error) {
        setRefreshError(result.error)
      }
    })
  }

  useEffect(() => {
    startTransition(async () => {
      try {
        const result = await getEmailLogPreviewHtml(log.id)
        if (!result) {
          setPreviewError('Could not generate preview for this email type.')
          return
        }
        setPreviewHtml(result.html)
        setPreviewSubject(result.subject)
        setPreviewError(null)
      } catch {
        setPreviewError('Failed to load email preview.')
      }
    })
  }, [log.id])

  return (
    <div className="space-y-6 page-enter">
      <Link
        href="/emails"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Back to email logs
      </Link>

      <AdminPageHeader
        title="Email Preview"
        description={log.subject}
        tags={[adminCacheTags.emails]}
      />

      <div
        role="status"
        className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        <AlertTriangle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />
        <p>
          Approximate preview — dynamic values (dates, magic links) are reconstructed and may
          differ from the original send.
        </p>
      </div>

      <div className="glass rounded-2xl border border-[var(--color-border)] p-6 shadow-soft">
        <dl className="space-y-3">
          <MetaRow label="Type">{typeBadge(log.type)}</MetaRow>
          <MetaRow label="To">{log.to}</MetaRow>
          <MetaRow label="Subject">{previewSubject}</MetaRow>
          <MetaRow label="Status">{statusBadge(log.status)}</MetaRow>
          <MetaRow label="Delivery">
            <div className="flex flex-wrap items-center gap-2">
              {deliveryBadge(deliveryStatus)}
              {log.resendId && (
                <button
                  type="button"
                  onClick={handleRefreshStatus}
                  disabled={isRefreshing}
                  aria-label="Refresh delivery status from Resend"
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-1 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 disabled:opacity-50"
                >
                  <RefreshCw
                    size={13}
                    aria-hidden="true"
                    className={isRefreshing ? 'animate-spin' : undefined}
                  />
                  {isRefreshing ? 'Refreshing…' : 'Refresh'}
                </button>
              )}
              {refreshError && (
                <span role="alert" className="text-xs text-red-600">
                  {refreshError}
                </span>
              )}
            </div>
          </MetaRow>
          <MetaRow label="Provider">{log.provider}</MetaRow>
          <MetaRow label="Sent">{formatDateTime(log.sentAt)}</MetaRow>
          {log.resendId && <MetaRow label="Resend ID">{log.resendId}</MetaRow>}
          {log.error && (
            <MetaRow label="Error">
              <span className="text-red-600">{log.error}</span>
            </MetaRow>
          )}
          {log.user && (
            <MetaRow label="User">
              <Link
                href={`/users/${log.user.id}`}
                className="text-[var(--color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 rounded"
              >
                {log.user.fullName ?? log.user.email ?? log.user.id}
              </Link>
            </MetaRow>
          )}
          {log.profile && (
            <MetaRow label="Profile">{log.profile.name}</MetaRow>
          )}
        </dl>
      </div>

      <div className="glass rounded-2xl border border-[var(--color-border)] p-6 shadow-soft">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Rendered preview
        </h2>
        <div className="flex justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4">
          {previewHtml ? (
            <iframe
              title={`Email preview: ${log.type}`}
              srcDoc={previewHtml}
              sandbox=""
              className="h-[640px] w-full max-w-[600px] rounded border-0 bg-white"
              aria-label={`Rendered email preview for ${log.type}`}
            />
          ) : (
            <div
              aria-live="polite"
              className="flex h-[640px] w-full max-w-[600px] items-center justify-center rounded border border-dashed border-[var(--color-border)] bg-white text-sm text-[var(--color-text-muted)]"
            >
              {previewError ?? (isPending ? 'Generating preview…' : 'Loading preview…')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
