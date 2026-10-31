import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireAdminUser } from '@/app/queries/auth-queries'
import { getSubscriptionCheckRunDetail } from '@/app/queries/system-queries'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { Card } from '@/components/ui/Card'
import { formatDhaka } from '@vesta/shared/utils/dhaka-date'
import { RUN_TIME_FORMAT, runDuration, runStatusBadge } from '../../RunHistory'

export default async function SubscriptionCheckRunPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminUser()
  const { id } = await params
  const run = await getSubscriptionCheckRunDetail(id)
  if (!run) notFound()
  const moved = run.outcomes.filter((o) => o.outcome === 'MOVED_TO_FREE')
  const errored = run.outcomes.filter((o) => o.outcome === 'ERROR')

  return (
    <div className="space-y-6 page-enter">
      <Link href="/system" className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]">
        <ArrowLeft size={14} aria-hidden="true" /> System
      </Link>
      <AdminPageHeader
        title="Subscription check run"
        description={`${run.trigger === 'CRON' ? 'Scheduled' : 'Manual'} run started ${formatDhaka(run.startedAt, RUN_TIME_FORMAT)} (Bangladesh time), duration ${runDuration(run.startedAt, run.finishedAt)}`}
        tags={[]}
      />
      <Card>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div><dt className="text-xs text-[var(--color-text-muted)]">Status</dt><dd className="mt-1">{runStatusBadge(run.status)}</dd></div>
          <div><dt className="text-xs text-[var(--color-text-muted)]">Checked</dt><dd className="text-lg font-bold tabular-nums">{run.checkedCount}</dd></div>
          <div><dt className="text-xs text-[var(--color-text-muted)]">Moved to Free</dt><dd className="text-lg font-bold tabular-nums">{run.movedCount}</dd></div>
          <div><dt className="text-xs text-[var(--color-text-muted)]">Errors</dt><dd className="text-lg font-bold tabular-nums">{run.errorCount}</dd></div>
        </dl>
        {run.error && <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">{run.error}</p>}
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Moved to Free</h2>
        {moved.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">Nobody was moved to Free in this run.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--color-border)]" data-testid="moved-users">
            {moved.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <Link href={`/users/${o.userId}`} className="font-medium text-[var(--color-primary)] hover:underline">
                  {o.user.fullName ?? o.user.email ?? o.userId}
                </Link>
                <span className="font-mono text-xs text-[var(--color-text-muted)]">
                  {o.maskedSubscriberId} · BDApps said {o.bdappsStatus}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">Errors</h2>
        {errored.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">No errors in this run.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--color-border)]" data-testid="errored-users">
            {errored.map((o) => (
              <li key={o.id} className="py-2 text-sm">
                <Link href={`/users/${o.userId}`} className="font-medium text-[var(--color-primary)] hover:underline">
                  {o.user.fullName ?? o.user.email ?? o.userId}
                </Link>
                <span className="ml-2 font-mono text-xs text-[var(--color-text-muted)]">{o.maskedSubscriberId}</span>
                <p className="text-xs text-[var(--color-danger)]">{o.error}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
