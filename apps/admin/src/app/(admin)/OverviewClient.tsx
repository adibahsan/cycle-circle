'use client'

import { Users, UserPlus, UserCheck, Activity, Crown, UserMinus, Wallet } from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'
import { ChartPanel } from '@/components/charts/ChartPanelLazy'
import { CsvExportButton } from '@/components/charts/CsvExportButton'
import { DateRangeControl, type DateRangeControlValue } from '@/components/charts/DateRangeControl'
import { CHART_VAR } from '@/lib/chart-palette'
import { formatDhaka } from '@vesta/shared/utils/dhaka-date'
import { toCsv } from '@vesta/shared/utils/csv'
import type { Metric, OverviewMetrics } from '@vesta/shared/server/services'

interface OverviewClientProps {
  generatedAt: string
  metrics: OverviewMetrics
  signupTrend: { date: string; count: number }[]
  maeTrend: { date: string; tier: string; maeDays: number | null; sampleSize: number }[]
  range: DateRangeControlValue
}

const CHANGE_LABEL = 'vs previous period'

const REASONS = [
  { key: 'DAILY_CHECK', label: 'Daily subscription check', note: '' },
  { key: 'BDAPPS_UNSUBSCRIBE', label: 'BDApps unsubscribe', note: '' },
  { key: 'ACCOUNT_DELETED', label: 'Account deleted', note: '' },
  { key: 'ADMIN_REVOKE', label: 'Admin revoke', note: 'not counted in the churn rate' },
] as const

const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const dec = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

function formatNumber(n: number | null) {
  if (n === null) return 'Unavailable'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return int.format(n)
}

const formatPercent = (fraction: number | null) => (fraction === null ? 'Unavailable' : `${dec.format(fraction * 100)}%`)
const formatTaka = (n: number | null) => (n === null ? 'Unavailable' : `৳${int.format(n)}`)
const formatChange = (n: number | null) => (n === null ? '' : `${n > 0 ? '+' : ''}${n}%`)
const shortDate = (d: string) => formatDhaka(d, { month: 'short', day: 'numeric' })

function Card({
  title,
  m,
  icon,
  format = formatNumber,
}: {
  title: string
  m: Metric
  icon: React.ReactNode
  format?: (n: number | null) => string
}) {
  return <StatCard title={title} value={format(m.value)} change={{ value: m.change, label: CHANGE_LABEL }} icon={icon} />
}

export function OverviewClient({ generatedAt, metrics, signupTrend, maeTrend, range }: OverviewClientProps) {
  const { churn, revenue, activeUsers } = metrics

  const maeTiers = [...new Set(maeTrend.map((p) => p.tier))]
  const maeData = [...new Set(maeTrend.map((p) => p.date))].map((date) => {
    const row: Record<string, string | number | null> = { date }
    for (const tier of maeTiers) row[tier] = maeTrend.find((p) => p.date === date && p.tier === tier)?.maeDays ?? null
    return row
  })

  const numbersCsv = () => {
    const row = (name: string, m: Metric) => [name, m.value, m.previous, m.change]
    return toCsv(
      ['Metric', 'This period', 'Previous period', 'Change %'],
      [
        row('Total users', metrics.totalUsers),
        row('New signups', metrics.newSignups),
        row('Average daily active users', activeUsers.average),
        row('Active users on last day', activeUsers.latest),
        row('Pro subscribers', metrics.proSubscribers),
        row('Churned (excl. admin revokes)', churn.churned),
        row('Churn rate (fraction)', churn.rate),
        row('Estimated revenue (taka)', revenue.total),
      ],
    )
  }

  const reasonsCsv = () =>
    toCsv(
      ['Reason', 'This period', 'Previous period', 'Change %', 'In churn rate'],
      REASONS.map((r) => [
        r.label,
        churn.byReason[r.key].value,
        churn.byReason[r.key].previous,
        churn.byReason[r.key].change,
        r.key === 'ADMIN_REVOKE' ? 'no' : 'yes',
      ]),
    )

  return (
    <div className="space-y-8 page-enter">
      <AdminPageHeader
        title="Overview"
        description={
          <>
            Business overview — last updated{' '}
            <time dateTime={generatedAt}>{formatDhaka(generatedAt, { timeStyle: 'medium' })}</time>
          </>
        }
        tags={[adminCacheTags.dashboard, adminCacheTags.analytics]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Every number is compared with the previous {metrics.range.days} days ({shortDate(metrics.previousRange.fromDay)} to{' '}
          {shortDate(metrics.previousRange.toDay)}).
        </p>
        <div className="flex items-center gap-2">
          <CsvExportButton panel="Overview numbers" getCsv={numbersCsv} />
          <DateRangeControl range={range} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Total Users" m={metrics.totalUsers} icon={<Users aria-hidden="true" size={18} />} />
        <Card title="New Signups" m={metrics.newSignups} icon={<UserPlus aria-hidden="true" size={18} />} />
        <Card
          title="Average Daily Active Users"
          m={activeUsers.average}
          format={(n) => (n === null ? 'Unavailable' : dec.format(n))}
          icon={<UserCheck aria-hidden="true" size={18} />}
        />
        <Card title="Active Users on Last Day" m={activeUsers.latest} icon={<Activity aria-hidden="true" size={18} />} />
        <Card title="Pro Subscribers" m={metrics.proSubscribers} icon={<Crown aria-hidden="true" size={18} />} />
        <Card title="Churned Pro Users" m={churn.churned} icon={<UserMinus aria-hidden="true" size={18} />} />
        <Card title="Churn Rate" m={churn.rate} format={formatPercent} icon={<UserMinus aria-hidden="true" size={18} />} />
        <Card
          title="Estimated Revenue"
          m={revenue.total}
          format={formatTaka}
          icon={<Wallet aria-hidden="true" size={18} />}
        />
      </div>

      <p className="text-sm text-[var(--color-text-muted)]">
        Estimated revenue is Pro subscribers each day times the daily equivalent of the Pro price in effect that day. It is an
        estimate, not billed money.
        {revenue.unavailableDays > 0 &&
          ` ${revenue.unavailableDays} of ${metrics.range.days} days have no Pro subscriber count yet and are left out (shown as unavailable, not zero), so the change compares the daily average of the days that have one.`}
        {' '}Active-user history starts on the day recording began.
      </p>

      <section aria-label="Churn by reason" className="glass rounded-2xl border border-[var(--color-border)] p-5 shadow-soft">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-[var(--color-text-primary)]">Churn by reason</h2>
          <CsvExportButton panel="Churn by reason" getCsv={reasonsCsv} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm tabular-nums">
            <caption className="sr-only">Pro users who left, by reason</caption>
            <thead className="text-xs text-[var(--color-text-muted)]">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">Reason</th>
                <th scope="col" className="py-2 pr-4 font-medium">This period</th>
                <th scope="col" className="py-2 pr-4 font-medium">Previous period</th>
                <th scope="col" className="py-2 font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {REASONS.map((r) => {
                const m = churn.byReason[r.key]
                return (
                  <tr key={r.key} className="border-t border-[var(--color-border)]">
                    <th scope="row" className="py-2 pr-4 font-normal">
                      {r.label}
                      {r.note && <span className="ml-2 text-xs text-[var(--color-text-muted)]">({r.note})</span>}
                    </th>
                    <td className="py-2 pr-4">{m.value}</td>
                    <td className="py-2 pr-4">{m.previous}</td>
                    <td className="py-2">{formatChange(m.change) || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          Churn rate is churned users (admin revokes left out) divided by Pro subscribers at the start of the period.
          {churn.rate.value === null && ' It is unavailable here: no Pro count was stored for the day before the period.'}
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartPanel
          title="New Signups"
          data={signupTrend.map((d) => ({ date: d.date, count: d.count }))}
          xKey="date"
          series={[{ key: 'count', label: 'New signups', color: CHART_VAR.primary }]}
          kinds={['area', 'line', 'bar']}
          defaultKind="area"
          height={260}
          emptyLabel="No signups in this period"
        />
        <ChartPanel
          title="Daily Active Users"
          data={activeUsers.series.map((d) => ({ date: d.date, count: d.count }))}
          xKey="date"
          series={[{ key: 'count', label: 'Active users', color: CHART_VAR.secondary }]}
          kinds={['area', 'line', 'bar']}
          defaultKind="area"
          height={260}
          emptyLabel="No active users recorded in this period"
        />
        <ChartPanel
          title="Estimated Revenue (BDT, estimated)"
          data={revenue.series.map((d) => ({ date: d.date, amount: d.amount }))}
          xKey="date"
          series={[{ key: 'amount', label: 'Estimated revenue', color: CHART_VAR.primary }]}
          kinds={['bar', 'line']}
          defaultKind="bar"
          height={260}
          decimals
          emptyLabel="Estimated revenue is unavailable: no daily Pro counts in this period"
        />
        <ChartPanel
          title="Prediction MAE Trend (days)"
          data={maeData}
          xKey="date"
          series={maeTiers.map((tier, i) => ({
            key: tier,
            label: `${tier} MAE`,
            color: i === 0 ? CHART_VAR.secondary : CHART_VAR.low,
          }))}
          kinds={['line', 'bar']}
          defaultKind="line"
          height={260}
          decimals
          emptyLabel="No nightly MAE snapshots in this period."
        />
      </div>
    </div>
  )
}
