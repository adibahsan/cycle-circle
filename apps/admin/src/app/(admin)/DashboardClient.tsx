'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import {
  Users,
  UserCheck,
  Crown,
  Activity,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { Card } from '@/components/ui/Card'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'

interface DashboardClientProps {
  stats: {
    totalUsers: number
    activeUsers: number
    totalProfiles: number
    proSubscribers: number
    dailyLogs: number
    newUsersThisWeek: number
    userGrowth: number
  }
  userTrend: { date: string; count: number }[]
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

// Custom tooltip for the chart
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-xl px-3 py-2 shadow-soft border border-[var(--color-border)]">
      <p className="text-xs font-semibold text-[var(--color-text-primary)]">{formatDate(label ?? '')}</p>
      <p className="text-sm font-bold text-[var(--color-primary)]">
        {payload[0].value} new users
      </p>
    </div>
  )
}

export function DashboardClient({ stats, userTrend }: DashboardClientProps) {
  const growthLabel = 'vs last week'
  const growthPositive = stats.userGrowth >= 0

  // Thin out x-axis labels to avoid overlap (show every 5th)
  const chartData = userTrend.map((d, i) => ({
    ...d,
    displayDate: i % 5 === 0 ? formatDate(d.date) : '',
  }))

  return (
    <div className="space-y-8 page-enter">
      <AdminPageHeader
        title="Dashboard"
        description="Platform overview — last updated just now"
        tags={[adminCacheTags.dashboard]}
      />

      {/* Stat cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Users"
          value={formatNumber(stats.totalUsers)}
          change={{ value: stats.userGrowth, label: growthLabel }}
          icon={<Users size={18} />}
        />
        <StatCard
          title="Active Users (30d)"
          value={formatNumber(stats.activeUsers)}
          icon={<UserCheck size={18} />}
        />
        <StatCard
          title="Pro Subscribers"
          value={formatNumber(stats.proSubscribers)}
          icon={<Crown size={18} />}
        />
        <StatCard
          title="Logs Today"
          value={formatNumber(stats.dailyLogs)}
          icon={<Activity size={18} />}
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
            {growthPositive ? <TrendingUp size={20} aria-hidden="true" /> : <TrendingDown size={20} aria-hidden="true" className="text-red-500" />}
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
              className={`text-sm font-bold tabular-nums ${growthPositive ? 'text-emerald-600' : 'text-red-500'}`}
            >
              {growthPositive ? '+' : ''}{stats.userGrowth}%
            </span>
          </div>
          <div>
            <p className="text-xs font-medium text-[var(--color-text-muted)]">Week-over-Week Growth</p>
            <p className={`text-base font-semibold ${growthPositive ? 'text-emerald-600' : 'text-red-500'}`}>
              {growthPositive ? 'Trending up' : 'Trending down'}
            </p>
          </div>
        </div>
      </div>

      {/* User Trend Chart */}
      <Card padding="lg">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">New Signups</h2>
            <p className="text-sm text-[var(--color-text-muted)]">Daily new user registrations — last 30 days</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span className="inline-block h-2 w-8 rounded-full bg-[var(--color-primary)] opacity-70" />
            Users / day
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="signupGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E8476C" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#E8476C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="var(--color-border)"
                strokeDasharray="3 3"
                strokeOpacity={0.6}
              />
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 11, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-display)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-display)' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ stroke: 'var(--color-primary)', strokeWidth: 1, strokeDasharray: '4 4', strokeOpacity: 0.5 }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#E8476C"
                strokeWidth={2}
                fill="url(#signupGradient)"
                dot={false}
                activeDot={{ r: 5, fill: '#E8476C', strokeWidth: 2, stroke: '#fff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}
