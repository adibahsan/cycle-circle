'use client'

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'motion/react'
import { useReducedMotion } from 'motion/react'
import { TrendingUp } from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import '@vesta/shared/utils/i18n'
import { useAppStore } from '@/lib/store'
import { useHasMounted } from '@/components/motion/useHasMounted'
import { Card } from '@/components/ui/Card'
import type {
  CycleLengthPoint,
  SymptomFrequencyPoint,
  PeriodRegularity,
  FertileWindowPoint,
} from '@/app/queries/insights-queries'

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

type ChartType = 'line' | 'bar' | 'area'
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

// ─── Colour palette ───────────────────────────────────────────────────────────

const SYMPTOM_COLORS: Record<string, string> = {
  PHYSICAL: 'var(--goal-accent)',
  MOOD: 'var(--color-secondary)',
  DISCHARGE: 'var(--color-fertile)',
  LIFESTYLE: 'var(--color-ovulation)',
}

const SYMPTOM_FALLBACK = '#a78bfa'

// ─── Sub-components ───────────────────────────────────────────────────────────

function NoDataMessage({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-sm text-[var(--color-text-muted)]">
      {label}
    </div>
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
              ? 'bg-[var(--goal-accent)] text-white'
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

// ─── Cycle Length Trend Chart ─────────────────────────────────────────────────

function CycleLengthTrendChart({
  data,
  chartType,
  noDataLabel,
  cycleLengthLabel,
  daysLabel,
  animate,
}: {
  data: CycleLengthPoint[]
  chartType: ChartType
  noDataLabel: string
  cycleLengthLabel: string
  daysLabel: string
  animate: boolean
}) {
  if (data.length === 0) return <NoDataMessage label={noDataLabel} />

  const color = 'var(--goal-accent)'

  const sharedProps = {
    data,
    margin: { top: 4, right: 8, left: -8, bottom: 0 },
  }

  const xAxis = (
    <XAxis
      dataKey="date"
      tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
      tickLine={false}
      axisLine={false}
      tickFormatter={(v: string) => {
        const d = new Date(v)
        return `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear().toString().slice(2)}`
      }}
    />
  )

  const yAxis = (
    <YAxis
      tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
      tickLine={false}
      axisLine={false}
      tickFormatter={(v: number) => `${v}${daysLabel}`}
      width={38}
    />
  )

  const grid = <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />

  const tooltip = (
    <Tooltip
      contentStyle={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        fontSize: 12,
        color: 'var(--color-text-primary)',
      }}
      formatter={(v) => [`${v ?? ''} ${daysLabel}`, cycleLengthLabel]}
    />
  )

  return (
    <ResponsiveContainer width="100%" height={180}>
      {chartType === 'line' ? (
        <LineChart {...sharedProps}>
          {grid}
          {xAxis}
          {yAxis}
          {tooltip}
          <Line
            type="monotone"
            dataKey="cycleLength"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3, fill: color, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={animate}
          />
        </LineChart>
      ) : chartType === 'area' ? (
        <AreaChart {...sharedProps}>
          {grid}
          {xAxis}
          {yAxis}
          {tooltip}
          <defs>
            <linearGradient id="clt-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="cycleLength"
            stroke={color}
            strokeWidth={2}
            fill="url(#clt-grad)"
            dot={{ r: 3, fill: color, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={animate}
          />
        </AreaChart>
      ) : (
        <BarChart {...sharedProps}>
          {grid}
          {xAxis}
          {yAxis}
          {tooltip}
          <Bar
            dataKey="cycleLength"
            fill={color}
            radius={[4, 4, 0, 0]}
            isAnimationActive={animate}
          />
        </BarChart>
      )}
    </ResponsiveContainer>
  )
}

// ─── Symptom Frequency Chart ──────────────────────────────────────────────────

function SymptomFrequencyChart({
  data,
  noDataLabel,
  countLabel,
  animate,
}: {
  data: SymptomFrequencyPoint[]
  noDataLabel: string
  countLabel: string
  animate: boolean
}) {
  const total = data.reduce((s, d) => s + d.count, 0)
  if (total === 0) return <NoDataMessage label={noDataLabel} />

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart
        data={data}
        margin={{ top: 4, right: 8, left: -8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="category"
          tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => v.charAt(0) + v.slice(1).toLowerCase()}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={28}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 12,
            fontSize: 12,
            color: 'var(--color-text-primary)',
          }}
          formatter={(v) => [v ?? 0, countLabel]}
          labelFormatter={(label) =>
            typeof label === 'string'
              ? label.charAt(0) + label.slice(1).toLowerCase()
              : label
          }
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={animate} fill="var(--goal-accent)">
          {data.map((entry) => (
            <Cell
              key={entry.category}
              fill="var(--goal-accent)"
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Period Regularity Card ───────────────────────────────────────────────────

function PeriodRegularityCard({
  data,
  noDataLabel,
  meanLabel,
  daysLabel,
  stableLabel,
  variableLabel,
}: {
  data: PeriodRegularity
  noDataLabel: string
  meanLabel: string
  daysLabel: string
  stableLabel: string
  variableLabel: string
}) {
  if (data.sampleSize === 0) return <NoDataMessage label={noDataLabel} />

  const badgeColor = data.regular ? 'var(--color-fertile)' : 'var(--color-menstrual)'
  const badgeLabel = data.regular ? stableLabel : variableLabel

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
      {/* Mean */}
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-[var(--color-text-muted)] font-medium">{meanLabel}</span>
        <div className="flex items-baseline gap-1">
          <span
            className="text-4xl font-extrabold tabular-nums leading-none"
            style={{ color: 'var(--goal-accent)' }}
          >
            {data.mean}
          </span>
          <span className="text-sm text-[var(--color-text-muted)]">{daysLabel}</span>
        </div>
      </div>

      {/* Std Dev */}
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-[var(--color-text-muted)] font-medium">± σ</span>
        <div className="flex items-baseline gap-1">
          <span
            className="text-4xl font-extrabold tabular-nums leading-none"
            style={{ color: 'var(--color-secondary)' }}
          >
            {data.stdDev}
          </span>
          <span className="text-sm text-[var(--color-text-muted)]">{daysLabel}</span>
        </div>
      </div>

      {/* Badge */}
      <div
        className="inline-flex items-center px-3 py-1.5 rounded-full text-white text-xs font-bold self-start sm:self-center"
        style={{ backgroundColor: badgeColor }}
        aria-label={badgeLabel}
      >
        {badgeLabel}
      </div>

      {/* Sample size */}
      <div className="text-xs text-[var(--color-text-muted)] sm:ml-auto">
        n = {data.sampleSize}
      </div>
    </div>
  )
}

// ─── Fertile Window History ───────────────────────────────────────────────────

function FertileWindowHistoryList({
  data,
  noDataLabel,
  language,
}: {
  data: FertileWindowPoint[]
  noDataLabel: string
  language: string
}) {
  if (data.length === 0) return <NoDataMessage label={noDataLabel} />

  const locale = language === 'bn' ? 'bn-BD' : undefined
  const fmt = (d: string) =>
    new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(d))

  // Show at most last 6 cycles
  const visible = data.slice(-6)

  return (
    <div className="flex flex-col gap-2">
      {visible.map((entry, i) => {
        const fertileSpan = Math.round(
          (new Date(entry.fertileEnd).getTime() - new Date(entry.fertileStart).getTime()) /
            86_400_000
        ) + 1
        return (
          <div
            key={entry.cycleStart}
            className="flex items-center gap-3 py-2 px-3 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
          >
            {/* Cycle index */}
            <span className="text-xs font-bold text-[var(--color-text-muted)] w-6 tabular-nums shrink-0">
              {visible.length - i}
            </span>

            {/* Fertile span bar */}
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--color-text-secondary)] font-medium">
                  {fmt(entry.fertileStart)} – {fmt(entry.fertileEnd)}
                </span>
                <span
                  className="text-xs font-bold tabular-nums"
                  style={{ color: 'var(--color-fertile)' }}
                >
                  {fertileSpan}d
                </span>
              </div>
              {/* Visual bar */}
              <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ backgroundColor: 'var(--color-fertile)', width: `${Math.min(100, (fertileSpan / 7) * 100)}%` }}
                />
              </div>
            </div>

            {/* Ovulation day */}
            <span
              className="text-xs font-bold tabular-nums shrink-0 hidden sm:block"
              style={{ color: 'var(--color-ovulation)' }}
            >
              ⊕ {fmt(entry.ovulationDay)}
            </span>
          </div>
        )
      })}
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
  const { language } = useAppStore()
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

  return (
    <div className="flex flex-col gap-5 py-3">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <motion.div
        initial={shouldAnimate ? { opacity: 0, y: 12 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-1 pt-2"
      >
        <div className="flex items-center gap-2">
          <TrendingUp size={20} className="text-[var(--goal-accent)]" aria-hidden="true" />
          <h1 className="text-2xl font-extrabold text-[var(--color-text-primary)]">
            {t('insights.title')}
          </h1>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">{t('insights.subtitle')}</p>
        {activeProfile && (
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {activeProfile.name}
          </p>
        )}
      </motion.div>

      {/* ── Global controls ───────────────────────────────────────────────── */}
      <motion.div
        initial={shouldAnimate ? { opacity: 0, y: 8 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
            {t('insights.dateRange')}
          </span>
          <DateRangeControl value={dateRange} onChange={setDateRange} />
        </div>
      </motion.div>

      {/* ── Cycle Length Trend ─────────────────────────────────────────────── */}
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
                <span className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
                  {t('insights.chartType')}
                </span>
                <ChartTypeControl value={chartType} onChange={setChartType} />
              </div>
            </div>
            <CycleLengthTrendChart
              data={filteredCycleLengthTrend}
              chartType={chartType}
              noDataLabel={noData}
              cycleLengthLabel={t('insights.cycleLengthLabel')}
              daysLabel={t('insights.days')}
              animate={shouldAnimate}
            />
          </div>
        </Card>
      </motion.div>

      {/* ── Symptom Frequency ──────────────────────────────────────────────── */}
      <motion.div
        initial={shouldAnimate ? { opacity: 0, y: 16 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.4 }}
      >
        <Card padding="md">
          <div className="flex flex-col gap-3">
            <SectionHeader title={t('insights.symptomFrequency')} />
            <SymptomFrequencyChart
              data={filteredSymptomFrequency}
              noDataLabel={noData}
              countLabel={t('insights.count')}
              animate={shouldAnimate}
            />
          </div>
        </Card>
      </motion.div>

      {/* ── Period Regularity ──────────────────────────────────────────────── */}
      <motion.div
        initial={shouldAnimate ? { opacity: 0, y: 16 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.29, duration: 0.4 }}
      >
        <Card padding="md">
          <div className="flex flex-col gap-3">
            <SectionHeader title={t('insights.periodRegularity')} />
            <PeriodRegularityCard
              data={periodRegularity}
              noDataLabel={noData}
              meanLabel={t('insights.regularityLabel')}
              daysLabel={t('insights.days')}
              stableLabel={t('insights.regularityStable')}
              variableLabel={t('insights.regularityVariable')}
            />
          </div>
        </Card>
      </motion.div>

      {/* ── Fertile Window History ─────────────────────────────────────────── */}
      <motion.div
        initial={shouldAnimate ? { opacity: 0, y: 16 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.36, duration: 0.4 }}
      >
        <Card padding="md">
          <div className="flex flex-col gap-3">
            <SectionHeader title={t('insights.fertileWindowHistory')} />
            <FertileWindowHistoryList
              data={filteredFertileWindowHistory}
              noDataLabel={noData}
              language={language}
            />
          </div>
        </Card>
      </motion.div>
    </div>
  )
}
