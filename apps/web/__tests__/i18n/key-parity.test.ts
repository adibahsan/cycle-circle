import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import i18n from '@vesta/shared/utils/i18n'

/** Flatten a resource bundle into `a.b.0.c` -> leaf value. */
function flatten(value: unknown, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) flatten(v, prefix ? `${prefix}.${k}` : k, out)
  } else {
    out[prefix] = value
  }
  return out
}

const en = flatten(i18n.getResourceBundle('en', 'translation'))
const bn = flatten(i18n.getResourceBundle('bn', 'translation'))

describe('i18n key parity', () => {
  it('has the same keys in English and Bengali', () => {
    const missingBn = Object.keys(en).filter((k) => !(k in bn))
    const missingEn = Object.keys(bn).filter((k) => !(k in en))
    expect({ missingBn, missingEn }).toEqual({ missingBn: [], missingEn: [] })
  })

  it('has no empty strings', () => {
    const empty = [...Object.entries(en).map(([k, v]) => ['en', k, v]), ...Object.entries(bn).map(([k, v]) => ['bn', k, v])]
      .filter(([, , v]) => typeof v !== 'string' || v.trim() === '')
      .map(([l, k]) => `${l}:${k}`)
    expect(empty).toEqual([])
  })

  it('uses the same interpolation placeholders in both languages', () => {
    const ph = (s: unknown) => (typeof s === 'string' ? [...s.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]).sort() : [])
    const mismatched = Object.keys(en).filter((k) => k in bn && JSON.stringify(ph(en[k])) !== JSON.stringify(ph(bn[k])))
    expect(mismatched).toEqual([])
  })

  it('defines every literal t(\'key\') used in apps/web/src', () => {
    const SRC = path.resolve(__dirname, '../../src')
    const walk = (d: string): string[] =>
      fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(d, e.name)
        return e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(p)) : /\.tsx?$/.test(e.name) ? [p] : []
      })
    const has = (k: string) => k in en || `${k}_other` in en || Object.keys(en).some((x) => x.startsWith(`${k}.`))
    const missing: string[] = []
    for (const file of walk(SRC)) {
      const text = fs.readFileSync(file, 'utf8')
      for (const m of text.matchAll(/\bt\(\s*'([a-zA-Z]+(?:\.[a-zA-Z0-9_]+)+)'/g)) {
        if (!has(m[1])) missing.push(`${path.relative(SRC, file)}: ${m[1]}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('has no inline English fallbacks: strings live in the resources', () => {
    const SRC = path.resolve(__dirname, '../../src')
    const walk = (d: string): string[] =>
      fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(d, e.name)
        return e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(p)) : /\.tsx?$/.test(e.name) ? [p] : []
      })
    const offenders: string[] = []
    for (const file of walk(SRC)) {
      const text = fs.readFileSync(file, 'utf8')
      if (/defaultValue\s*:/.test(text) || /\bt\(\s*'[\w.]+'\s*,\s*['"`]/.test(text)) offenders.push(path.relative(SRC, file))
    }
    expect(offenders).toEqual([])
  })
})
