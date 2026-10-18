import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8')
const DASH_DIR = 'src/app/(main)/dashboard'
const dashFiles = readdirSync(resolve(__dirname, '../..', DASH_DIR), { recursive: true })
  .map(String)
  .filter((f) => f.endsWith('.tsx'))
const dash = read(`${DASH_DIR}/DashboardClient.tsx`)
/** Every dashboard component's source, joined: the page is split across files. */
const allDash = dashFiles.map((f) => read(`${DASH_DIR}/${f}`)).join('\n')
const count = (s: string, needle: string) => s.split(needle).length - 1
const css = read('src/app/globals.css')

function token(scope: 'light' | 'dark', name: string): string {
  const start = scope === 'light' ? 0 : css.indexOf('.dark {')
  const m = css.slice(start).match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`))
  if (!m) throw new Error(`token ${name} not found for ${scope}`)
  return m[1]
}
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const lum = (h: string) => {
  const [r, g, b] = rgb(h).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const mix = (fg: string, bg: string, pct: number) => {
  const f = rgb(fg)
  const b = rgb(bg)
  return '#' + f.map((v, i) => Math.round(v * pct + b[i] * (1 - pct)).toString(16).padStart(2, '0')).join('')
}

describe('Cycle Overview label contrast', () => {
  const phases = ['menstrual', 'follicular', 'ovulation', 'luteal']
  for (const scope of ['light', 'dark'] as const) {
    for (const ph of phases) {
      it(`${scope}: label and day text pass 4.5:1 on the ${ph} tint`, () => {
        const tint = mix(token(scope, `--color-${ph}`), token(scope, '--color-bg-card'), 0.13)
        expect(ratio(token(scope, '--color-text-primary'), tint)).toBeGreaterThanOrEqual(4.5)
        expect(ratio(token(scope, '--color-text-secondary'), tint)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
  it('journey labels use neutral text; the phase colour is not applied to label text', () => {
    expect(read(`${DASH_DIR}/CycleJourney.tsx`)).not.toMatch(/style=\{\{\s*color/)
  })
})

describe('dashboard layout sources', () => {
  it('cards take a tone, not an inline background override', () => {
    expect(allDash).not.toMatch(/<Card[^>]*backgroundColor/)
  })
  it('no text under 11px', () => {
    expect(allDash).not.toMatch(/text-\[(\d|10)px\]/)
    expect(read('src/components/engagement/StreakBadge.tsx')).not.toMatch(/text-\[(\d|10)px\]/)
  })
  it('no link wraps a button (toolkit actions are a single link or button)', () => {
    expect(allDash).not.toMatch(/<Link[^>]*>\s*<Button/)
  })
  it('the late day count has one home: the next-period stat (#74)', () => {
    expect(count(allDash, "'dashboard.lateBy'")).toBe(1)
    expect(allDash).not.toMatch(/dashboard\.(daysLate|daysOverdue|ringLateLabel|periodLate)\b/)
  })
  it('confidence is not repeated on the dashboard; the unlock meter shows it (#74)', () => {
    expect(allDash).not.toMatch(/'dashboard\.confidence'/)
    expect(count(allDash, '<ProgressToUnlockMeter')).toBe(1)
  })
  it('the stepper reads phase days from the shared ranges, not hard-coded lengths (#74)', () => {
    expect(read(`${DASH_DIR}/CycleJourney.tsx`)).toContain('journeySteps(')
    expect(allDash).not.toMatch(/cycleLength\s*-\s*14/)
  })
  it('uses prompt-rules for days since last log', () => {
    expect(dash).toContain("from '@/lib/prompt-rules'")
    expect(dash).not.toMatch(/86_400_000/)
  })
  it('the hero carries the three stats', () => {
    expect(allDash).toContain('data-testid="hero-stats"')
  })
  it('layout listens with the shared event constant', () => {
    const layout = read('src/app/(main)/layout.tsx')
    expect(layout).toContain('OPEN_COMPLETION_EVENT')
    expect(layout).not.toContain("'vesta:open-completion'")
  })
})
