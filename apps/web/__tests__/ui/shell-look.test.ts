import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { NAV_ACTIVE } from '@/components/shell/nav-config'

// #73: the shell in the pastel look. The active nav item is the only goal-accent surface in the shell.
const SRC = path.resolve(__dirname, '../../src')
const read = (p: string) => readFileSync(path.join(SRC, p), 'utf8')
const css = read('app/globals.css')

/** `--name: value;` declarations from the first block opened by `selector {` (flat blocks only). */
function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`block not found: ${selector}`)
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
const themes = { light, dark: { ...light, ...block('.dark') } }
const GOALS = ['tracking', 'conceive', 'pregnancy', 'perimenopause'] as const

/** Resolve `var(--x)` against a theme, with the layout's per-goal --goal-accent. */
function resolve(value: string, theme: Record<string, string>, goal: string): string {
  const m = value.match(/^var\((--[\w-]+)\)$/)
  if (!m) return value
  if (m[1] === '--goal-accent') return resolve(theme[`--color-goal-${goal}`], theme, goal)
  const next = theme[m[1]]
  if (!next) throw new Error(`unknown token ${m[1]}`)
  return resolve(next, theme, goal)
}

describe('active nav item', () => {
  it('reads the real dark token block (dark ink on the brighter dark goal accents)', () => {
    expect(themes.dark['--color-on-accent']).not.toBe(light['--color-on-accent'])
    for (const goal of GOALS)
      expect(themes.dark[`--color-goal-${goal}`]).not.toBe(light[`--color-goal-${goal}`])
  })

  it('is filled with the goal accent', () => {
    expect(NAV_ACTIVE.backgroundColor).toBe('var(--goal-accent)')
  })

  for (const [name, theme] of Object.entries(themes))
    for (const goal of GOALS)
      it(`label passes 4.5:1 for the ${goal} goal in ${name} mode`, () => {
        const fg = resolve(NAV_ACTIVE.color, theme, goal)
        const bg = resolve(NAV_ACTIVE.backgroundColor, theme, goal)
        expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)
      })
})

describe('shell surfaces', () => {
  const shell = {
    layout: read('app/(main)/layout.tsx'),
    bottomNav: read('components/shell/BottomNav.tsx'),
    moreSheet: read('components/shell/MoreSheet.tsx'),
    profileChip: read('components/shell/ProfileChip.tsx'),
  }

  it('every nav surface shows its active item with the shared NAV_ACTIVE style', () => {
    for (const s of [shell.layout, shell.bottomNav, shell.moreSheet]) expect(s).toContain('NAV_ACTIVE')
  })

  it('the goal accent appears only on focus rings, the active item and the profile ring', () => {
    for (const [name, s] of Object.entries(shell)) {
      const stray = s
        .split('\n')
        .filter((l) => l.includes('--goal-accent'))
        // focus rings; the layout's per-goal --goal-accent assignment; the profile ring stroke
        .map((l) => l.replace(/focus-visible:ring-\[var\(--goal-accent\)\]/g, ''))
        .filter((l) => l.includes('--goal-accent'))
        .filter((l) => !/\['--goal-accent' as string\]/.test(l))
        .filter((l) => !(name === 'profileChip' && /stroke="var\(--goal-accent\)"/.test(l)))
      expect(stray, name).toEqual([])
    }
  })

  it('the desktop sidebar is an opaque card surface, not .glass', () => {
    const aside = shell.layout.match(/<aside[\s\S]*?>/)![0]
    expect(aside).not.toMatch(/\bglass\b/)
    expect(aside).toContain('bg-[var(--color-bg-card)]')
  })

  it('More sheet destinations sit in pastel tinted icon badges', () => {
    // Badges come from the shared tint map (#66 T1).
    expect(shell.moreSheet).toMatch(/TINT_CLASSES\[\w+\]\.badge/)
    expect(read('components/ui/tints.ts')).toMatch(/badge: 'bg-tint-/)
  })
})
