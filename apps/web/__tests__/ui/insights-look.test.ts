/**
 * Ticket #80: Insights in the new look.
 * Charts take their colours from the #72 tokens (light + dark), never the goal accent.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { INSIGHTS_CHART_COLORS } from '@/lib/insights-data'

const css = fs.readFileSync(path.resolve(__dirname, '../../src/app/globals.css'), 'utf8')

/** `--name: value;` declarations from the first `selector {` block (flat blocks only). */
function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('\n}', start))
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

function luminance(h: string): number {
  const n = parseInt(h.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const light = block('@theme')
const dark = { ...light, ...block('.dark') }
const tokenOf = (v: string) => v.match(/^var\((--color-[\w-]+)\)$/)?.[1]

describe('insights chart colours', () => {
  const entries = Object.entries(INSIGHTS_CHART_COLORS)

  it('names a colour for every chart series', () => {
    expect(Object.keys(INSIGHTS_CHART_COLORS).sort()).toEqual(['cycleLength', 'fertileWindow', 'symptoms'])
  })

  it('every series is a theme token with its own dark value', () => {
    for (const [series, value] of entries) {
      const token = tokenOf(value)
      expect(token, `${series} uses a --color-* token`).toBeTruthy()
      expect(light[token!], `${series} light ${token}`).toMatch(/^#[0-9A-F]{6}$/i)
      expect(block('.dark')[token!], `${series} dark ${token}`).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })

  it('never uses the goal accent', () => {
    for (const value of Object.values(INSIGHTS_CHART_COLORS)) expect(value).not.toContain('goal')
  })

  for (const [name, tokens] of [['light', light], ['dark', dark]] as const) {
    it(`${name}: every series is visible on the card (3:1, graphical objects)`, () => {
      for (const [series, value] of entries) {
        const fg = tokens[tokenOf(value)!]
        expect(contrast(fg, tokens['--color-bg-card']), `${name} ${series}`).toBeGreaterThanOrEqual(3)
      }
    })
  }
})

describe('insights page look', () => {
  const dir = path.resolve(__dirname, '../../src/app/(main)/insights')
  const files = ['InsightsClient.tsx', 'InsightsCharts.tsx'].map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')])

  it('keeps the goal accent off charts, stats and range toggles', () => {
    for (const [f, src] of files) expect(src, f).not.toContain('--goal-accent')
  })

  it('has no hard-coded colours', () => {
    for (const [f, src] of files) expect(src, f).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/)
  })

  it('uses the shared SectionHeader, not a local copy', () => {
    const [, client] = files[0]
    expect(client).toMatch(/from ['"]@\/components\/ui\/SectionHeader['"]/)
    expect(client).not.toMatch(/function SectionHeader\b/)
  })
})
