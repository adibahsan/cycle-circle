'use client'

import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'
import { ChartPanel } from '@/components/charts/ChartPanelLazy'
import { DateRangeControl } from '@/components/charts/DateRangeControl'
import { CHART_VAR } from '@/lib/chart-palette'

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
  cohortWeek: string
  size: number
  weeks: { week: number; active: number; rate: number }[]
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
  total: number
  top: { symptomId: string; count: number }[]
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

// ── Tier summary badges (KPI) ──────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  HIGH: CHART_VAR.good,
  MEDIUM: CHART_VAR.mid,
  LOW: CHART_VAR.low,
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
            style={{ background: TIER_COLORS[entry.tier] ?? CHART_VAR.secondary }}
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
  const recent = data.filter((c) => c.weeks.some((w) => w.week === 1)).slice(-4)
  if (!recent.length) return null
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {recent.map((c) => {
        const rate = c.weeks.find((w) => w.week === 1)?.rate ?? 0
        return (
          <div
            key={c.cohortWeek}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 text-center"
          >
            <p className="text-[10px] font-medium text-[var(--color-text-muted)] mb-1">
              {formatWeek(c.cohortWeek)} · {c.size} users
            </p>
            <p
              className="text-lg font-bold tabular-nums"
              style={{ color: rate >= 50 ? CHART_VAR.good : rate >= 25 ? CHART_VAR.mid : CHART_VAR.low }}
            >
              {rate}%
            </p>
            <p className="text-[10px] text-[var(--color-text-muted)]">active in week 1</p>
          </div>
        )
      })}
    </div>
  )
}

function humanizeSymptom(id: string) {
  return id.replace(/[_-]+/g, ' ')
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

  // Pivot cohorts into one curve per cohort: rows are weeks since signup.
  const maxWeek = Math.max(-1, ...retention.flatMap((c) => c.weeks.map((w) => w.week)))
  const retentionSeries = retention.map((c, i) => ({
    key: `c${i}`,
    label: `${formatWeek(c.cohortWeek)} cohort (${c.size})`,
  }))
  const retentionData: Record<string, string | number | null>[] = Array.from(
    { length: maxWeek + 1 },
    (_, k) => {
      const row: Record<string, string | number | null> = { week: `Week ${k}` }
      retention.forEach((c, i) => {
        row[`c${i}`] = c.weeks.find((w) => w.week === k)?.rate ?? null
      })
      return row
    },
  )

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
          series={[{ key: 'count', label: 'Cycles', color: CHART_VAR.low }]}
          kinds={['bar']}
          defaultKind="bar"
          height={240}
          emptyLabel="Not enough logged periods to measure cycles yet."
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
            data={symptomsByPhase.map((d) => ({ phase: d.phase, count: d.total }))}
            xKey="phase"
            series={[{ key: 'count', label: 'Logs', color: CHART_VAR.low }]}
            kinds={['bar', 'pie']}
            defaultKind="bar"
            height={240}
            emptyLabel="No symptom data yet."
          />
          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
            {symptomsByPhase.map((d) => (
              <div key={d.phase}>
                <dt className="font-semibold text-[var(--color-text-secondary)]">{d.phase}</dt>
                <dd className="text-[var(--color-text-muted)]">
                  {d.top.length
                    ? d.top.map((t) => `${humanizeSymptom(t.symptomId)} (${t.count})`).join(', ')
                    : 'No logs'}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            Top symptoms per cycle phase (last 90 days, anchored to each profile&apos;s period history; &quot;all good&quot; excluded).
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
            series={[{ key: 'maeDays', label: 'MAE (days)', color: CHART_VAR.secondary }]}
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
                  style={{ background: CHART_VAR.secondary }}
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
            title="Retention by Signup Cohort"
            data={retentionData}
            xKey="week"
            series={retentionSeries}
            kinds={['line']}
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
        series={[{ key: 'count', label: 'Sign-ups', color: CHART_VAR.secondary }]}
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
