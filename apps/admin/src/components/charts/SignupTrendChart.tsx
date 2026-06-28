'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { Card } from '@/components/ui/Card'

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: { value: number; payload: { date: string } }[]
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass rounded-xl px-3 py-2 shadow-soft border border-[var(--color-border)]">
      <p className="text-xs font-semibold text-[var(--color-text-primary)]">
        {formatDate(payload[0].payload.date)}
      </p>
      <p className="text-sm font-bold text-[var(--color-primary)]">
        {payload[0].value} new users
      </p>
    </div>
  )
}

export function SignupTrendChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <Card padding="lg">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">New Signups</h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Daily new user registrations — last 30 days
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span className="inline-block h-2 w-8 rounded-full bg-[var(--color-primary)] opacity-70" />
          Users / day
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="signupGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E8476C" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#E8476C" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--color-border)"
              strokeDasharray="3 3"
              strokeOpacity={0.6}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-display)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(val: string, i: number) => (i % 5 === 0 ? formatDate(val) : '')}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)', fontFamily: 'var(--font-display)' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              domain={[0, (dataMax: number) => Math.max(dataMax, 1)]}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{
                stroke: 'var(--color-primary)',
                strokeWidth: 1,
                strokeDasharray: '4 4',
                strokeOpacity: 0.5,
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#E8476C"
              strokeWidth={2}
              fill="url(#signupGradient)"
              dot={false}
              activeDot={{ r: 5, fill: '#E8476C', strokeWidth: 2, stroke: '#fff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
