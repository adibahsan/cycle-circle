'use client'

import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'
import { ChartPanel } from '@/components/charts/ChartPanelLazy'
import { DateRangeControl } from '@/components/charts/DateRangeControl'

// ── Types ──────────────────────────────────────────────────────────────────

interface ActiveLoggerPoint {
  date: string
  count: number
}

interface LoggingRatePoint {
  date: string
  rate: number
}

interface StreakBucket {
  bucket: string
  count: number
}

interface RetentionPoint {
  week: string
  created: number
  retained: number
  rate: number
}

interface EngagementClientProps {
  activeLoggers: ActiveLoggerPoint[]
  loggingRate: LoggingRatePoint[]
  streakDistribution: StreakBucket[]
  retention: RetentionPoint[]
  range: string
}

// ── Color constants ────────────────────────────────────────────────────────

const GREEN  = '#10B981'
const AMBER  = '#F59E0B'
const PRIMARY = '#E8476C'
const INDIGO  = '#6366F1'

// ── Retention rate mini-badges ─────────────────────────────────────────────

function formatWeek(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function RetentionRates({ data }: { data: RetentionPoint[] }) {
  if (!data.length) return null
  const recent = data.slice(-4)
  return (
    <div className="mt-4 grid grid-cols-4 gap-3">
      {recent.map((d) => (
        <div
          key={d.week}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 text-center"
        >
          <p className="text-[10px] font-medium text-[var(--color-text-muted)] mb-1">
            {formatWeek(d.week)}
          </p>
          <p
            className="text-lg font-bold tabular-nums"
            style={{ color: d.rate >= 50 ? GREEN : d.rate >= 25 ? AMBER : PRIMARY }}
          >
            {d.rate}%
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)]">retained</p>
        </div>
      ))}
    </div>
  )
}

// ── Root component ─────────────────────────────────────────────────────────

export function EngagementClient({
  activeLoggers,
  loggingRate,
  streakDistribution,
  retention,
}: EngagementClientProps) {
  const retentionData = retention.map((d) => ({
    ...d,
    week: formatWeek(d.week),
  }))

  // Convert rate (0..1) to percentage for display
  const loggingRatePct = loggingRate.map((d) => ({
    date: d.date,
    rate: Math.round(d.rate * 100),
  }))

  return (
    <div className="space-y-8 page-enter">
      <AdminPageHeader
        title="Engagement"
        description="Logging activity, streak distribution, and cohort retention"
        tags={[adminCacheTags.analytics]}
      />

      {/* Date range control — drives time-series panels via ?range= query param */}
      <div className="flex justify-end">
        <DateRangeControl />
      </div>

      {/* Charts grid — 2 columns on lg+, single column on mobile */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1 — Daily Active Loggers */}
        <ChartPanel
          title="Daily Active Loggers"
          data={activeLoggers.map((d) => ({ ...d } as Record<string, string | number | null>))}
          xKey="date"
          series={[{ key: 'count', label: 'Profiles', color: INDIGO }]}
          kinds={['line', 'area', 'bar']}
          defaultKind="area"
          height={240}
          emptyLabel="No logging data for this period."
        />

        {/* 2 — Symptom Logging Rate (%) */}
        <ChartPanel
          title="Symptom Logging Rate"
          data={loggingRatePct.map((d) => ({ ...d } as Record<string, string | number | null>))}
          xKey="date"
          series={[{ key: 'rate', label: '% of Profiles', color: GREEN }]}
          kinds={['line', 'area']}
          defaultKind="line"
          height={240}
          emptyLabel="No rate data for this period."
        />

        {/* 3 — Streak Distribution */}
        <ChartPanel
          title="Logging Streak Distribution"
          data={streakDistribution.map((d) => ({ ...d } as Record<string, string | number | null>))}
          xKey="bucket"
          series={[{ key: 'count', label: 'Profiles', color: AMBER }]}
          kinds={['bar']}
          defaultKind="bar"
          height={240}
          emptyLabel="No streak data yet."
        />

        {/* 4 — Logging Retention */}
        <div>
          <ChartPanel
            title="Weekly Logging Retention"
            data={retentionData}
            xKey="week"
            series={[
              { key: 'created', label: 'Cohort Size', color: '#3B82F6' },
              { key: 'retained', label: 'Retained', color: GREEN },
            ]}
            kinds={['line', 'area', 'bar']}
            defaultKind="line"
            height={240}
            emptyLabel="No retention data yet."
          />
          <RetentionRates data={retention} />
        </div>
      </div>

      {/* 5 — Full-width: Daily Active Loggers trend (same data, area view for overview) */}
      <ChartPanel
        title="Logging Rate Over Time"
        data={loggingRatePct.map((d) => ({ ...d } as Record<string, string | number | null>))}
        xKey="date"
        series={[{ key: 'rate', label: '% Profiles Logging', color: PRIMARY }]}
        kinds={['area', 'line', 'bar']}
        defaultKind="area"
        height={240}
        emptyLabel="No logging rate data for this period."
      />
    </div>
  )
}
