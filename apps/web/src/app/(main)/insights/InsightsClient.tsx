'use client'

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { useReducedMotion } from 'motion/react'
import dynamic from 'next/dynamic'
import '@vesta/shared/utils/i18n'
import { useLanguage } from '@/lib/use-language'
import type { Lang } from '@/lib/language'
import { useHasMounted } from '@/components/motion/useHasMounted'
import { Card } from '@/components/ui/Card'
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
  insightsLocale,
  summarizeCycleLengths,
  summarizeSymptoms,
  type InsightKey,
} from '@/lib/insights-data'
import type { ChartType } from './InsightsCharts'

// Recharts loads only when a chart renders (never on the empty state).
function ChartPlaceholder({ height }: { height: number }) {
  return <div aria-hidden="true" className="w-full rounded-xl bg-[var(--color-bg-secondary)]" style={{ height }} />
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

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h2>
      {subtitle && (
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>
      )}
    </div>
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
  const options: { key: DateRange; labelKey: string }[] = [
    { key: '3m', labelKey: 'insights.last3Months' },
    { key: '6m', labelKey: 'insights.last6Months' },
    { key: '1y', labelKey: 'insights.lastYear' },
    { key: 'all', labelKey: 'insights.allTime' },
  ]
  return (
    <div className="flex items-center gap-1 flex-wrap" role="group" aria-label={t('insights.dateRange')}>
      {options.map(({ key, labelKey }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--goal-accent)] ${
            value === key
              ? 'bg-[var(--goal-accent)] text-[var(--color-on-accent)]'
              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] border border-[var(--color-border)]'
          }`}
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
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--goal-accent)] ${
            value === key
              ? 'bg-[var(--goal-accent)]/15 text-[var(--goal-accent)] border border-[var(--goal-accent)]/30'
              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] border border-[var(--color-border)]'
          }`}
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
  const badgeColor = data.regular ? 'var(--color-fertile)' : 'var(--color-menstrual)'
  const badgeTextColor = data.regular ? 'var(--color-on-fertile)' : 'var(--color-on-menstrual)'
  const badgeLabel = data.regular ? t('insights.regularityStable') : t('insights.regularityVariable')

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8" aria-hidden="true">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-[var(--color-text-muted)] font-medium">{t('insights.regularityLabel')}</span>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-extrabold tabular-nums leading-none" style={{ color: 'var(--goal-accent)' }}>
              {num(data.mean)}
            </span>
            <span className="text-sm text-[var(--color-text-muted)]">{daysLabel}</span>
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-[var(--color-text-muted)] font-medium">{t('insights.variationLabel')}</span>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-extrabold tabular-nums leading-none" style={{ color: 'var(--color-secondary)' }}>
              ±{num(data.stdDev)}
            </span>
            <span className="text-sm text-[var(--color-text-muted)]">{daysLabel}</span>
          </div>
        </div>

        <div
          className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold self-start sm:self-center"
          style={{ backgroundColor: badgeColor, color: badgeTextColor }}
        >
          {badgeLabel}
        </div>

        <div className="text-xs text-[var(--color-text-muted)] tabular-nums sm:ml-auto">
          {t('insights.sampleSize', { n: num(data.sampleSize) })}
        </div>
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
  const dateFmt = new Intl.DateTimeFormat(insightsLocale(lang), { month: 'short', day: 'numeric', timeZone: 'UTC' })
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
            className="flex items-center gap-3 py-2 px-3 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
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
                  style={{ backgroundColor: 'var(--color-fertile)', width: `${Math.min(100, (span / 7) * 100)}%` }}
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
    <PageContainer className="[&_.recharts-cartesian-axis-tick-value]:[font-variant-numeric:tabular-nums]">
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
      />

      {!hasData ? (
        <Card padding="lg">
          <div role="status" className="flex flex-col items-center gap-2 py-10 text-center" data-testid="insights-empty">
            <p className="text-base font-semibold text-[var(--color-text-primary)]">{t('insights.emptyTitle')}</p>
            <p className="text-sm text-[var(--color-text-muted)] max-w-sm">{noData}</p>
          </div>
        </Card>
      ) : (
        <>
      {/* ── Global controls ───────────────────────────────────────────────── */}
      <motion.div
        initial={shouldAnimate ? { opacity: 0, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[var(--color-text-muted)]">
            {t('insights.dateRange')}
          </span>
          <DateRangeControl value={dateRange} onChange={setDateRange} />
        </div>
      </motion.div>

      {/* ── Cycle Length Trend ─────────────────────────────────────────────── */}
      {shows('cycleLengthTrend') && (
        <motion.div
        initial={shouldAnimate ? { opacity: 0, y: 16 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        <Card padding="md">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <SectionHeader title={t('insights.cycleLengthTrend')} />
              <div className="flex flex-col gap-1 sm:items-end">
                <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                  {t('insights.chartType')}
                </span>
                <ChartTypeControl value={chartType} onChange={setChartType} />
              </div>
            </div>
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
        <Card padding="md">
          <div className="flex flex-col gap-3">
            <SectionHeader title={t('insights.symptomFrequency')} subtitle={t('insights.symptomAllTime')} />
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
        <Card padding="md">
          <div className="flex flex-col gap-3">
            <SectionHeader title={t('insights.periodRegularity')} />
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
        <Card padding="md">
          <div className="flex flex-col gap-3">
            <SectionHeader title={t('insights.fertileWindowHistory')} />
            <FertileWindowHistoryList data={filteredFertileWindowHistory} lang={language} />
          </div>
        </Card>
      </motion.div>
      )}
      {grouped.missing.length > 0 && (
        <p
          role="note"
          data-testid="insights-missing-note"
          className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 text-sm text-[var(--color-text-muted)]"
        >
          {t('insights.missingNote', { charts: grouped.missing.map((k) => t(`insights.${k}`)).join(', ') })}
        </p>
      )}
        </>
      )}
    </PageContainer>
  )
}
