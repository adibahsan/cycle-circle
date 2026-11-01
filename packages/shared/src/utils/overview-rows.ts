import type { ChurnReasonValue } from '../server/services/churn-service'
import type { Metric, OverviewMetrics } from '../server/services/overview-service'
import { toCsv } from './csv'

/**
 * What the admin Overview and the emailed report both show, defined once: the churn reasons
 * (labels, order, whether they count in the churn rate) and the "Overview numbers" CSV.
 */

export const OVERVIEW_CHURN_REASONS: readonly { key: ChurnReasonValue; label: string; note: string; inChurnRate: boolean }[] = [
  { key: 'DAILY_CHECK', label: 'Daily subscription check', note: '', inChurnRate: true },
  { key: 'BDAPPS_UNSUBSCRIBE', label: 'BDApps unsubscribe', note: '', inChurnRate: true },
  { key: 'ACCOUNT_DELETED', label: 'Account deleted', note: '', inChurnRate: true },
  { key: 'ADMIN_REVOKE', label: 'Admin revoke', note: 'not counted in the churn rate', inChurnRate: false },
]

export const OVERVIEW_CSV_HEADER = ['Metric', 'This period', 'Previous period', 'Change %']

/** The Overview numbers CSV: one row per headline number, then one per churn reason. */
export function overviewNumbersCsv(metrics: OverviewMetrics): string {
  const { churn, revenue, activeUsers } = metrics
  const row = (name: string, m: Metric) => [name, m.value, m.previous, m.change]
  return toCsv(OVERVIEW_CSV_HEADER, [
    row('Total users', metrics.totalUsers),
    row('New signups', metrics.newSignups),
    row('Average daily active users', activeUsers.average),
    row('Active users on last day', activeUsers.latest),
    row('Pro subscribers', metrics.proSubscribers),
    row('Churned (excl. admin revokes)', churn.churned),
    row('Churn rate (fraction)', churn.rate),
    row('Estimated daily revenue (taka)', revenue.dailyAverage),
    ['Estimated revenue in total (taka)', revenue.total, revenue.previousTotal, null],
    ...OVERVIEW_CHURN_REASONS.map((r) => row(`Churn: ${r.note ? `${r.label} (${r.note})` : r.label}`, churn.byReason[r.key])),
  ])
}
