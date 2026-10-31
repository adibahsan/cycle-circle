import type { Metric, OverviewMetrics } from '../server/services/overview-service'
import { toCsv, csvFileName } from './csv'

/**
 * The emailed report: pure (range metrics in, email content and CSV out). The numbers are the
 * Overview's headline numbers, each with its % change against the previous period.
 */

export type ReportKind = 'weekly' | 'monthly'

export interface BuiltReport {
  subject: string
  html: string
  text: string
  /** UTF-8 CSV with BOM, same columns as the Overview's "Overview numbers" export. */
  csv: string
  csvFilename: string
}

const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const dec = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const taka = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type Format = (n: number) => string
const fmtInt: Format = (n) => int.format(n)
const fmtDec: Format = (n) => dec.format(n)
const fmtPercent: Format = (n) => `${(n * 100).toFixed(1)}%`
const fmtTaka: Format = (n) => `Tk ${taka.format(n)}`

function fmtChange(change: number | null): string | null {
  return change === null ? null : `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`
}

interface Row {
  label: string
  value: string
  unavailable: boolean
  /** The % change, or null when it can't be said. */
  change: string | null
  previous: string
}

function row(label: string, m: Metric, format: Format): Row {
  return {
    label,
    value: m.value === null ? 'unavailable' : format(m.value),
    unavailable: m.value === null,
    change: fmtChange(m.change),
    previous: m.previous === null ? 'unavailable' : format(m.previous),
  }
}

function textLine(r: Row): string {
  if (r.unavailable) return `${r.label}: unavailable`
  return `${r.label}: ${r.value} (${r.change ?? 'change n/a'} vs ${r.previous})`
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const REASONS: { key: keyof OverviewMetrics['churn']['byReason']; label: string }[] = [
  { key: 'DAILY_CHECK', label: 'Daily subscription check' },
  { key: 'BDAPPS_UNSUBSCRIBE', label: 'BDApps unsubscribe' },
  { key: 'ADMIN_REVOKE', label: 'Admin revoke (not in churn rate)' },
  { key: 'ACCOUNT_DELETED', label: 'Account deleted' },
]

export function buildReport(input: { kind: ReportKind; metrics: OverviewMetrics; overviewUrl?: string }): BuiltReport {
  const { kind, metrics, overviewUrl } = input
  const { fromDay, toDay } = metrics.range
  const { churn, revenue, activeUsers } = metrics

  const rows: Row[] = [
    row('Total users', metrics.totalUsers, fmtInt),
    row('New signups', metrics.newSignups, fmtInt),
    row('Average daily active users', activeUsers.average, fmtDec),
    row('Pro subscribers', metrics.proSubscribers, fmtInt),
    row('Churned Pro users (excl. admin revokes)', churn.churned, fmtInt),
    row('Churn rate', churn.rate, fmtPercent),
    row('Estimated revenue', revenue.total, fmtTaka),
  ]

  const subject = `Cycle Circle ${kind} report: ${fromDay} to ${toDay}`
  const period = `${fromDay} to ${toDay} (${metrics.range.days} Bangladesh days), compared with ${metrics.previousRange.fromDay} to ${metrics.previousRange.toDay}.`
  const note =
    'Estimated revenue is Pro subscribers each day times the daily equivalent of the Pro price in effect that day. It is an estimate, not billed money.'

  const text = [
    subject,
    period,
    '',
    ...rows.map(textLine),
    '',
    note,
    ...(overviewUrl ? ['', `Open the Overview for this range: ${overviewUrl}`] : []),
    '',
    'The numbers are also attached as a CSV file.',
  ].join('\n')

  const td = 'padding:8px 12px;border-bottom:1px solid #eee'
  const cells = rows
    .map((r) => {
      const change = r.unavailable ? '' : esc(r.change ?? 'n/a')
      const color = r.change === null ? '#6b7280' : r.change.startsWith('-') ? '#b42318' : '#067647'
      return `<tr><td style="${td}">${esc(r.label)}</td><td style="${td};text-align:right;font-weight:600">${esc(r.value)}</td><td style="${td};text-align:right;color:${color}">${change}</td><td style="${td};text-align:right;color:#6b7280">${esc(r.previous)}</td></tr>`
    })
    .join('')

  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1f2937;max-width:640px;margin:0 auto;padding:16px">
<h1 style="font-size:20px;margin:0 0 4px">${esc(subject)}</h1>
<p style="margin:0 0 16px;color:#6b7280">${esc(period)}</p>
<table style="border-collapse:collapse;width:100%;font-size:14px"><thead><tr><th style="text-align:left;padding:8px 12px">Metric</th><th style="text-align:right;padding:8px 12px">This period</th><th style="text-align:right;padding:8px 12px">Change</th><th style="text-align:right;padding:8px 12px">Previous</th></tr></thead><tbody>${cells}</tbody></table>
<p style="font-size:12px;color:#6b7280">${esc(note)}</p>
${overviewUrl ? `<p><a href="${esc(overviewUrl)}">Open the Overview for this range</a></p>` : ''}
<p style="font-size:12px;color:#6b7280">The numbers are also attached as a CSV file.</p>
</body></html>`

  const csvRow = (name: string, m: Metric) => [name, m.value, m.previous, m.change]
  const csv = toCsv(
    ['Metric', 'This period', 'Previous period', 'Change %'],
    [
      csvRow('Total users', metrics.totalUsers),
      csvRow('New signups', metrics.newSignups),
      csvRow('Average daily active users', activeUsers.average),
      csvRow('Active users on last day', activeUsers.latest),
      csvRow('Pro subscribers', metrics.proSubscribers),
      csvRow('Churned (excl. admin revokes)', churn.churned),
      csvRow('Churn rate (fraction)', churn.rate),
      csvRow('Estimated revenue (taka)', revenue.total),
      ...REASONS.map((r) => csvRow(`Churn: ${r.label}`, churn.byReason[r.key])),
    ],
  )

  return { subject, html, text, csv, csvFilename: csvFileName('Overview', `${fromDay}_${toDay}`) }
}
