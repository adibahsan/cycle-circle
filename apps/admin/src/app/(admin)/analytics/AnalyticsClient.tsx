'use client'

import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'
import { ChartPanel } from '@/components/charts/ChartPanelLazy'
import { UrlSegmentedControl } from '@/components/charts/UrlSegmentedControl'
import { CHART_VAR } from '@/lib/chart-palette'
import {
  ACCURACY_METRICS,
  PANEL_RANGES,
  TREND_METRICS,
  type MetricConfig,
  type PanelKey,
} from '@/lib/analytics-panels'
import { formatDhaka } from '@vesta/shared/utils/dhaka-date'

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
  value: number
}

interface PredictionMae {
  tier: string
  maeDays: number | null
  sampleSize: number
}

interface PredictionMaeTrendPoint {
  date: string
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
  accuracyMetric: 'confidence' | 'count'
  trendMetric: 'signups' | 'active' | 'logRate'
  predictionMae: PredictionMae[]
  predictionMaeTrend: PredictionMaeTrendPoint[]
  feedbackVolume: FeedbackVolumePoint[]
  feedbackCategories: FeedbackCategoryPoint[]
  feedbackRatings: FeedbackRatingPoint[]
  symptomsByPhase: SymptomPhasePoint[]
}

// ── Per-panel selectors ────────────────────────────────────────────────────

function PanelRange({ panel }: { panel: PanelKey }) {
  const cfg = PANEL_RANGES[panel]
  return (
    <UrlSegmentedControl
      paramKey={cfg.param}
      options={[...cfg.options]}
      defaultValue={cfg.defaultValue}
      label="Date range"
    />
  )
}

function MetricPicker<T extends string>({ cfg, label }: { cfg: MetricConfig<T>; label: string }) {
  return (
    <UrlSegmentedControl
      paramKey={cfg.param}
      options={cfg.options}
      defaultValue={cfg.defaultValue}
      label={label}
    />
  )
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
  return formatDhaka(dateStr, { month: 'short', day: 'numeric' })
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
  accuracyMetric,
  trendMetric,
  predictionMae,
  predictionMaeTrend,
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

  // MAE snapshot history: one row per night, one series per tier; null = tier had no data.
  const maeTiers = [...new Set(predictionMaeTrend.map((p) => p.tier))]
  const maeTrendData: Record<string, string | number | null>[] = [
    ...new Set(predictionMaeTrend.map((p) => p.date)),
  ].map((date) => {
    const row: Record<string, string | number | null> = { date }
    for (const tier of maeTiers) {
      row[tier] = predictionMaeTrend.find((p) => p.date === date && p.tier === tier)?.maeDays ?? null
    }
    return row
  })

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
        tags={[adminCacheTags.analytics, adminCacheTags.feedback]}
      />

      {/* Every panel carries its own range (and metric) selector, each bound to its own URL param. */}
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
          controls={<PanelRange panel="cycleLength" />}
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
          controls={<PanelRange panel="symptoms" />}
          emptyLabel="No symptom data in this period."
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
            controls={<PanelRange panel="phase" />}
            emptyLabel="No symptom data in this period."
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
            Top symptoms per cycle phase (selected range, anchored to each profile&apos;s period history; &quot;all good&quot; excluded).
          </p>
        </div>

        {/* 3 — Prediction Accuracy by Tier */}
        <div>
          <ChartPanel
            title="Prediction Accuracy by Tier"
            data={predictions.map((d) => ({ ...d }))}
            xKey="tier"
            series={
              accuracyMetric === 'count'
                ? [{ key: 'count', label: 'Predictions' }]
                : [{ key: 'avgConfidence', label: 'Avg Confidence' }]
            }
            kinds={['bar', 'pie']}
            defaultKind="bar"
            height={240}
            decimals={accuracyMetric === 'confidence'}
            controls={
              <>
                <PanelRange panel="accuracy" />
                <MetricPicker cfg={ACCURACY_METRICS} label="Metric" />
              </>
            }
            emptyLabel="No prediction data in this period."
          />
          <TierBadges data={predictions} />
        </div>

        {/* 3b — Prediction MAE by Tier */}
        <div>
          <ChartPanel
            title="Prediction Accuracy (MAE · days)"
            data={predictionMae.map((d) => ({
              tier: d.tier,
              maeDays: d.maeDays,
            }))}
            xKey="tier"
            series={[{ key: 'maeDays', label: 'MAE (days)', color: CHART_VAR.secondary }]}
            kinds={['bar']}
            defaultKind="bar"
            height={240}
            decimals
            emptyLabel="No data: not enough period-log history to backtest."
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
            Lower MAE = more accurate predictions. Latest nightly snapshot, backtested from all period-log history (the range below applies to the trend only).
          </p>
        </div>

        {/* 3c — MAE snapshot trend */}
        <ChartPanel
          title="Prediction MAE Trend (days)"
          data={maeTrendData}
          xKey="date"
          series={maeTiers.map((tier, i) => ({
            key: tier,
            label: `${tier} MAE`,
            color: i === 0 ? CHART_VAR.secondary : CHART_VAR.low,
          }))}
          kinds={['line', 'bar']}
          defaultKind="line"
          height={240}
          decimals
          controls={<PanelRange panel="mae" />}
          emptyLabel="No data: no nightly MAE snapshots in this period."
        />

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
            controls={<PanelRange panel="retention" />}
            emptyLabel="No retention data in this period."
          />
          <RetentionRates data={retention} />
        </div>
      </div>

      {/* 5 — User activity trend (range + metric) — full width */}
      <ChartPanel
        title="User Activity Trend"
        data={trend.map((d) => ({ ...d } as Record<string, string | number | null>))}
        xKey="date"
        series={[
          {
            key: 'value',
            label: TREND_METRICS.options.find((o) => o.value === trendMetric)?.label ?? 'Value',
            color: CHART_VAR.secondary,
          },
        ]}
        kinds={['area', 'line', 'bar']}
        defaultKind="area"
        height={240}
        decimals={trendMetric === 'logRate'}
        controls={
          <>
            <PanelRange panel="trend" />
            <MetricPicker cfg={TREND_METRICS} label="Metric" />
          </>
        }
        emptyLabel="No activity data for this period."
      />

      {/* ── Feedback section ──────────────────────────────────────────────── */}
      <section aria-label="Feedback analytics">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
            Feedback
          </h2>
          <PanelRange panel="feedback" />
        </div>
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
