import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  CHART_TOKENS,
  CHART_VAR,
  chartPalette,
  resolveChartColor,
} from '../../../admin/src/lib/chart-palette'

const ADMIN_SRC = path.resolve(__dirname, '../../../admin/src')

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? walk(p) : [p]
  })
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const dist = (a: string, b: string) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]))

describe('admin chart palette', () => {
  it('keeps the spec order and values', () => {
    expect(CHART_TOKENS.map((t) => [t.name, t.fallback])).toEqual([
      ['primary', '#D02F58'],
      ['secondary', '#8E5BC4'],
      ['accent', '#C2993F'],
      ['coral', '#FF8C66'],
      ['slate', '#565266'],
      ['follicular', '#FF8FA8'],
    ])
    expect(chartPalette()).toEqual(CHART_TOKENS.map((t) => t.fallback))
  })

  it('has distinguishable series colours', () => {
    const p = chartPalette()
    for (let i = 0; i < p.length; i++)
      for (let j = i + 1; j < p.length; j++) expect(dist(p[i], p[j])).toBeGreaterThan(50)
  })

  it('maps every token to a variable defined in admin globals.css', () => {
    const css = fs.readFileSync(path.join(ADMIN_SRC, 'app/globals.css'), 'utf8')
    for (const t of CHART_TOKENS) expect(css).toContain(`${t.cssVar}:`)
    expect(css).toContain('--color-bg-card:')
  })

  it('resolves var() to fallbacks and passes literals through', () => {
    expect(resolveChartColor(CHART_VAR.primary)).toBe('#D02F58')
    expect(resolveChartColor(CHART_VAR.surface)).toBe('#FFFFFF')
    expect(resolveChartColor('#123456')).toBe('#123456')
  })
})

describe('admin source has no legacy palette hex', () => {
  const LEGACY = /#(E8476C|F2728E|C93558|9B7FD4|B9A4E3|FF8C6B|7BC5AE|6366F1|10B981|F59E0B|3B82F6)\b/i
  it('is clean', () => {
    const offenders = walk(ADMIN_SRC)
      .filter((f) => /\.(tsx?|css|svg)$/.test(f))
      .filter((f) => LEGACY.test(fs.readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })
})
