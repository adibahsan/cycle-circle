'use client'

import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'
import { ChartPanel } from '@/components/charts/ChartPanelLazy'
import { DateRangeControl, type DateRangeControlValue } from '@/components/charts/DateRangeControl'
import { CHART_VAR } from '@/lib/chart-palette'
import { formatDhaka } from '@vesta/shared/utils/dhaka-date'

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
  activeUsers: ActiveLoggerPoint[]
  activeLoggers: ActiveLoggerPoint[]
  loggingRate: LoggingRatePoint[]
  streakDistribution: StreakBucket[]
  retention: RetentionPoint[]
  range: DateRangeControlValue
}

// ── Retention rate mini-badges ─────────────────────────────────────────────

function formatWeek(dateStr: string) {
  return formatDhaka(dateStr, { month: 'short', day: 'numeric' })
}

function RetentionRates({ data }: { data: RetentionPoint[] }) {
  if (!data.length) return null
  const recent = data.slice(-4)
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
            style={{ color: d.rate >= 50 ? CHART_VAR.good : d.rate >= 25 ? CHART_VAR.mid : CHART_VAR.low }}
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
  activeUsers,
  activeLoggers,
  loggingRate,
  streakDistribution,
  retention,
  range,
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

      {/* Shared range (?range= or ?from=&to=) drives every panel */}
      <div className="flex justify-end">
        <DateRangeControl range={range} />
      </div>
      <p className="text-sm text-text-secondary">
        Daily Active Users counts users who opened the app; Daily Active Loggers counts profiles that logged a symptom.
        Active-user history starts on the day recording began, so earlier days show zero.
      </p>

      {/* Charts grid — 2 columns on lg+, single column on mobile */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 0 — Daily Active Users (opened the app); history starts when recording began */}
        <ChartPanel
          title="Daily Active Users"
          data={activeUsers.map((d) => ({ ...d } as Record<string, string | number | null>))}
          xKey="date"
          series={[{ key: 'count', label: 'Users', color: CHART_VAR.primary }]}
          kinds={['line', 'area', 'bar']}
          defaultKind="area"
          height={240}
          emptyLabel="No activity recorded for this period."
        />

        {/* 1 — Daily Active Loggers */}
        <ChartPanel
          title="Daily Active Loggers"
          data={activeLoggers.map((d) => ({ ...d } as Record<string, string | number | null>))}
          xKey="date"
          series={[{ key: 'count', label: 'Profiles', color: CHART_VAR.secondary }]}
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
          series={[{ key: 'rate', label: '% of Profiles', color: CHART_VAR.good }]}
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
          series={[{ key: 'count', label: 'Profiles', color: CHART_VAR.mid }]}
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
              { key: 'created', label: 'Cohort Size', color: CHART_VAR.slate },
              { key: 'retained', label: 'Retained', color: CHART_VAR.good },
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
        series={[{ key: 'rate', label: '% Profiles Logging', color: CHART_VAR.low }]}
        kinds={['area', 'line', 'bar']}
        defaultKind="area"
        height={240}
        emptyLabel="No logging rate data for this period."
      />
    </div>
  )
}
