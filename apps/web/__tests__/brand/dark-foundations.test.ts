import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveTheme, themeBootScript } from '@vesta/shared/utils/theme'

const ROOT = path.resolve(__dirname, '../../../..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')

function block(css: string, selector: string): Record<string, string> {
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
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(tsx?|css)$/.test(name)) out.push(p)
  }
  return out
}

const SURFACES = ['--color-bg-primary', '--color-bg-secondary', '--color-bg-card']
const TEXT = ['--color-text-primary', '--color-text-secondary', '--color-text-muted']

for (const app of ['web', 'admin'] as const) {
  describe(`${app} dark foundations: tokens`, () => {
    const css = read(`apps/${app}/src/app/globals.css`)
    const light = block(css, '@theme')
    const dark = { ...light, ...block(css, '.dark') }

    it('dark text tokens reach 4.5:1 on every dark surface', () => {
      for (const s of SURFACES)
        for (const t of TEXT)
          expect(contrast(dark[t], dark[s]), `${t} on ${s}`).toBeGreaterThanOrEqual(4.5)
    })

    it('dark surfaces step apart: card lifts off the page, nested panel off the card', () => {
      expect(contrast(dark['--color-bg-card'], dark['--color-bg-primary'])).toBeGreaterThanOrEqual(1.25)
      expect(contrast(dark['--color-bg-card'], dark['--color-bg-secondary'])).toBeGreaterThanOrEqual(1.15)
      expect(contrast(dark['--color-border'], dark['--color-bg-card'])).toBeGreaterThanOrEqual(1.4)
    })

    for (const [name, tokens] of [['light', light], ['dark', dark]] as const) {
      it(`${name}: control border (and switch off-track) reaches 3:1 on every surface`, () => {
        for (const s of [...SURFACES, '--color-bg-peach'])
          expect(contrast(tokens['--color-border-strong'], tokens[s]), `strong on ${s}`).toBeGreaterThanOrEqual(3)
      })

      it(`${name}: ring-offset token equals the card surface`, () => {
        expect(tokens['--color-ring-offset']).toBeDefined()
        expect(tokens['--color-ring-offset'].toUpperCase()).toBe(tokens['--color-bg-card'].toUpperCase())
      })
    }

    it('applies the ring-offset token as the global Tailwind ring-offset colour', () => {
      expect(css).toMatch(/--tw-ring-offset-color:\s*var\(--color-ring-offset\)/)
    })

    it('root colour-scheme agrees with the theme class', () => {
      expect(css).toMatch(/:root\s*{\s*color-scheme:\s*light;/)
      expect(css).toMatch(/\.dark\s*{\s*color-scheme:\s*dark;/)
    })

    it('scrollbar uses a live token, not the dead --color-dark-* ones', () => {
      expect(css).not.toMatch(/--color-dark-/)
      expect(css).toMatch(/--color-scrollbar/)
    })
  })

  describe(`${app} dark foundations: source bans`, () => {
    const files = walk(path.join(ROOT, `apps/${app}/src`))
    it('has no transition-all', () => {
      const hits = files.filter((f) => /transition-all/.test(readFileSync(f, 'utf8')))
      expect(hits.map((f) => path.relative(ROOT, f))).toEqual([])
    })
    it('appends no hex alpha suffix to a var() or a colour template', () => {
      const hits = files
        .filter((f) => /\.tsx?$/.test(f) && !f.includes(`${path.sep}internal${path.sep}`))
        .filter((f) => /var\(--[\w-]+\)[0-9a-fA-F]{2}(?![0-9a-zA-Z])|\$\{[^}]*\}[0-9a-fA-F]{2}[`'"]/.test(readFileSync(f, 'utf8')))
      expect(hits.map((f) => path.relative(ROOT, f))).toEqual([])
    })
    it('has no per-component --tw-ring-offset-color override', () => {
      const hits = files
        .filter((f) => /\.tsx?$/.test(f))
        .filter((f) => /--tw-ring-offset-color/.test(readFileSync(f, 'utf8')))
      expect(hits.map((f) => path.relative(ROOT, f))).toEqual([])
    })
    it('puts the pre-paint theme script in the root layout', () => {
      const layout = read(`apps/${app}/src/app/layout.tsx`)
      expect(layout).toContain('themeBootScript(')
      expect(layout).toContain('@vesta/shared/utils/theme')
    })
  })
}

describe('resolveTheme', () => {
  it('uses the stored choice, else the system preference', () => {
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme(undefined, true)).toBe('dark')
    expect(resolveTheme(null, false)).toBe('light')
    expect(resolveTheme('garbage', true)).toBe('dark')
  })
})

describe('themeBootScript (runs before first paint)', () => {
  function run(stored: string | null, prefersDark: boolean, throwingStorage = false) {
    const classes = new Set<string>()
    const html = {
      classList: {
        toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)),
        add: (c: string) => classes.add(c),
        remove: (c: string) => classes.delete(c),
      },
      style: { colorScheme: '' },
    }
    const localStorage = {
      getItem: (k: string) => {
        if (throwingStorage) throw new Error('blocked')
        return k === 'my-key' ? stored : null
      },
    }
    new Function('document', 'localStorage', 'matchMedia', themeBootScript('my-key'))(
      { documentElement: html },
      localStorage,
      () => ({ matches: prefersDark }),
    )
    return { dark: classes.has('dark'), scheme: html.style.colorScheme }
  }

  it('applies a persisted dark theme', () => {
    expect(run(JSON.stringify({ state: { theme: 'dark' } }), false)).toEqual({ dark: true, scheme: 'dark' })
  })
  it('persisted light wins over a dark system', () => {
    expect(run(JSON.stringify({ state: { theme: 'light' } }), true)).toEqual({ dark: false, scheme: 'light' })
  })
  it('follows the system when nothing is stored', () => {
    expect(run(null, true)).toEqual({ dark: true, scheme: 'dark' })
    expect(run(null, false)).toEqual({ dark: false, scheme: 'light' })
  })
  it('follows the system when the stored state has no theme', () => {
    expect(run(JSON.stringify({ state: { language: 'bn' } }), true).dark).toBe(true)
  })
  it('survives corrupt or blocked storage', () => {
    expect(run('{not json', true).dark).toBe(true)
    expect(run(null, true, true).dark).toBe(true)
  })
})
