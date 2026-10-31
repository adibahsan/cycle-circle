/**
 * Metric pickers for /analytics. The date range is not per panel: the whole page shares one
 * range from the URL (`parseDateRange`, `DateRangeControl`).
 */

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

/** Read the selected metric from the URL; unknown values fall back to the default. */
export function resolveMetric<T extends string>(params: RawParams, cfg: MetricConfig<T>): T {
  const raw = first(params[cfg.param])
  return cfg.options.find((o) => o.value === raw)?.value ?? cfg.defaultValue
}
