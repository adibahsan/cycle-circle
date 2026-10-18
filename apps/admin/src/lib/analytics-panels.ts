import type { DateRangeOption } from '@/components/charts/UrlSegmentedControl'

/**
 * Per-panel range and metric config for /analytics. Each panel owns one URL
 * param (see `PANEL_PARAMS`), so changing one panel never moves another.
 */

const DAY_MS = 24 * 60 * 60 * 1000

const R7: DateRangeOption = { value: '7d', label: '7d', days: 7 }
const R30: DateRangeOption = { value: '30d', label: '30d', days: 30 }
const R60: DateRangeOption = { value: '60d', label: '60d', days: 60 }
const R90: DateRangeOption = { value: '90d', label: '90d', days: 90 }
const R1Y: DateRangeOption = { value: '1y', label: '1y', days: 365 }
const ALL: DateRangeOption = { value: 'all', label: 'All', days: 0 }

export interface PanelRangeConfig {
  param: string
  options: DateRangeOption[]
  defaultValue: string
}

export const PANEL_RANGES = {
  cycleLength: { param: 'cyc', options: [R90, R1Y, ALL], defaultValue: 'all' },
  symptoms: { param: 'sym', options: [R30, R90, R1Y, ALL], defaultValue: 'all' },
  phase: { param: 'phase', options: [R30, R90, R1Y], defaultValue: '90d' },
  accuracy: { param: 'acc', options: [R30, R90, R1Y, ALL], defaultValue: 'all' },
  mae: { param: 'mae', options: [R30, R90, R1Y], defaultValue: '90d' },
  retention: { param: 'ret', options: [R30, R60, R90], defaultValue: '60d' },
  trend: { param: 'trend', options: [R7, R30, R90, R1Y], defaultValue: '30d' },
  feedback: { param: 'fb', options: [R7, R30, R90, R1Y], defaultValue: '30d' },
} as const satisfies Record<string, PanelRangeConfig>

export type PanelKey = keyof typeof PANEL_RANGES

export interface MetricConfig<T extends string> {
  param: string
  options: { value: T; label: string }[]
  defaultValue: T
}

export const ACCURACY_METRICS: MetricConfig<'confidence' | 'count'> = {
  param: 'accm',
  options: [
    { value: 'confidence', label: 'Confidence' },
    { value: 'count', label: 'Predictions' },
  ],
  defaultValue: 'confidence',
}

export const TREND_METRICS: MetricConfig<'signups' | 'active' | 'logRate'> = {
  param: 'tm',
  options: [
    { value: 'signups', label: 'Sign-ups' },
    { value: 'active', label: 'Active loggers' },
    { value: 'logRate', label: 'Logging rate' },
  ],
  defaultValue: 'signups',
}

type RawParams = Record<string, string | string[] | undefined>

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

/** Read a panel's selected range from the URL; unknown values fall back to the default. */
export function resolvePanelRange(params: RawParams, panel: PanelKey, now: Date = new Date()) {
  const cfg: PanelRangeConfig = PANEL_RANGES[panel]
  const raw = first(params[cfg.param])
  const option =
    cfg.options.find((o) => o.value === raw) ??
    cfg.options.find((o) => o.value === cfg.defaultValue) ??
    cfg.options[0]
  // Day-aligned end so cache keys stay stable within a UTC day.
  const to = new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS + DAY_MS - 1)
  const days = option.days ?? 0
  const from = days > 0 ? new Date(to.getTime() - days * DAY_MS) : new Date(0)
  return { value: option.value, days, range: { from, to } }
}

/** Read a panel's selected metric from the URL; unknown values fall back to the default. */
export function resolveMetric<T extends string>(params: RawParams, cfg: MetricConfig<T>): T {
  const raw = first(params[cfg.param])
  return cfg.options.find((o) => o.value === raw)?.value ?? cfg.defaultValue
}
