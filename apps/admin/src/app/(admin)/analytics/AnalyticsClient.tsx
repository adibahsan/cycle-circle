'use client'

import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { Card } from '@/components/ui/Card'

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

interface AnalyticsClientProps {
  cycleLengths: CycleLength[]
  symptoms: SymptomCategory[]
  predictions: PredictionAccuracy[]
  retention: UserRetention[]
}

// ── Color constants ────────────────────────────────────────────────────────

const PRIMARY = '#E8476C'
const BLUE = '#3B82F6'
const INDIGO = '#6366F1'
const GREEN = '#10B981'
const AMBER = '#F59E0B'
const PURPLE = '#9B7FD4'
const CORAL = '#FF8C6B'

const SYMPTOM_COLORS: Record<string, string> = {
  Physical: PRIMARY,
  Mood: INDIGO,
  Discharge: GREEN,
  Lifestyle: AMBER,
}

// Fallback palette for categories not in the explicit map
const FALLBACK_COLORS = [PRIMARY, INDIGO, GREEN, AMBER, PURPLE, CORAL, BLUE]

const TIER_COLORS: Record<string, string> = {
  HIGH: GREEN,
  MEDIUM: AMBER,
  LOW: PRIMARY,
}

// ── Shared tooltip wrapper ─────────────────────────────────────────────────

function TooltipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass rounded-xl px-3 py-2 shadow-soft border border-[var(--color-border)] text-sm">
      {children}
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────────────────

function SectionHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h2>
      {subtitle && (
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{subtitle}</p>
      )}
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-56 items-center justify-center">
      <p className="text-sm text-[var(--color-text-muted)]">{message}</p>
    </div>
  )
}

// ── 1. Cycle Length Distribution ───────────────────────────────────────────

function CycleLengthTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string | number
}) {
  if (!active || !payload?.length) return null
  return (
    <TooltipBox>
      <p className="font-semibold text-[var(--color-text-primary)]">
        {label}-day cycle
      </p>
      <p className="text-[var(--color-primary)] font-bold">{payload[0].value} users</p>
    </TooltipBox>
  )
}

function CycleLengthChart({ data }: { data: CycleLength[] }) {
  if (!data.length) return <EmptyState message="No cycle data yet." />
  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid
            vertical={false}
            stroke="var(--color-border)"
            strokeDasharray="3 3"
            strokeOpacity={0.6}
          />
          <XAxis
            dataKey="cycleLength"
            tick={{
              fontSize: 11,
              fill: 'var(--color-text-muted)',
              fontFamily: 'var(--font-display)',
            }}
            axisLine={false}
            tickLine={false}
            label={{
              value: 'Days',
              position: 'insideBottomRight',
              offset: -4,
              fontSize: 11,
              fill: 'var(--color-text-muted)',
            }}
          />
          <YAxis
            tick={{
              fontSize: 11,
              fill: 'var(--color-text-muted)',
              fontFamily: 'var(--font-display)',
            }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            content={<CycleLengthTooltip />}
            cursor={{ fill: 'var(--color-border)', fillOpacity: 0.4 }}
          />
          <Bar
            dataKey="count"
            fill={PRIMARY}
            radius={[4, 4, 0, 0]}
            maxBarSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── 2. Symptoms by Category ────────────────────────────────────────────────

function SymptomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { name: string; value: number }[]
}) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <TooltipBox>
      <p className="font-semibold text-[var(--color-text-primary)]">{name}</p>
      <p className="font-bold" style={{ color: SYMPTOM_COLORS[name] ?? PRIMARY }}>
        {value} logs
      </p>
    </TooltipBox>
  )
}

function SymptomsChart({ data }: { data: SymptomCategory[] }) {
  if (!data.length) return <EmptyState message="No symptom data yet." />
  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="category"
            cx="50%"
            cy="45%"
            outerRadius={90}
            innerRadius={44}
            paddingAngle={3}
            strokeWidth={0}
          >
            {data.map((entry, index) => (
              <Cell
                key={entry.category}
                fill={SYMPTOM_COLORS[entry.category] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<SymptomTooltip />} />
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
      </ResponsiveContainer>
    </div>
  )
}

// ── 3. Prediction Accuracy by Tier ─────────────────────────────────────────

function PredictionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number; payload: PredictionAccuracy }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const { count } = payload[0].payload
  return (
    <TooltipBox>
      <p className="font-semibold text-[var(--color-text-primary)]">{label} tier</p>
      <p className="font-bold" style={{ color: TIER_COLORS[label ?? ''] ?? INDIGO }}>
        {(payload[0].value * 100).toFixed(0)}% avg confidence
      </p>
      <p className="text-[var(--color-text-muted)]">{count} predictions</p>
    </TooltipBox>
  )
}

function PredictionChart({ data }: { data: PredictionAccuracy[] }) {
  if (!data.length) return <EmptyState message="No prediction data yet." />
  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid
            vertical={false}
            stroke="var(--color-border)"
            strokeDasharray="3 3"
            strokeOpacity={0.6}
          />
          <XAxis
            dataKey="tier"
            tick={{
              fontSize: 11,
              fill: 'var(--color-text-muted)',
              fontFamily: 'var(--font-display)',
            }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            tick={{
              fontSize: 11,
              fill: 'var(--color-text-muted)',
              fontFamily: 'var(--font-display)',
            }}
            axisLine={false}
            tickLine={false}
            domain={[0, 1]}
          />
          <Tooltip
            content={<PredictionTooltip />}
            cursor={{ fill: 'var(--color-border)', fillOpacity: 0.4 }}
          />
          <Bar
            dataKey="avgConfidence"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          >
            {data.map((entry) => (
              <Cell
                key={entry.tier}
                fill={TIER_COLORS[entry.tier] ?? INDIGO}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Tier summary badges below the chart
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

// ── 4. User Retention ──────────────────────────────────────────────────────

function formatWeek(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function RetentionTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <TooltipBox>
      <p className="font-semibold text-[var(--color-text-primary)] mb-1">
        Week of {label}
      </p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-bold">
          {p.value}{' '}
          <span className="font-normal text-[var(--color-text-muted)]">
            {p.name}
          </span>
        </p>
      ))}
    </TooltipBox>
  )
}

function RetentionChart({ data }: { data: UserRetention[] }) {
  if (!data.length) return <EmptyState message="No retention data yet." />

  const chartData = data.map((d) => ({
    ...d,
    week: formatWeek(d.week),
  }))

  return (
    <div className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={BLUE} stopOpacity={0.2} />
              <stop offset="95%" stopColor={BLUE} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="retainedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={GREEN} stopOpacity={0.2} />
              <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--color-border)"
            strokeDasharray="3 3"
            strokeOpacity={0.6}
          />
          <XAxis
            dataKey="week"
            tick={{
              fontSize: 11,
              fill: 'var(--color-text-muted)',
              fontFamily: 'var(--font-display)',
            }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{
              fontSize: 11,
              fill: 'var(--color-text-muted)',
              fontFamily: 'var(--font-display)',
            }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            content={<RetentionTooltip />}
            cursor={{
              stroke: 'var(--color-border)',
              strokeWidth: 1,
              strokeDasharray: '4 4',
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-display)',
                  textTransform: 'capitalize',
                }}
              >
                {value}
              </span>
            )}
          />
          <Line
            type="monotone"
            dataKey="created"
            name="created"
            stroke={BLUE}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, fill: BLUE, strokeWidth: 2, stroke: '#fff' }}
          />
          <Line
            type="monotone"
            dataKey="retained"
            name="retained"
            stroke={GREEN}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, fill: GREEN, strokeWidth: 2, stroke: '#fff' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function RetentionRates({ data }: { data: UserRetention[] }) {
  if (!data.length) return null
  // Show the most recent 4 weeks
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
}: AnalyticsClientProps) {
  return (
    <div className="space-y-8 page-enter">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Analytics</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Platform health metrics and cycle intelligence insights
        </p>
      </div>

      {/* Charts grid — 2 columns on lg+, single column on mobile */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1 — Cycle Length Distribution */}
        <Card padding="lg">
          <SectionHeader
            title="Cycle Length Distribution"
            subtitle="Number of user profiles per recorded cycle length"
          />
          <CycleLengthChart data={cycleLengths} />
        </Card>

        {/* 2 — Symptoms by Category */}
        <Card padding="lg">
          <SectionHeader
            title="Symptoms by Category"
            subtitle="Total symptom logs grouped by category"
          />
          <SymptomsChart data={symptoms} />
        </Card>

        {/* 3 — Prediction Accuracy by Tier */}
        <Card padding="lg">
          <SectionHeader
            title="Prediction Accuracy by Tier"
            subtitle="Average model confidence per prediction quality tier"
          />
          <PredictionChart data={predictions} />
          <TierBadges data={predictions} />
        </Card>

        {/* 4 — Weekly User Retention */}
        <Card padding="lg">
          <SectionHeader
            title="Weekly User Retention"
            subtitle="Users created vs retained week-over-week (last 8 weeks)"
          />
          <RetentionChart data={retention} />
          <RetentionRates data={retention} />
        </Card>
      </div>
    </div>
  )
}
