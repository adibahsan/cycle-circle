import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatDhaka } from '@vesta/shared/utils/dhaka-date'
import { getSubscriptionCheckHistory } from '@/app/queries/system-queries'

export const RUN_TIME_FORMAT = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
} as const

export function runStatusBadge(status: string) {
  if (status === 'OK') return <Badge variant="success" size="sm">OK</Badge>
  if (status === 'FAILED') return <Badge variant="danger" size="sm">Failed</Badge>
  return <Badge variant="neutral" size="sm">Skipped</Badge>
}

export function runDuration(startedAt: Date, finishedAt: Date | null): string {
  if (!finishedAt) return '—'
  const s = Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000))
  return `${s}s`
}

/** The last 30 runs of the daily subscription check, in Bangladesh time. */
export async function RunHistory() {
  const runs = await getSubscriptionCheckHistory()
  return (
    <Card>
      <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
        Daily subscription check history
      </h2>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        The last 30 runs, scheduled and manual, in Bangladesh time. Open a run to see who it moved to Free.
      </p>
      {runs.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-text-muted)]" data-testid="run-history-empty">
          No runs recorded yet.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm" data-testid="run-history">
            <thead>
              <tr className="text-left text-xs text-[var(--color-text-muted)]">
                <th className="py-2 pr-4 font-medium">Started (Bangladesh time)</th>
                <th className="py-2 pr-4 font-medium">Trigger</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 text-right font-medium">Checked</th>
                <th className="py-2 pr-4 text-right font-medium">Moved to Free</th>
                <th className="py-2 pr-4 text-right font-medium">Errors</th>
                <th className="py-2 font-medium">Duration</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-t border-[var(--color-border)]" data-testid="run-row">
                  <td className="py-2 pr-4">
                    <Link
                      href={`/system/runs/${run.id}`}
                      className="font-medium text-[var(--color-primary)] hover:underline"
                    >
                      {formatDhaka(run.startedAt, RUN_TIME_FORMAT)}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{run.trigger === 'CRON' ? 'Scheduled' : 'Manual'}</td>
                  <td className="py-2 pr-4">{runStatusBadge(run.status)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{run.checkedCount}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{run.movedCount}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{run.errorCount}</td>
                  <td className="py-2 tabular-nums">{runDuration(run.startedAt, run.finishedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
