'use client'

/**
 * Recharts lives only in this module, which InsightsClient loads with next/dynamic,
 * so the chart library is downloaded only when a chart is actually rendered.
 */
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
} from 'recharts'
import type { CycleLengthPoint, SymptomFrequencyPoint } from '@/app/queries/insights-queries'
import { INSIGHTS_CHART_COLORS } from '@/lib/insights-data'

export type ChartType = 'line' | 'bar' | 'area'

// ─── Cycle Length Trend Chart ─────────────────────────────────────────────────

export function CycleLengthTrendChart({
  data,
  chartType,
  cycleLengthLabel,
  daysLabel,
  animate,
  formatDate,
  formatNumber,
}: {
  data: CycleLengthPoint[]
  chartType: ChartType
  cycleLengthLabel: string
  daysLabel: string
  animate: boolean
  formatDate: (ymd: string) => string
  formatNumber: (n: number) => string
}) {
  const color = INSIGHTS_CHART_COLORS.cycleLength

  const sharedProps = {
    data,
    margin: { top: 4, right: 8, left: -8, bottom: 0 },
  }

  const xAxis = (
    <XAxis
      dataKey="date"
      tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
      tickLine={false}
      axisLine={false}
      tickFormatter={(v: string) => formatDate(v)}
    />
  )

  const yAxis = (
    <YAxis
      tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
      tickLine={false}
      axisLine={false}
      tickFormatter={(v: number) => formatNumber(v)}
      width={38}
    />
  )

  const grid = <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />

  const tooltip = (
    <Tooltip
      cursor={
        chartType === 'bar'
          ? { fill: 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)' }
          : { stroke: 'var(--color-border-strong)' }
      }
      contentStyle={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 16,
        fontSize: 12,
        color: 'var(--color-text-primary)',
      }}
      formatter={(v) => [`${typeof v === 'number' ? formatNumber(v) : (v ?? '')} ${daysLabel}`, cycleLengthLabel]}
      labelFormatter={(label) => (typeof label === 'string' ? formatDate(label) : label)}
    />
  )

  return (
    <div className="h-[150px] sm:h-[190px] xl:relative xl:h-auto xl:min-h-[110px] xl:flex-1">
    <div className="h-full xl:absolute xl:inset-0">
    <ResponsiveContainer width="100%" height="100%">
      {chartType === 'line' ? (
        <LineChart {...sharedProps} accessibilityLayer>
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
        <AreaChart {...sharedProps} accessibilityLayer>
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
        <BarChart {...sharedProps} accessibilityLayer>
          {grid}
          {xAxis}
          {yAxis}
          {tooltip}
          <Bar
            dataKey="cycleLength"
            fill={color}
            radius={[6, 6, 0, 0]}
            isAnimationActive={animate}
          />
        </BarChart>
      )}
    </ResponsiveContainer>
    </div>
    </div>
  )
}

// ─── Symptom Frequency Chart ──────────────────────────────────────────────────

export function SymptomFrequencyChart({
  data,
  countLabel,
  categoryLabel,
  animate,
  formatNumber,
}: {
  data: SymptomFrequencyPoint[]
  countLabel: string
  categoryLabel: (category: string) => string
  animate: boolean
  formatNumber: (n: number) => string
}) {
  return (
    <div className="h-[140px] sm:h-[170px] xl:relative xl:h-auto xl:min-h-[110px] xl:flex-1">
    <div className="h-full xl:absolute xl:inset-0">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        accessibilityLayer
        data={data}
        margin={{ top: 4, right: 8, left: -8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="category"
          tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => categoryLabel(v)}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          tickFormatter={(v: number) => formatNumber(v)}
          width={28}
        />
        <Tooltip
          cursor={{ fill: 'color-mix(in srgb, var(--color-text-primary) 8%, transparent)' }}
          contentStyle={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 16,
            fontSize: 12,
            color: 'var(--color-text-primary)',
          }}
          formatter={(v) => [typeof v === 'number' ? formatNumber(v) : (v ?? ''), countLabel]}
          labelFormatter={(label) =>
            typeof label === 'string'
              ? categoryLabel(label)
              : label
          }
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive={animate} fill={INSIGHTS_CHART_COLORS.symptoms} />
      </BarChart>
    </ResponsiveContainer>
    </div>
    </div>
  )
}
