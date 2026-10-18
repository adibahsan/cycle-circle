import { queryLogs, type LogQuery } from './log-reader-service'

/** One plan change (or kept admin override) for a user, read from the translog. */
export interface PlanHistoryEntry {
  ts: string
  event: 'plan.change' | 'plan.override-kept' | 'plan.bdapps-unsubscribe'
  /** Previous / new subscription status; `from` is null for a user's first recorded status. */
  from: string | null
  to: string | null
  /** What triggered it (`admin`, `webhook`, `otp-verify`, ...). */
  cause: string
  /** Set when an admin made the change. */
  adminId?: string
  /** False when a `plan.change` line recorded no actual change. */
  changed: boolean
  /** Set on `plan.bdapps-unsubscribe` lines: the BDApps unsubscribe outcome. */
  unsubscribe?: { result: 'unsubscribed' | 'failed' | 'skipped'; error?: string }
}

const PLAN_EVENTS = new Set(['plan.change', 'plan.override-kept', 'plan.bdapps-unsubscribe'])

/** Plan history for one user from the translog, newest first (GLOSSARY: Translog). */
export async function getPlanHistory(
  userId: string,
  opts: Pick<LogQuery, 'logDir' | 'limit'> = {},
): Promise<PlanHistoryEntry[]> {
  const { lines } = await queryLogs({ channels: ['translog'], userId, limit: opts.limit ?? 200, logDir: opts.logDir })
  const out: PlanHistoryEntry[] = []
  const str = (v: unknown) => (typeof v === 'string' ? v : null)
  for (const l of lines) {
    if (!PLAN_EVENTS.has(l.event)) continue
    const d = (l.data && typeof l.data === 'object' ? l.data : {}) as Record<string, unknown>
    const kept = l.event === 'plan.override-kept'
    if (l.event === 'plan.bdapps-unsubscribe') {
      const result = d.result === 'unsubscribed' || d.result === 'failed' ? d.result : 'skipped'
      out.push({
        ts: l.ts,
        event: 'plan.bdapps-unsubscribe',
        from: null,
        to: null,
        cause: 'admin',
        adminId: str(d.adminId) ?? undefined,
        changed: false,
        unsubscribe: { result, error: str(d.error) ?? undefined },
      })
      continue
    }
    out.push({
      ts: l.ts,
      event: l.event as PlanHistoryEntry['event'],
      from: kept ? str(d.status) : str(d.from),
      to: kept ? str(d.status) : str(d.to),
      cause: str(d.cause) ?? 'unknown',
      adminId: str(d.adminId) ?? undefined,
      changed: kept ? false : d.changed !== false,
    })
  }
  return out
}
