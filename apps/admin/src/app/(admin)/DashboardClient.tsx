'use client'

import dynamic from 'next/dynamic'
import {
  Users,
  UserCheck,
  Crown,
  Activity,
  TrendingUp,
  TrendingDown,
  Target,
} from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'
import { UrlSegmentedControl } from '@/components/charts/UrlSegmentedControl'
import { CHART_VAR } from '@/lib/chart-palette'
import { formatDhaka } from '@vesta/shared/utils/dhaka-date'

const SignupTrendChart = dynamic(
  () => import('@/components/charts/SignupTrendChart').then((m) => m.SignupTrendChart),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[360px] animate-pulse rounded-2xl bg-[var(--color-bg-secondary)]" />
    ),
  },
)

const ChartPanel = dynamic(
  () => import('@/components/charts/ChartPanel').then((m) => m.ChartPanel),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] w-full animate-pulse rounded-xl bg-[var(--color-bg-secondary)]" />
    ),
  },
)

interface DashboardClientProps {
  stats: {
    generatedAt: string
    totalUsers: number
    activeUsers: number
    totalProfiles: number
    proSubscribers: number
    dailyLogs: number
    newUsersThisWeek: number
    userGrowth: number
  }
  mae: {
    tiers: { tier: 'AVERAGE' | 'ARIMA'; maeDays: number | null; sampleSize: number }[]
    computedAt: string | null
  }
  userTrend: { date: string; count: number }[]
  signupTrend: { date: string; count: number }[]
  subscriptionTrend: { date: string; count: number }[]
  range: string
}

function formatDate(dateStr: string) {
  return formatDhaka(dateStr, { month: 'short', day: 'numeric' })
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}


export function DashboardClient({ stats, mae, userTrend, signupTrend, subscriptionTrend, range }: DashboardClientProps) {
  const growthLabel = 'vs last week'
  const growthPositive = stats.userGrowth >= 0

  const chartData = userTrend

  return (
    <div className="space-y-8 page-enter">
      <AdminPageHeader
        title="Dashboard"
        description={
          <>
            Platform overview — last updated{' '}
            <time dateTime={stats.generatedAt}>
              {formatDhaka(stats.generatedAt, { timeStyle: 'medium' })}
            </time>
          </>
        }
        tags={[adminCacheTags.dashboard]}
      />

      {/* Stat cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Users"
          value={formatNumber(stats.totalUsers)}
          change={{ value: stats.userGrowth, label: growthLabel }}
          icon={<Users aria-hidden="true" size={18} />}
        />
        <StatCard
          title="Active Users (30d)"
          value={formatNumber(stats.activeUsers)}
          icon={<UserCheck aria-hidden="true" size={18} />}
        />
        <StatCard
          title="Pro Subscribers"
          value={formatNumber(stats.proSubscribers)}
          icon={<Crown aria-hidden="true" size={18} />}
        />
        <StatCard
          title="Logs Today"
          value={formatNumber(stats.dailyLogs)}
          icon={<Activity aria-hidden="true" size={18} />}
        />
      </div>

      {/* Secondary stat row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass rounded-2xl border border-[var(--color-border)] p-5 flex items-center gap-4 shadow-soft">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-primary)]">
            <Users size={20} aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--color-text-muted)]">Total Profiles</p>
            <p className="text-xl font-bold tabular-nums text-[var(--color-text-primary)]">
              {formatNumber(stats.totalProfiles)}
            </p>
          </div>
        </div>
        <div className="glass rounded-2xl border border-[var(--color-border)] p-5 flex items-center gap-4 shadow-soft">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-primary)]">
            {growthPositive ? <TrendingUp size={20} aria-hidden="true" /> : <TrendingDown size={20} aria-hidden="true" className="text-[var(--color-danger)]" />}
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--color-text-muted)]">New Users This Week</p>
            <p className="text-xl font-bold tabular-nums text-[var(--color-text-primary)]">
              {formatNumber(stats.newUsersThisWeek)}
            </p>
          </div>
        </div>
        <div className="glass rounded-2xl border border-[var(--color-border)] p-5 flex items-center gap-4 shadow-soft">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-bg-secondary)]">
            <span
              className={`text-sm font-bold tabular-nums ${growthPositive ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}
            >
              {growthPositive ? '+' : ''}{stats.userGrowth}%
            </span>
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--color-text-muted)]">Week-over-Week Growth</p>
            <p className={`text-base font-semibold ${growthPositive ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
              {growthPositive ? 'Trending up' : 'Trending down'}
            </p>
          </div>
        </div>
      </div>

      {/* Prediction accuracy */}
      <section
        aria-label="Prediction accuracy"
        className="glass rounded-2xl border border-[var(--color-border)] p-5 shadow-soft"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-bg-secondary)] text-[var(--color-primary)]">
            <Target size={20} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Prediction accuracy</h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              Mean absolute error in days, by prediction tier (lower is better)
            </p>
          </div>
        </div>
        {mae.computedAt ? (
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {mae.tiers.map((t) => (
              <div key={t.tier}>
                <dt className="text-xs font-medium text-[var(--color-text-muted)]">
                  {t.tier === 'AVERAGE' ? 'Average tier' : 'ARIMA tier'}
                </dt>
                <dd className="text-xl font-bold tabular-nums text-[var(--color-text-primary)]">
                  {t.maeDays === null ? 'No data' : `${t.maeDays} d`}
                  {t.maeDays !== null && (
                    <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">
                      n={t.sampleSize}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">No data yet</p>
        )}
      </section>

      {/* User Trend Chart */}
      <SignupTrendChart data={chartData} />

      {/* Trend charts section */}
      <section aria-label="Trend charts">
        {/* Section header: title + date range control */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Trends</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              New users and new subscriptions over time
            </p>
          </div>
          <UrlSegmentedControl />
        </div>

        {/* Two chart panels in a responsive grid */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartPanel
            title="New Users Over Time"
            data={signupTrend.map((d) => ({ date: formatDate(d.date), count: d.count }))}
            xKey="date"
            series={[{ key: 'count', label: 'New users', color: CHART_VAR.primary }]}
            kinds={['area', 'line', 'bar']}
            defaultKind="area"
            height={260}
            emptyLabel={`No signup data for the last ${range}`}
          />
          <ChartPanel
            title="New Subscriptions Over Time"
            data={subscriptionTrend.map((d) => ({ date: formatDate(d.date), count: d.count }))}
            xKey="date"
            series={[{ key: 'count', label: 'New subscriptions', color: CHART_VAR.secondary }]}
            kinds={['area', 'line', 'bar']}
            defaultKind="area"
            height={260}
            emptyLabel={`No subscription data for the last ${range}`}
          />
        </div>
      </section>
    </div>
  )
}
