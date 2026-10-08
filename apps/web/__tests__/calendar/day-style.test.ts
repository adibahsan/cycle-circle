import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { dayStyleKind, DAY_STYLES } from '../../src/lib/calendar-day-style'

const base = { isPeriod: false, isFertile: false, isOvulation: false, isFuturePredicted: false }

describe('dayStyleKind: one visual meaning per state', () => {
  it('logged period is a solid fill', () => {
    expect(dayStyleKind({ ...base, isPeriod: true })).toBe('period')
  })
  it('predicted period is a dashed outline', () => {
    expect(dayStyleKind({ ...base, isPeriod: true, isFuturePredicted: true })).toBe('predictedPeriod')
  })
  it('fertile is a soft tint, even when predicted', () => {
    expect(dayStyleKind({ ...base, isFertile: true })).toBe('fertile')
    expect(dayStyleKind({ ...base, isFertile: true, isFuturePredicted: true })).toBe('fertile')
  })
  it('ovulation is solid gold and wins over fertile', () => {
    expect(dayStyleKind({ ...base, isFertile: true, isOvulation: true })).toBe('ovulation')
  })
  it('a plain day has no style', () => {
    expect(dayStyleKind(base)).toBe('plain')
  })
})

describe('DAY_STYLES', () => {
  it('period is solid menstrual with its on-token text', () => {
    expect(DAY_STYLES.period).toMatchObject({ background: 'var(--color-menstrual)', color: 'var(--color-on-menstrual)', border: 'none' })
  })
  it('predicted period has a dashed menstrual outline and no fill', () => {
    expect(DAY_STYLES.predictedPeriod).toMatchObject({ background: 'transparent', border: '1.5px dashed var(--color-menstrual)', color: 'var(--color-text-primary)' })
  })
  it('fertile tint is mixed over the card surface, has no border, uses normal text', () => {
    expect(DAY_STYLES.fertile.background).toMatch(/color-mix\(in (?:srgb|oklab), var\(--color-fertile\) \d+%, var\(--color-bg-card\)\)/)
    expect(DAY_STYLES.fertile.border).toBe('none')
    expect(DAY_STYLES.fertile.color).toBe('var(--color-text-primary)')
  })
  it('ovulation is solid gold with its on-token text', () => {
    expect(DAY_STYLES.ovulation).toMatchObject({ background: 'var(--color-ovulation)', color: 'var(--color-on-ovulation)', border: 'none' })
  })
  it('no style fades the day with opacity', () => {
    for (const s of Object.values(DAY_STYLES)) expect(s).not.toHaveProperty('opacity')
  })
})

describe('CalendarClient wiring', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../src/app/(main)/calendar/CalendarClient.tsx'), 'utf8')
  it('uses the shared day styles for cells and legend', () => {
    expect(src).toContain("from '@/lib/calendar-day-style'")
    expect(src).toContain('DAY_STYLES')
  })
  it('has no dashed ghost ring or transparent-tint mixes left', () => {
    expect(src).not.toMatch(/in srgb, var\(--color-(fertile|menstrual)\) \d+%, transparent/)
    expect(src).not.toContain('Add log for')
  })
  it('scrolls the detail card into view', () => {
    expect(src).toContain('scrollIntoView')
  })
  it('shows the add plus on hover and focus', () => {
    expect(src).toMatch(/group-hover/)
    expect(src).toMatch(/group-focus-within/)
  })
})

// ── Dark fertile tint: contrast and distinctness (independent oklab/WCAG math) ──
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const gam = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)
function toOklab([r, g, b]: number[]) {
  const [R, G, B] = [r, g, b].map(lin)
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s]
}
function fromOklab([L, a, b]: number[]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map((c) => gam(Math.min(1, Math.max(0, c))))
}
const mix = (fg: number[], pct: number, bg: number[]) => {
  const f = toOklab(fg), b = toOklab(bg)
  return fromOklab(f.map((v, i) => b[i] + (v - b[i]) * (pct / 100)))
}
const lum = (rgb: number[]) => { const [r, g, b] = rgb.map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
const contrast = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

describe('dark fertile tint', () => {
  const pct = Number(/fertile\) (\d+)%/.exec(DAY_STYLES.fertile.background)![1])
  const card = hex('#222C38')
  const tint = mix(hex('#F2C46D'), pct, card)
  it('keeps day numbers at 4.5:1 or better', () => {
    expect(contrast(hex('#F7EEF0'), tint)).toBeGreaterThanOrEqual(4.5)
  })
  it('is warm (red above blue) and distinct from the plain card and from solid ovulation gold', () => {
    expect(tint[0] - tint[2]).toBeGreaterThan(0.08)
    expect(contrast(tint, card)).toBeGreaterThan(1.3)
    expect(contrast(tint, hex('#D4B26A'))).toBeGreaterThan(1.5)
  })
})
