'use client'

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { useReducedMotion } from 'motion/react'
import dynamic from 'next/dynamic'
import '@vesta/shared/utils/i18n'
import { useLanguage } from '@/lib/use-language'
import { appLocale, type Lang } from '@/lib/language'
import { useHasMounted } from '@/components/motion/useHasMounted'
import { BarChart3 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import type {
  CycleLengthPoint,
  SymptomFrequencyPoint,
  PeriodRegularity,
  FertileWindowPoint,
} from '@/app/queries/insights-queries'
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  hasAnyInsightsData,
  groupInsights,
  formatInsightNumber,
  formatMonthTick,
  summarizeCycleLengths,
  summarizeSymptoms,
  INSIGHTS_CHART_COLORS,
  type InsightKey,
} from '@/lib/insights-data'
import type { ChartType } from './InsightsCharts'

// Recharts loads only when a chart renders (never on the empty state).
function ChartPlaceholder({ height }: { height: number }) {
  return <div aria-hidden="true" className="w-full rounded-2xl bg-[var(--color-bg-secondary)]" style={{ height }} />
}
const CycleLengthTrendChart = dynamic(() => import('./InsightsCharts').then((m) => m.CycleLengthTrendChart), {
  ssr: false,
  loading: () => <ChartPlaceholder height={180} />,
})
const SymptomFrequencyChart = dynamic(() => import('./InsightsCharts').then((m) => m.SymptomFrequencyChart), {
  ssr: false,
  loading: () => <ChartPlaceholder height={160} />,
})

// ─── Types ────────────────────────────────────────────────────────────────────

interface PrismaProfile {
  id: string
  name: string
  goal: string | null
}

export interface InsightsClientProps {
  profiles: PrismaProfile[]
  activeProfileId: string
  cycleLengthTrend: CycleLengthPoint[]
  symptomFrequency: SymptomFrequencyPoint[]
  periodRegularity: PeriodRegularity
  fertileWindowHistory: FertileWindowPoint[]
  goal: string | null
}

type DateRange = '3m' | '6m' | '1y' | 'all'

const RANGE_LABEL_KEYS: Record<DateRange, string> = {
  '3m': 'insights.last3Months',
  '6m': 'insights.last6Months',
  '1y': 'insights.lastYear',
  all: 'insights.allTime',
}

/** Pill toggle: neutral ink when on (the goal accent is kept for primary buttons). */
const TOGGLE_BASE =
  'min-h-9 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-card)] focus-visible:ring-[var(--color-primary)]'
const TOGGLE_ON = 'bg-[var(--color-text-primary)] text-[var(--color-bg-card)]'
const TOGGLE_OFF =
  'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'

// ─── Date range helpers ───────────────────────────────────────────────────────

function cutoffDate(range: DateRange): Date | null {
  if (range === 'all') return null
  const now = new Date()
  if (range === '3m') return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
  if (range === '6m') return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
  // 1y
  return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
}

function filterByDate<T extends { date: string }>(arr: T[], range: DateRange): T[] {
  const cutoff = cutoffDate(range)
  if (!cutoff) return arr
  return arr.filter((p) => new Date(p.date) >= cutoff)
}

function filterFertileByDate(arr: FertileWindowPoint[], range: DateRange): FertileWindowPoint[] {
  const cutoff = cutoffDate(range)
  if (!cutoff) return arr
  return arr.filter((p) => new Date(p.cycleStart) >= cutoff)
}

function filterSymptomByDate(
  arr: SymptomFrequencyPoint[],
  _range: DateRange
): SymptomFrequencyPoint[] {
  // symptomFrequency has no per-item date — we show all, range not applicable
  return arr
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DataTable({
  caption,
  headers,
  rows,
}: {
  caption: string
  headers: string[]
  rows: (string | number)[][]
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ChartSummary({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="text-xs text-[var(--color-text-muted)]">
      {children}
    </p>
  )
}

// ─── Date Range + Chart Type controls ────────────────────────────────────────

function DateRangeControl({
  value,
  onChange,
}: {
  value: DateRange
  onChange: (r: DateRange) => void
}) {
  const { t } = useTranslation()
  const options = (Object.keys(RANGE_LABEL_KEYS) as DateRange[]).map((key) => ({ key, labelKey: RANGE_LABEL_KEYS[key] }))
  return (
    <div className="flex items-center gap-1 flex-wrap" role="group" aria-label={t('insights.dateRange')}>
      {options.map(({ key, labelKey }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          type="button"
          className={`${TOGGLE_BASE} ${value === key ? TOGGLE_ON : TOGGLE_OFF}`}
        >
          {t(labelKey)}
        </button>
      ))}
    </div>
  )
}

function ChartTypeControl({
  value,
  onChange,
}: {
  value: ChartType
  onChange: (c: ChartType) => void
}) {
  const { t } = useTranslation()
  const options: { key: ChartType; labelKey: string }[] = [
    { key: 'line', labelKey: 'insights.lineChart' },
    { key: 'area', labelKey: 'insights.areaChart' },
    { key: 'bar', labelKey: 'insights.barChart' },
  ]
  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('insights.chartType')}>
      {options.map(({ key, labelKey }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          type="button"
          className={`${TOGGLE_BASE} ${value === key ? TOGGLE_ON : TOGGLE_OFF}`}
        >
          {t(labelKey)}
        </button>
      ))}
    </div>
  )
}


// ─── Period Regularity Card ───────────────────────────────────────────────────

function PeriodRegularityCard({ data, lang }: { data: PeriodRegularity; lang: Lang }) {
  const { t } = useTranslation()
  const num = (n: number) => formatInsightNumber(n, lang)
  const daysLabel = t('insights.days')
  const badgeLabel = data.regular ? t('insights.regularityStable') : t('insights.regularityVariable')

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-hidden="true">
        <Card tone="pink" padding="sm" className="px-4 py-4">
          <span className="text-xs font-semibold text-accent-pink">{t('insights.regularityLabel')}</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-display font-extrabold text-4xl tabular-nums leading-none text-[var(--color-text-primary)]">
              {num(data.mean)}
            </span>
            <span className="text-sm text-[var(--color-text-secondary)]">{daysLabel}</span>
          </div>
        </Card>

        <Card tone="lavender" padding="sm" className="px-4 py-4">
          <span className="text-xs font-semibold text-accent-lavender">{t('insights.variationLabel')}</span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-display font-extrabold text-4xl tabular-nums leading-none text-[var(--color-text-primary)]">
              ±{num(data.stdDev)}
            </span>
            <span className="text-sm text-[var(--color-text-secondary)]">{daysLabel}</span>
          </div>
        </Card>

        <Card tone={data.regular ? 'mint' : 'peach'} padding="sm" className="flex items-center px-4 py-4">
          <span
            className={`font-display font-extrabold text-2xl leading-none ${data.regular ? 'text-accent-mint' : 'text-accent-peach'}`}
          >
            {badgeLabel}
          </span>
        </Card>
      </div>
      <p className="sr-only">
        {t('insights.regularitySummary', { mean: num(data.mean), stdDev: num(data.stdDev), status: badgeLabel })}{' '}
        {t('insights.sampleSize', { n: num(data.sampleSize) })}
      </p>
    </div>
  )
}

// ─── Fertile Window History ───────────────────────────────────────────────────

function FertileWindowHistoryList({ data, lang }: { data: FertileWindowPoint[]; lang: Lang }) {
  const { t } = useTranslation()
  const dateFmt = new Intl.DateTimeFormat(appLocale(lang), { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const fmt = (d: string) => dateFmt.format(new Date(`${d.slice(0, 10)}T00:00:00Z`))
  const num = (n: number) => formatInsightNumber(n, lang)
  const daysLabel = t('insights.days')

  // Show at most last 6 cycles
  const visible = data.slice(-6)
  const rows = visible.map((entry, i) => ({
    entry,
    index: visible.length - i,
    span:
      Math.round((new Date(entry.fertileEnd).getTime() - new Date(entry.fertileStart).getTime()) / 86_400_000) + 1,
  }))

  return (
    <div className="flex flex-col gap-2">
      <ChartSummary id="fertile-summary">{t('insights.fertileSummary', { n: num(visible.length) })}</ChartSummary>
      <ul className="flex flex-col gap-2" aria-hidden="true">
        {rows.map(({ entry, index, span }) => (
          <li
            key={entry.cycleStart}
            className="flex items-center gap-3 py-2.5 px-3 rounded-2xl bg-[var(--color-bg-secondary)]"
          >
            <span className="text-xs font-bold text-[var(--color-text-muted)] w-6 tabular-nums shrink-0">{num(index)}</span>
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--color-text-secondary)] font-medium">
                  {fmt(entry.fertileStart)} – {fmt(entry.fertileEnd)}
                </span>
                <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                  {num(span)} {daysLabel}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ backgroundColor: INSIGHTS_CHART_COLORS.fertileWindow, width: `${Math.min(100, (span / 7) * 100)}%` }}
                />
              </div>
            </div>
            <span
              className="text-xs font-bold tabular-nums shrink-0 hidden sm:block"
              style={{ color: 'var(--color-text-primary)' }}
            >
              ⊕ {fmt(entry.ovulationDay)}
            </span>
          </li>
        ))}
      </ul>
      <DataTable
        caption={`${t('insights.fertileWindowHistory')} — ${t('insights.dataTable')}`}
        headers={[t('insights.cycleColumn'), t('insights.fertileColumn'), t('insights.days'), t('insights.ovulationColumn')]}
        rows={rows.map(({ entry, index, span }) => [
          num(index),
          `${fmt(entry.fertileStart)} – ${fmt(entry.fertileEnd)}`,
          num(span),
          fmt(entry.ovulationDay),
        ])}
      />
    </div>
  )
}

// ─── Main InsightsClient ──────────────────────────────────────────────────────

export function InsightsClient({
  profiles,
  activeProfileId,
  cycleLengthTrend,
  symptomFrequency,
  periodRegularity,
  fertileWindowHistory,
}: InsightsClientProps) {
  const { t } = useTranslation()
  const language = useLanguage()
  const hasMounted = useHasMounted()
  const prefersReducedMotion = useReducedMotion()

  // Gate animations: only animate after mount and when user hasn't set prefers-reduced-motion
  const shouldAnimate = hasMounted && !prefersReducedMotion

  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [chartType, setChartType] = useState<ChartType>('line')

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]

  // ── Client-side filtered series ──────────────────────────────────────────
  const filteredCycleLengthTrend = useMemo(
    () => filterByDate(cycleLengthTrend, dateRange),
    [cycleLengthTrend, dateRange]
  )

  const filteredSymptomFrequency = useMemo(
    () => filterSymptomByDate(symptomFrequency, dateRange),
    [symptomFrequency, dateRange]
  )

  const filteredFertileWindowHistory = useMemo(
    () => filterFertileByDate(fertileWindowHistory, dateRange),
    [fertileWindowHistory, dateRange]
  )

  const noData = t('insights.noData')
  const grouped = groupInsights({
    cycleLengthTrend: filteredCycleLengthTrend,
    symptomFrequency: filteredSymptomFrequency,
    periodRegularity,
    fertileWindowHistory: filteredFertileWindowHistory,
  })
  const shows = (k: InsightKey) => grouped.present.includes(k)
  const num = (n: number) => formatInsightNumber(n, language)
  const monthTick = (ymd: string) => formatMonthTick(ymd, language)
  const categoryLabel = (c: string) => t(`symptoms.${c.toLowerCase()}`)
  const cycleStats = summarizeCycleLengths(filteredCycleLengthTrend)
  const symptomStats = summarizeSymptoms(filteredSymptomFrequency)
  const hasData = hasAnyInsightsData({ cycleLengthTrend, symptomFrequency, periodRegularity, fertileWindowHistory })

  return (
    // tabular-nums on Recharts numeric axis ticks (FR-INSIGHTS NFR) — applied
    // to the tick value text so chart axes line up digit-for-digit.
    <PageContainer width="canvas" className="[&_.recharts-cartesian-axis-tick-value]:[font-variant-numeric:tabular-nums]">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <PageHeader
        title={t('insights.title')}
        subtitle={
          activeProfile ? (
            <>
              {t('insights.subtitle').replace(/(…|\.{2,})\s*$/, '')}
              <span aria-hidden="true"> · </span>
              <span className="font-semibold text-[var(--color-text-secondary)]">{activeProfile.name}</span>
            </>
          ) : (
            t('insights.subtitle')
          )
        }
        actions={hasData ? <DateRangeControl value={dateRange} onChange={setDateRange} /> : undefined}
      />

      {!hasData ? (
        <Card tone="panel" padding="lg">
          <div role="status" className="flex flex-col items-center gap-2 py-10 text-center" data-testid="insights-empty">
            <span className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-tint-lavender text-accent-lavender">
              <BarChart3 className="h-7 w-7" aria-hidden="true" />
            </span>
            <p className="text-base font-semibold text-[var(--color-text-primary)]">{t('insights.emptyTitle')}</p>
            <p className="text-sm text-[var(--color-text-muted)] max-w-sm">{noData}</p>
          </div>
        </Card>
      ) : (
        <>
      {/* From 2xl the charts sit two across so wide screens fill; an odd last chart spans the row. */}
      <div className="flex flex-col gap-5 2xl:grid 2xl:grid-cols-2 2xl:items-start 2xl:[&>*:last-child:nth-child(odd)]:col-span-2">
        {/* ── Cycle Length Trend ─────────────────────────────────────────────── */}
        {shows('cycleLengthTrend') && (
          <motion.div
          initial={shouldAnimate ? { opacity: 0, y: 16 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          <Card tone="panel" padding="md">
            <div className="flex flex-col gap-3">
              <SectionHeader
                variant="inline"
                title={t('insights.cycleLengthTrend')}
                subtitle={t(RANGE_LABEL_KEYS[dateRange])}
              />
              <ChartTypeControl value={chartType} onChange={setChartType} />
              {cycleStats && (
                <ChartSummary id="cycle-length-summary">
                  {t('insights.cycleSummary', {
                    n: num(cycleStats.count),
                    shortest: num(cycleStats.shortest),
                    longest: num(cycleStats.longest),
                    latest: num(cycleStats.latest),
                  })}
                </ChartSummary>
              )}
              <CycleLengthTrendChart
                data={filteredCycleLengthTrend}
                chartType={chartType}
                cycleLengthLabel={t('insights.cycleLengthLabel')}
                daysLabel={t('insights.days')}
                animate={shouldAnimate}
                formatDate={monthTick}
                formatNumber={num}
              />
              <DataTable
                caption={`${t('insights.cycleLengthTrend')} — ${t('insights.dataTable')}`}
                headers={[t('insights.dateColumn'), t('insights.cycleLengthLabel')]}
                rows={filteredCycleLengthTrend.map((d) => [monthTick(d.date), num(d.cycleLength)])}
              />
            </div>
          </Card>
        </motion.div>
        )}

        {/* ── Symptom Frequency ──────────────────────────────────────────────── */}
        {shows('symptomFrequency') && (
          <motion.div
          initial={shouldAnimate ? { opacity: 0, y: 16 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.4 }}
        >
          <Card tone="panel" padding="md">
            <div className="flex flex-col gap-3">
              <SectionHeader
                variant="inline"
                title={t('insights.symptomFrequency')}
                subtitle={t('insights.allTime')}
              />
              <ChartSummary id="symptom-range-note">{t('insights.symptomAllTime')}</ChartSummary>
              {symptomStats && (
                <ChartSummary id="symptom-summary">
                  {t('insights.symptomSummary', {
                    top: categoryLabel(symptomStats.top),
                    topCount: num(symptomStats.topCount),
                    total: num(symptomStats.total),
                  })}
                </ChartSummary>
              )}
              <SymptomFrequencyChart
                data={filteredSymptomFrequency}
                countLabel={t('insights.count')}
                categoryLabel={categoryLabel}
                animate={shouldAnimate}
                formatNumber={num}
              />
              <DataTable
                caption={`${t('insights.symptomFrequency')} — ${t('insights.dataTable')}`}
                headers={[t('insights.categoryColumn'), t('insights.count')]}
                rows={filteredSymptomFrequency.map((d) => [categoryLabel(d.category), num(d.count)])}
              />
            </div>
          </Card>
        </motion.div>
        )}

        {/* ── Period Regularity ──────────────────────────────────────────────── */}
        {shows('periodRegularity') && (
          <motion.div
          initial={shouldAnimate ? { opacity: 0, y: 16 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.29, duration: 0.4 }}
        >
          <Card tone="panel" padding="md">
            <div className="flex flex-col gap-3">
              <SectionHeader
                variant="inline"
                title={t('insights.periodRegularity')}
                subtitle={t('insights.sampleSize', { n: num(periodRegularity.sampleSize) })}
              />
              <PeriodRegularityCard data={periodRegularity} lang={language} />
            </div>
          </Card>
        </motion.div>
        )}

        {/* ── Fertile Window History ─────────────────────────────────────────── */}
        {shows('fertileWindowHistory') && (
          <motion.div
          initial={shouldAnimate ? { opacity: 0, y: 16 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36, duration: 0.4 }}
        >
          <Card tone="panel" padding="md">
            <div className="flex flex-col gap-3">
              <SectionHeader
                variant="inline"
                title={t('insights.fertileWindowHistory')}
                subtitle={t(RANGE_LABEL_KEYS[dateRange])}
              />
              <FertileWindowHistoryList data={filteredFertileWindowHistory} lang={language} />
            </div>
          </Card>
        </motion.div>
        )}
      </div>
      {grouped.missing.length > 0 && (
        <p
          role="note"
          data-testid="insights-missing-note"
          className="rounded-panel bg-tint-sky px-5 py-4 text-sm text-[var(--color-text-secondary)]"
        >
          {t('insights.missingNote', { charts: grouped.missing.map((k) => t(`insights.${k}`)).join(', ') })}
        </p>
      )}
        </>
      )}
    </PageContainer>
  )
}
