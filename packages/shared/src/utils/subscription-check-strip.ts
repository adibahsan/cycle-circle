export type SubscriptionCheckStripState = 'never' | 'ok' | 'failed' | 'skipped'

export interface LastCheckRun {
  startedAt: Date
  status: 'OK' | 'FAILED' | 'SKIPPED'
  error?: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * What the Subscriptions strip says about the latest daily subscription check. Pure: the edge
 * passes `now` (ADR 0009). A skipped run checked nobody, so it is reported as such.
 */
export function describeLastCheck(
  run: LastCheckRun | null,
  now: Date,
): { state: SubscriptionCheckStripState; warning: string | null } {
  if (!run) return { state: 'never', warning: 'The daily subscription check has never run.' }
  if (run.status === 'FAILED') {
    return { state: 'failed', warning: 'The last daily subscription check failed.' }
  }
  if (run.status === 'SKIPPED') {
    return { state: 'skipped', warning: 'The last run was skipped because the job is switched off. No subscribers were checked.' }
  }
  if (now.getTime() - run.startedAt.getTime() > DAY_MS) {
    return { state: 'ok', warning: 'The last daily subscription check ran more than a day ago.' }
  }
  return { state: 'ok', warning: null }
}
