// Client-safe CSV writer shared by every admin export (no server imports).

export type CsvCell = string | number | boolean | Date | null | undefined

const BOM = '﻿'

function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return ''
  let s = value instanceof Date ? value.toISOString() : String(value)
  // Formula-injection guard: only for text, never for real numbers.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Shared CSV writer: UTF-8 BOM (so Excel reads Bengali), RFC 4180 quoting,
 * CRLF row separators, and a leading `'` on cells that would run as formulas.
 */
export function toCsv(header: string[], rows: CsvCell[][]): string {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(','))
  return BOM + lines.join('\r\n')
}

/** CSV of chart rows: the x column, then one column per series (labels as headers). */
export function chartToCsv(
  data: ReadonlyArray<Record<string, CsvCell>>,
  xKey: string,
  xLabel: string,
  series: ReadonlyArray<{ key: string; label: string }>,
): string {
  return toCsv(
    [xLabel, ...series.map((s) => s.label)],
    data.map((row) => [row[xKey], ...series.map((s) => row[s.key])]),
  )
}

/** `<panel-slug>_<range key>.csv`, so a download says which panel and range it holds. */
export function csvFileName(panel: string, rangeKey: string): string {
  const slug = panel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'export'
  return `${slug}_${rangeKey}.csv`
}
