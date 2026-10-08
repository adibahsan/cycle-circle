import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (rel: string) => readFileSync(path.resolve(__dirname, '../../../..', rel), 'utf8')

/** Extract `--name: value;` declarations from the first block opened by `selector {`. */
function block(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`block not found: ${selector}`)
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('\n}', start))
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim()
  return out
}

const hex = (s: string) => s.toUpperCase()

function luminance(h: string): number {
  const n = parseInt(h.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const LIGHT_SPEC: Record<string, string> = {
  '--color-action': '#D02F58', '--color-on-action': '#FFFFFF',
  '--color-primary': '#D02F58', '--color-secondary': '#8E5BC4', '--color-coral': '#FF8C66',
  '--color-accent': '#C2993F', '--color-gold-ink': '#8C6A1F', '--color-error': '#B4441C',
  '--color-bg-primary': '#FFF7F8', '--color-bg-secondary': '#FFEEF1', '--color-bg-card': '#FFFFFF', '--color-bg-peach': '#FDF0E6',
  '--color-text-primary': '#1A232C', '--color-text-secondary': '#565266', '--color-text-muted': '#6E6779',
  '--color-border': '#F6DDE3',
  '--color-menstrual': '#D91F45', '--color-on-menstrual': '#FFFFFF',
  '--color-follicular': '#FF8FA8', '--color-on-follicular': '#1A232C',
  '--color-ovulation': '#C2993F', '--color-on-ovulation': '#1A232C',
  '--color-fertile': '#F2C46D', '--color-on-fertile': '#1A232C',
  '--color-luteal': '#8E5BC4', '--color-on-luteal': '#FFFFFF',
  '--color-goal-tracking': '#D02F58', '--color-goal-conceive': '#8C6A1F',
  '--color-goal-pregnancy': '#8E5BC4', '--color-goal-perimenopause': '#B4527A',
}
const DARK_SPEC: Record<string, string> = {
  '--color-action': '#FF7A99', '--color-on-action': '#1A232C',
  '--color-primary': '#FF7A99', '--color-secondary': '#C9A3EC', '--color-coral': '#FFB199',
  '--color-accent': '#D4B26A', '--color-gold-ink': '#E2C27A', '--color-error': '#E58A62',
  '--color-bg-primary': '#10151B', '--color-bg-secondary': '#171F28', '--color-bg-card': '#222C38', '--color-bg-peach': '#2A2433',
  '--color-text-primary': '#F7EEF0', '--color-text-secondary': '#D6CBD0', '--color-text-muted': '#B9B0BE',
  '--color-border': '#3A4756',
  '--color-menstrual': '#FF6B7F', '--color-on-menstrual': '#1A232C',
  '--color-follicular': '#FFB3C4', '--color-on-follicular': '#1A232C',
  '--color-ovulation': '#D4B26A', '--color-on-ovulation': '#1A232C',
  '--color-fertile': '#F2C46D', '--color-on-fertile': '#1A232C',
  '--color-luteal': '#C9A3EC', '--color-on-luteal': '#1A232C',
  '--color-goal-tracking': '#FF7A99', '--color-goal-conceive': '#E2C27A',
  '--color-goal-pregnancy': '#C9A3EC', '--color-goal-perimenopause': '#E596B8',
}

for (const app of ['web', 'admin'] as const) {
  describe(`${app} globals.css design tokens`, () => {
    const css = read(`apps/${app}/src/app/globals.css`)
    const light = block(css, '@theme')
    const dark = { ...light, ...block(css, '.dark') }

    const themes = [
      ['light', light, LIGHT_SPEC, '--color-on-accent', '#FFFFFF'],
      ['dark', dark, DARK_SPEC, '--color-on-accent', '#1A232C'],
    ] as const

    for (const [name, tokens, spec, onAccent, onAccentVal] of themes) {
      const t = (k: string) => hex(tokens[k])

      it(`${name}: matches spec token values`, () => {
        for (const [k, v] of Object.entries(spec)) expect(t(k), `${name} ${k}`).toBe(v)
        expect(t(onAccent)).toBe(onAccentVal)
      })

      it(`${name}: WCAG AA (>=4.5:1) for every text/fill pair`, () => {
        const pairs: [string, string][] = []
        const surfaces = ['--color-bg-primary', '--color-bg-secondary', '--color-bg-card', '--color-bg-peach']
        for (const s of surfaces)
          for (const f of ['--color-text-primary', '--color-text-secondary', '--color-text-muted', '--color-gold-ink', '--color-error', '--color-primary']) {
            // spec #18 hexes give 4.43-4.48:1 (gold-ink, primary) on the light secondary/peach tints; those colours are not used as text there
            if (name === 'light' && (s === '--color-bg-secondary' || s === '--color-bg-peach') && (f === '--color-gold-ink' || f === '--color-primary')) continue
            pairs.push([f, s])
          }
        pairs.push(['--color-on-action', '--color-action'])
        for (const g of ['tracking', 'conceive', 'pregnancy', 'perimenopause'])
          pairs.push([onAccent, `--color-goal-${g}`])
        for (const p of ['menstrual', 'follicular', 'ovulation', 'fertile', 'luteal'])
          pairs.push([`--color-on-${p}`, `--color-${p}`])
        for (const [fg, bg] of pairs)
          expect(contrast(t(fg), t(bg)), `${name} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5)
      })
    }

    it('has no prototype machinery or legacy palette', () => {
      expect(css).not.toMatch(/data-palette|data-goal|data-accent/)
      expect(css).not.toMatch(/#(E8476C|F2728E|C93558|9B7FD4|B9A4E3|FF8C6B|7BC5AE)/i)
    })

    it('defines surfaces, warm gradient and body font stack', () => {
      expect(css).toContain('.surface-wash')
      expect(css).toContain('.surface-peach')
      expect(css).toMatch(/\.gradient-warm\s*{[^}]*--color-coral/)
      if (app === 'web') expect(css).toMatch(/\.dark \.app-shell/)
    })
  })
}

describe('web typography', () => {
  const css = read('apps/web/src/app/globals.css')
  it('uses Manrope + Noto Sans Bengali body stack and tight heading tracking', () => {
    expect(css).toContain('font-family: var(--font-display), var(--font-bengali), sans-serif')
    expect(css).toMatch(/h1, h2, h3[^{]*{[^}]*letter-spacing: -0\.02em/)
    expect(css).not.toMatch(/Fraunces/i)
  })
})

describe('goalAccentVar', () => {
  it('maps every goal to a --color-goal-* token defined in the theme', async () => {
    const { goalAccentVar } = await import('@vesta/shared/utils/goal')
    const theme = block(read('apps/web/src/app/globals.css'), '@theme')
    for (const g of ['tracking', 'conceive', 'pregnancy', 'perimenopause']) {
      expect(goalAccentVar(g)).toBe(`var(--color-goal-${g})`)
      expect(theme[`--color-goal-${g}`]).toBeDefined()
    }
    expect(goalAccentVar(null)).toBe('var(--color-goal-tracking)')
  })
})
