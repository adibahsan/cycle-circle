import Link from 'next/link'
import { requireAdminUser } from '@/app/queries/auth-queries'
import { getLogs } from '@/app/queries/log-queries'
import { ADMIN_LOG_CHANNELS as LOG_CHANNELS } from '@vesta/shared/server/services'
import type { LogChannel } from '@vesta/shared/server/log'
import { Badge } from '@/components/ui/Badge'

const LEVEL_VARIANT = { info: 'neutral', warn: 'warning', error: 'danger' } as const
const PAGE_SIZE = 50

const field =
  'rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  await requireAdminUser()
  const p = await searchParams
  const channel = LOG_CHANNELS.find((c) => c === p.channel) as LogChannel | undefined
  const filters = {
    channels: channel ? [channel] : undefined,
    from: p.from || undefined,
    to: p.to || undefined,
    text: p.text || undefined,
    requestId: p.requestId || undefined,
    userId: p.userId || undefined,
  }
  const { lines, nextCursor } = await getLogs({ ...filters, limit: PAGE_SIZE, cursor: p.cursor })

  const nextParams = new URLSearchParams()
  for (const [k, v] of Object.entries({ channel, ...filters, channels: undefined })) {
    if (typeof v === 'string' && v) nextParams.set(k, v)
  }
  if (nextCursor) nextParams.set('cursor', nextCursor)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Logs</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Merchant calls, webhook events and the translog, newest first. OTP values are masked.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Filter logs">
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
          Channel
          <select name="channel" defaultValue={channel ?? ''} className={field}>
            <option value="">All channels</option>
            {LOG_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
          From (Dhaka date)
          <input type="date" name="from" defaultValue={p.from ?? ''} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
          To (Dhaka date)
          <input type="date" name="to" defaultValue={p.to ?? ''} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
          Text
          <input type="text" name="text" defaultValue={p.text ?? ''} placeholder="Search…" autoComplete="off" spellCheck={false} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
          Request id
          <input type="text" name="requestId" defaultValue={p.requestId ?? ''} autoComplete="off" spellCheck={false} className={`${field} font-mono`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
          User id
          <input type="text" name="userId" defaultValue={p.userId ?? ''} autoComplete="off" spellCheck={false} className={`${field} font-mono`} />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[var(--color-action)] px-4 py-2 text-sm font-medium text-[var(--color-on-action)] transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
        >
          Apply
        </button>
        <Link
          href="/logs"
          className="rounded-lg px-3 py-2 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
        >
          Reset
        </Link>
      </form>

      {lines.length === 0 ? (
        <p className="rounded-lg border border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-muted)]">
          No log lines match these filters.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)]">
          {lines.map((l, i) => (
            <li key={`${l.ts}-${i}`} className="p-3">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded">
                  <span className="whitespace-nowrap font-mono text-xs tabular-nums text-[var(--color-text-muted)]">
                    {l.ts.replace('T', ' ').slice(0, 19)}
                  </span>
                  <Badge variant="info" size="sm">{l.channel}</Badge>
                  <Badge variant={LEVEL_VARIANT[l.level] ?? 'neutral'} size="sm">{l.level}</Badge>
                  <span className="font-mono text-[var(--color-text-primary)]">{l.event}</span>
                  {l.requestId ? (
                    <Link
                      href={`/logs?requestId=${encodeURIComponent(l.requestId)}`}
                      className="font-mono text-xs text-[var(--color-text-muted)] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                    >
                      {l.requestId.slice(0, 8)}
                    </Link>
                  ) : null}
                </summary>
                <pre className="mt-2 max-h-96 overflow-auto rounded bg-[var(--color-bg-secondary)] p-3 text-xs">
                  {JSON.stringify(JSON.parse(l.raw), null, 2)}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      )}

      <nav aria-label="Log pages" className="flex items-center gap-4 text-sm">
        {p.cursor ? (
          <Link href={`/logs?${new URLSearchParams([...nextParams].filter(([k]) => k !== 'cursor'))}`} className="text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded">
            Newest
          </Link>
        ) : null}
        {nextCursor ? (
          <Link href={`/logs?${nextParams}`} className="text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded">
            Older
          </Link>
        ) : null}
      </nav>
    </div>
  )
}
