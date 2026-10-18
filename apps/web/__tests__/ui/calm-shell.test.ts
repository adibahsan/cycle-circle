import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '../../src')
const read = (p: string) => fs.readFileSync(path.join(SRC, p), 'utf8')

// Guards for #71. The behaviour itself is covered by e2e/tests/page-shell.spec.ts ("shell basics");
// these catch loops that only appear in states the seeded persona never reaches (late, pregnancy, at-risk streak).
describe('calm shell (#71)', () => {
  const MOVING = [
    'app/(main)/dashboard/DashboardClient.tsx',
    ...fs.readdirSync(path.join(SRC, 'components/engagement')).map((f) => `components/engagement/${f}`),
  ]

  for (const file of MOVING) {
    it(`${file} has no infinite animation`, () => {
      const src = read(file)
      expect(src).not.toMatch(/repeat:\s*Infinity/)
      expect(src).not.toMatch(/animate-attn-/)
    })
  }

  it('the stylesheet has no looping attention halos', () => {
    const css = read('app/globals.css')
    expect(css).not.toMatch(/@keyframes attn-/)
  })

  it('full-height shells use dynamic viewport units', () => {
    for (const f of ['app/layout.tsx', 'app/(main)/layout.tsx']) {
      const src = read(f)
      expect(src, f).not.toMatch(/\b(min-)?h-screen\b|100vh/)
    }
  })
})
