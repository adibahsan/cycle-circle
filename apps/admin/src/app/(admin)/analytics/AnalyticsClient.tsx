'use client'

import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'
import { ChartPanel } from '@/components/charts/ChartPanelLazy'
import { DateRangeControl } from '@/components/charts/DateRangeControl'

// ── Types ──────────────────────────────────────────────────────────────────

interface CycleLength {
  cycleLength: number
  count: number
}

interface SymptomCategory {
  category: string
  count: number
}

interface PredictionAccuracy {
  tier: string
  count: number
  avgConfidence: number
}

interface UserRetention {
  week: string
  created: number
  retained: number
  rate: number
}

interface UserTrendPoint {
  date: string
  count: number
}

interface PredictionMae {
  tier: string
  maeDays: number | null
  sampleSize: number
}

interface FeedbackVolumePoint {
  date: string
  count: number
}

interface FeedbackCategoryPoint {
  category: string
  count: number
}

interface FeedbackRatingPoint {
  rating: number | null
  count: number
}

interface SymptomPhasePoint {
  phase: string
  count: number
}

interface AnalyticsClientProps {
  cycleLengths: CycleLength[]
  symptoms: SymptomCategory[]
  predictions: PredictionAccuracy[]
  retention: UserRetention[]
  trend: UserTrendPoint[]
  range: string
  predictionMae: PredictionMae[]
  feedbackVolume: FeedbackVolumePoint[]
  feedbackCategories: FeedbackCategoryPoint[]
  feedbackRatings: FeedbackRatingPoint[]
  symptomsByPhase: SymptomPhasePoint[]
}

// ── Color constants ────────────────────────────────────────────────────────

const GREEN = '#10B981'
const AMBER = '#F59E0B'
const PRIMARY = '#E8476C'
const INDIGO = '#6366F1'

// ── Tier summary badges (KPI) ──────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  HIGH: GREEN,
  MEDIUM: AMBER,
  LOW: PRIMARY,
}

function TierBadges({ data }: { data: PredictionAccuracy[] }) {
  if (!data.length) return null
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {data.map((entry) => (
        <div
          key={entry.tier}
          className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1"
        >
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ background: TIER_COLORS[entry.tier] ?? INDIGO }}
          />
          <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
            {entry.tier}
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {entry.count} predictions
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Retention rate mini-badges (KPI) ───────────────────────────────────────

function formatWeek(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function RetentionRates({ data }: { data: UserRetention[] }) {
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

export function AnalyticsClient({
  cycleLengths,
  symptoms,
  predictions,
  retention,
  trend,
  predictionMae,
  feedbackVolume,
  feedbackCategories,
  feedbackRatings,
  symptomsByPhase,
}: AnalyticsClientProps) {
  // Normalise cycle-length data for ChartPanel (xKey must be a string)
  const cycleLengthData = cycleLengths.map((d) => ({
    cycleLength: String(d.cycleLength),
    count: d.count,
  }))

  // Normalise retention data: format week dates for display
  const retentionData = retention.map((d) => ({
    ...d,
    week: formatWeek(d.week),
  }))

  // Feedback chart data transformations — mirroring FeedbackClient.tsx
  const feedbackVolumeChartData = feedbackVolume.map((d) => ({
    date: d.date,
    count: d.count,
  }))

  const feedbackCategoryChartData = feedbackCategories.map((d) => ({
    category: d.category,
    count: d.count,
  }))

  const feedbackRatingChartData = feedbackRatings.map((d) => ({
    label: d.rating === null ? 'No rating' : `${d.rating}★`,
    count: d.count,
  }))

  return (
    <div className="space-y-8 page-enter">
      <AdminPageHeader
        title="Analytics"
        description="Platform health metrics and cycle intelligence insights"
        tags={[adminCacheTags.analytics]}
      />

      {/* Date range control — drives the trend panel via ?range= query param */}
      <div className="flex justify-end">
        <DateRangeControl />
      </div>

      {/* Charts grid — 2 columns on lg+, single column on mobile */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1 — Cycle Length Distribution */}
        <ChartPanel
          title="Cycle Length Distribution"
          data={cycleLengthData}
          xKey="cycleLength"
          series={[{ key: 'count', label: 'Users', color: PRIMARY }]}
          kinds={['bar']}
          defaultKind="bar"
          height={240}
          emptyLabel="No cycle data yet."
        />

        {/* 2 — Symptoms by Category */}
        <ChartPanel
          title="Symptoms by Category"
          data={symptoms.map((d) => ({ ...d } as Record<string, string | number | null>))}
          xKey="category"
          series={[{ key: 'count', label: 'Logs' }]}
          kinds={['pie', 'bar']}
          defaultKind="pie"
          height={240}
          emptyLabel="No symptom data yet."
        />

        {/* 2b — Symptoms by Cycle Phase */}
        <div>
          <ChartPanel
            title="Symptom Logs by Cycle Phase"
            data={symptomsByPhase.map((d) => ({ ...d } as Record<string, string | number | null>))}
            xKey="phase"
            series={[{ key: 'count', label: 'Logs', color: PRIMARY }]}
            kinds={['bar', 'pie']}
            defaultKind="bar"
            height={240}
            emptyLabel="No symptom data yet."
          />
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            Symptom-log volume grouped by the cycle phase each log fell in (anchored to each profile&apos;s period history).
          </p>
        </div>

        {/* 3 — Prediction Accuracy by Tier */}
        <div>
          <ChartPanel
            title="Prediction Accuracy by Tier"
            data={predictions.map((d) => ({ ...d, avgConfidence: d.avgConfidence }))}
            xKey="tier"
            series={[{ key: 'avgConfidence', label: 'Avg Confidence' }]}
            kinds={['bar']}
            defaultKind="bar"
            height={240}
            emptyLabel="No prediction data yet."
          />
          <TierBadges data={predictions} />
        </div>

        {/* 3b — Prediction MAE by Tier */}
        <div>
          <ChartPanel
            title="Prediction Accuracy (MAE · days)"
            data={predictionMae.map((d) => ({
              tier: d.tier,
              maeDays: d.maeDays ?? 0,
            }))}
            xKey="tier"
            series={[{ key: 'maeDays', label: 'MAE (days)', color: INDIGO }]}
            kinds={['bar']}
            defaultKind="bar"
            height={240}
            emptyLabel="Not enough period-log history to backtest."
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {predictionMae.map((d) => (
              <div
                key={d.tier}
                className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1"
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: INDIGO }}
                />
                <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  {d.tier}
                </span>
                <span className="text-xs tabular-nums text-[var(--color-text-muted)]">
                  {d.maeDays !== null ? `${d.maeDays}d MAE` : 'no data'} · {d.sampleSize} samples
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            Lower MAE = more accurate predictions. Backtested from all period-log history (global, not range-bound).
          </p>
        </div>

        {/* 4 — User Retention */}
        <div>
          <ChartPanel
            title="Weekly User Retention"
            data={retentionData}
            xKey="week"
            series={[
              { key: 'created', label: 'Created', color: '#3B82F6' },
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

      {/* 5 — User Trend (date-range-driven) — full width */}
      <ChartPanel
        title="New User Sign-ups"
        data={trend.map((d) => ({ ...d } as Record<string, string | number | null>))}
        xKey="date"
        series={[{ key: 'count', label: 'Sign-ups', color: INDIGO }]}
        kinds={['area', 'line', 'bar']}
        defaultKind="area"
        height={240}
        emptyLabel="No sign-up data for this period."
      />

      {/* ── Feedback section ──────────────────────────────────────────────── */}
      <section aria-label="Feedback analytics">
        <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">
          Feedback
        </h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Submission volume over time */}
          <ChartPanel
            title="Feedback Volume"
            data={feedbackVolumeChartData}
            xKey="date"
            series={[{ key: 'count', label: 'Submissions' }]}
            kinds={['area', 'line', 'bar']}
            defaultKind="area"
            height={240}
            emptyLabel="No submissions in this period."
          />

          {/* Category breakdown */}
          <ChartPanel
            title="By Category"
            data={feedbackCategoryChartData}
            xKey="category"
            series={[{ key: 'count', label: 'Count' }]}
            kinds={['bar', 'pie']}
            defaultKind="bar"
            height={240}
            emptyLabel="No category data."
          />

          {/* Rating distribution */}
          <ChartPanel
            title="Rating Distribution"
            data={feedbackRatingChartData}
            xKey="label"
            series={[{ key: 'count', label: 'Count' }]}
            kinds={['bar']}
            defaultKind="bar"
            height={240}
            emptyLabel="No rating data."
          />
        </div>
      </section>
    </div>
  )
}
