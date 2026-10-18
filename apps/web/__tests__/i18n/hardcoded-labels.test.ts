import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '../../src')

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' || e.name === '.next' ? [] : walk(p)
    return /\.tsx$/.test(e.name) ? [p] : []
  })
}

/** Attributes that screen readers or tooltips expose as text. */
const ATTR = /\b(aria-label|aria-description|aria-roledescription|aria-valuetext|ariaLabel|title|alt|placeholder)\s*=\s*/g

/** Dev-only tooling, never shown to users. */
const IGNORED_DIRS = ['app/internal/']

/**
 * Hard-coded text that cannot be translated. Key: `file::literal`.
 * Keep this list short; every entry needs a reason.
 */
const ALLOWED: Record<string, string> = {
  'components/ui/BrandLogo.tsx::Cycle Circle': 'Brand name as the logo alt text, identical in both languages',
}

/** Pull the attribute value expression that starts at `from`. Returns its source text. */
function valueAt(text: string, from: number): string {
  const ch = text[from]
  if (ch === '"' || ch === "'") {
    const end = text.indexOf(ch, from + 1)
    return text.slice(from, end + 1)
  }
  if (ch !== '{') return ''
  let depth = 0
  let i = from
  let quote = ''
  for (; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = ''
      continue
    }
    if (c === '"' || c === "'" || c === '`') quote = c
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) break
  }
  return text.slice(from, i + 1)
}

/** Remove translated calls (t('x'), t(`x`, {...})) and ${...} interpolations, then list remaining text literals. */
function literals(expr: string): string[] {
  const noT = expr
    .replace(/\bt\(\s*(['"`])[^'"`]*\1[^)]*\)/g, '')
    .replace(/[!=]==?\s*(['"`])[^'"`]*\1/g, '') // comparisons such as theme === 'dark' are conditions, not text
  const out: string[] = []
  for (const m of noT.matchAll(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    const body = m[2].replace(/\$\{[^}]*\}/g, ' ').trim()
    if (/[A-Za-z]{2,}/.test(body)) out.push(body)
  }
  return out
}

function scan() {
  const hits: string[] = []
  for (const file of walk(SRC)) {
    const rel = path.relative(SRC, file).split(path.sep).join('/')
    if (IGNORED_DIRS.some((d) => rel.startsWith(d))) continue
    const text = fs.readFileSync(file, 'utf8')
    for (const m of text.matchAll(ATTR)) {
      const expr = valueAt(text, m.index! + m[0].length)
      for (const lit of literals(expr)) {
        if (ALLOWED[`${rel}::${lit}`]) continue
        const line = text.slice(0, m.index!).split('\n').length
        hits.push(`${rel}:${line} ${m[1]}=${JSON.stringify(lit)}`)
      }
    }
  }
  return hits
}

describe('no hard-coded English in aria-label / title / placeholder / alt', () => {
  it('every accessible label goes through the i18n module', () => {
    expect(scan()).toEqual([])
  })

  it('keeps the allow-list honest: every entry still matches the source', () => {
    for (const key of Object.keys(ALLOWED)) {
      const [rel, lit] = key.split('::')
      const text = fs.readFileSync(path.join(SRC, rel), 'utf8')
      expect(text.includes(lit), `stale allow-list entry ${key}`).toBe(true)
    }
  })
})
