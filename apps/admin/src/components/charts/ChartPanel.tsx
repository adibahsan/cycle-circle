'use client'

import { useState } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { chartToCsv } from '@vesta/shared/utils/csv'
import { CsvExportButton } from './CsvExportButton'
import { CHART_TOKENS, CHART_VAR, useChartColors } from '@/lib/chart-palette'

/** Ordered series palette as var() strings; resolved to concrete colours at render. */
export const CHART_PALETTE = CHART_TOKENS.map((t) => `var(${t.cssVar})`)


// ── Public types ──────────────────────────────────────────────────────────

export type ChartKind = 'bar' | 'line' | 'area' | 'pie'

export interface ChartSeries {
  key: string
  label: string
  color?: string
}

export interface ChartPanelProps {
  title: string
  data: Array<Record<string, string | number | null>>
  xKey: string
  series: ChartSeries[]
  kinds?: ChartKind[]
  defaultKind?: ChartKind
  height?: number
  emptyLabel?: string
  className?: string
  /** Per-panel selectors (range, metric) rendered in the header. */
  controls?: React.ReactNode
  /** Allow fractional y-axis ticks (e.g. MAE in days). Default: integers only. */
  decimals?: boolean
  /** Label of the x column in the CSV export. Default: "Date" for a `date` key, else the key. */
  xLabel?: string
  /** Rows for the CSV when they differ from the plotted rows (e.g. full dates behind short ticks). */
  exportData?: Array<Record<string, string | number | null>>
}

// ── Shared axis tick style (matches AnalyticsClient) ──────────────────────

const TICK_STYLE = {
  fontSize: 11,
  fill: 'var(--color-text-muted)',
  fontFamily: 'var(--font-display)',
} as const

// ── Shared tooltip box ────────────────────────────────────────────────────

function TooltipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass rounded-xl px-3 py-2 shadow-soft border border-[var(--color-border)] text-sm">
      {children}
    </div>
  )
}

// ── Generic tooltip content ───────────────────────────────────────────────

interface GenericTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number | null; color: string }>
  label?: string | number
  series: ChartSeries[]
}

function GenericTooltip({ active, payload, label, series }: GenericTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <TooltipBox>
      <p className="font-semibold text-[var(--color-text-primary)] mb-1">{label}</p>
      {payload.map((p, i) => {
        const seriesItem = series.find((s) => s.key === p.name)
        return (
          <p key={p.name ?? i} style={{ color: p.color }} className="font-bold tabular-nums">
            {p.value ?? '–'}{' '}
            <span className="font-normal text-[var(--color-text-muted)]">
              {seriesItem?.label ?? p.name}
            </span>
          </p>
        )
      })}
    </TooltipBox>
  )
}

// ── Pie tooltip ───────────────────────────────────────────────────────────

interface PieTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number | null; payload: { fill: string } }>
}

function PieTooltip({ active, payload }: PieTooltipProps) {
  if (!active || !payload?.length) return null
  const { name, value, payload: inner } = payload[0]
  return (
    <TooltipBox>
      <p className="font-semibold text-[var(--color-text-primary)]">{name}</p>
      <p className="font-bold tabular-nums" style={{ color: inner?.fill ?? CHART_VAR.primary }}>
        {value ?? '–'}
      </p>
    </TooltipBox>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center" style={{ height: '100%' }}>
      <p className="text-sm text-[var(--color-text-muted)]">{label}</p>
    </div>
  )
}

// ── Chart-kind toggle icons ───────────────────────────────────────────────

const KIND_LABELS: Record<ChartKind, string> = {
  bar: 'Bar',
  line: 'Line',
  area: 'Area',
  pie: 'Pie',
}

// ── Helpers ───────────────────────────────────────────────────────────────

function isDataEmpty(data: ChartPanelProps['data'], series: ChartSeries[]) {
  if (!data.length) return true
  return data.every((row) => series.every((s) => !row[s.key]))
}

function resolveColor(series: ChartSeries, index: number): string {
  return series.color ?? CHART_PALETTE[index % CHART_PALETTE.length]
}

// ── Cartesian chart shared margins ───────────────────────────────────────

const CARTESIAN_MARGIN = { top: 4, right: 4, left: -16, bottom: 0 }

// ── BarChart renderer ─────────────────────────────────────────────────────

function BarRenderer({
  data,
  xKey,
  series,
  decimals = false,
}: {
  data: ChartPanelProps['data']
  xKey: string
  series: ChartSeries[]
  decimals?: boolean
}) {
  const toColor = useChartColors()
  return (
    <BarChart data={data} margin={CARTESIAN_MARGIN}>
      <CartesianGrid
        vertical={false}
        stroke="var(--color-border)"
        strokeDasharray="3 3"
        strokeOpacity={0.6}
      />
      <XAxis dataKey={xKey} tick={TICK_STYLE} axisLine={false} tickLine={false} />
      <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={decimals} />
      <Tooltip
        content={<GenericTooltip series={series} />}
        cursor={{ fill: 'var(--color-border)', fillOpacity: 0.4 }}
      />
      {series.length > 1 && (
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span
              style={{
                fontSize: 12,
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-display)',
              }}
            >
              {series.find((s) => s.key === value)?.label ?? value}
            </span>
          )}
        />
      )}
      {series.map((s, i) => (
        <Bar
          key={s.key}
          dataKey={s.key}
          name={s.label}
          fill={toColor(resolveColor(s, i))}
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      ))}
    </BarChart>
  )
}

// ── LineChart renderer ────────────────────────────────────────────────────

function LineRenderer({
  data,
  xKey,
  series,
  decimals = false,
}: {
  data: ChartPanelProps['data']
  xKey: string
  series: ChartSeries[]
  decimals?: boolean
}) {
  const toColor = useChartColors()
  return (
    <LineChart data={data} margin={CARTESIAN_MARGIN}>
      <CartesianGrid
        vertical={false}
        stroke="var(--color-border)"
        strokeDasharray="3 3"
        strokeOpacity={0.6}
      />
      <XAxis dataKey={xKey} tick={TICK_STYLE} axisLine={false} tickLine={false} />
      <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={decimals} />
      <Tooltip
        content={<GenericTooltip series={series} />}
        cursor={{ stroke: 'var(--color-border)', strokeWidth: 1, strokeDasharray: '4 4' }}
      />
      {series.length > 1 && (
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span
              style={{
                fontSize: 12,
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-display)',
              }}
            >
              {series.find((s) => s.key === value)?.label ?? value}
            </span>
          )}
        />
      )}
      {series.map((s, i) => {
        const color = toColor(resolveColor(s, i))
        return (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, fill: color, strokeWidth: 2, stroke: toColor(CHART_VAR.surface) }}
          />
        )
      })}
    </LineChart>
  )
}

// ── AreaChart renderer ────────────────────────────────────────────────────

function AreaRenderer({
  data,
  xKey,
  series,
  decimals = false,
}: {
  data: ChartPanelProps['data']
  xKey: string
  series: ChartSeries[]
  decimals?: boolean
}) {
  const toColor = useChartColors()
  return (
    <AreaChart data={data} margin={CARTESIAN_MARGIN}>
      <defs>
        {series.map((s, i) => {
          const color = toColor(resolveColor(s, i))
          return (
            <linearGradient key={s.key} id={`areaGrad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          )
        })}
      </defs>
      <CartesianGrid
        vertical={false}
        stroke="var(--color-border)"
        strokeDasharray="3 3"
        strokeOpacity={0.6}
      />
      <XAxis dataKey={xKey} tick={TICK_STYLE} axisLine={false} tickLine={false} />
      <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={decimals} />
      <Tooltip
        content={<GenericTooltip series={series} />}
        cursor={{ stroke: 'var(--color-border)', strokeWidth: 1, strokeDasharray: '4 4' }}
      />
      {series.length > 1 && (
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span
              style={{
                fontSize: 12,
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-display)',
              }}
            >
              {series.find((s) => s.key === value)?.label ?? value}
            </span>
          )}
        />
      )}
      {series.map((s, i) => {
        const color = toColor(resolveColor(s, i))
        return (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={color}
            strokeWidth={2}
            fill={`url(#areaGrad-${s.key})`}
            dot={false}
            activeDot={{ r: 5, fill: color, strokeWidth: 2, stroke: toColor(CHART_VAR.surface) }}
          />
        )
      })}
    </AreaChart>
  )
}

// ── PieChart renderer ─────────────────────────────────────────────────────

function PieRenderer({
  data,
  xKey,
  series,
}: {
  data: ChartPanelProps['data']
  xKey: string
  series: ChartSeries[]
}) {
  const toColor = useChartColors()
  // First series key is the value, xKey is the name
  const valueKey = series[0].key
  return (
    <PieChart>
      <Pie
        data={data as Array<Record<string, string | number>>}
        dataKey={valueKey}
        nameKey={xKey}
        cx="50%"
        cy="45%"
        outerRadius={90}
        innerRadius={44}
        paddingAngle={3}
        strokeWidth={0}
      >
        {data.map((_, index) => (
          <Cell
            key={index}
            fill={toColor(CHART_PALETTE[index % CHART_PALETTE.length])}
          />
        ))}
      </Pie>
      <Tooltip content={<PieTooltip />} />
      <Legend
        iconType="circle"
        iconSize={8}
        formatter={(value) => (
          <span
            style={{
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-display)',
            }}
          >
            {value}
          </span>
        )}
      />
    </PieChart>
  )
}

// ── Text alternative ──────────────────────────────────────────────────────

/** Collapsed data table so every chart has a non-visual equivalent. */
function ChartTable({
  title,
  data,
  xKey,
  series,
}: {
  title: string
  data: ChartPanelProps['data']
  xKey: string
  series: ChartSeries[]
}) {
  if (!data.length) return null
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer rounded font-semibold text-[var(--color-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]">
        View data as table
      </summary>
      <div className="mt-2 max-h-56 overflow-auto overscroll-contain">
        <table className="w-full text-left tabular-nums">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              <th scope="col" className="py-1 pr-3 font-semibold text-[var(--color-text-secondary)]">
                {xKey}
              </th>
              {series.map((s) => (
                <th key={s.key} scope="col" className="py-1 pr-3 font-semibold text-[var(--color-text-secondary)]">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-t border-[var(--color-border)]">
                <th scope="row" className="py-1 pr-3 font-normal text-[var(--color-text-muted)]">
                  {row[xKey]}
                </th>
                {series.map((s) => (
                  <td key={s.key} className="py-1 pr-3 text-[var(--color-text-primary)]">
                    {row[s.key] ?? 'no data'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

// ── ChartPanel ────────────────────────────────────────────────────────────

export function ChartPanel({
  title,
  data,
  xKey,
  series,
  kinds = ['bar', 'line'],
  defaultKind,
  height = 280,
  emptyLabel = 'No data',
  className,
  controls,
  decimals = false,
  xLabel,
  exportData,
}: ChartPanelProps): React.JSX.Element {
  const [activeKind, setActiveKind] = useState<ChartKind>(defaultKind ?? kinds[0])

  const showToggle = kinds.length > 1
  const empty = isDataEmpty(data, series)

  function renderChart() {
    switch (activeKind) {
      case 'bar':
        return <BarRenderer data={data} xKey={xKey} series={series} decimals={decimals} />
      case 'line':
        return <LineRenderer data={data} xKey={xKey} series={series} decimals={decimals} />
      case 'area':
        return <AreaRenderer data={data} xKey={xKey} series={series} decimals={decimals} />
      case 'pie':
        return <PieRenderer data={data} xKey={xKey} series={series} />
    }
  }

  return (
    <Card padding="lg" className={className}>
      {/* Header row */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <h2 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h2>
        <div className="flex shrink-0 items-center gap-2">
        {/* CSV of exactly the rows this chart shows (the page already loaded them for the range) */}
        <CsvExportButton
          panel={title}
          getCsv={() => chartToCsv(exportData ?? data, xKey, xLabel ?? (xKey === 'date' ? 'Date' : xKey), series)}
        />

        {/* Chart-kind toggle — hidden when only one kind is allowed */}
        {showToggle && (
          <div
            role="group"
            aria-label="Chart type"
            className="flex shrink-0 items-center gap-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-0.5"
          >
            {kinds.map((kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={activeKind === kind}
                onClick={() => setActiveKind(kind)}
                className={[
                  'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1',
                  activeKind === kind
                    ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-soft'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
                ].join(' ')}
              >
                {KIND_LABELS[kind]}
              </button>
            ))}
          </div>
        )}
        </div>
      </div>

      {controls && <div className="mb-4 flex flex-wrap items-center gap-2">{controls}</div>}

      {/* Chart body */}
      <div style={{ height }} className="tabular-nums">
        {empty ? (
          <EmptyState label={emptyLabel} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {renderChart() as React.ReactElement}
          </ResponsiveContainer>
        )}
      </div>

      <ChartTable title={title} data={data} xKey={xKey} series={series} />
    </Card>
  )
}
