import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const src = path.resolve(__dirname, '../../src')
const read = (p: string) => readFileSync(path.join(src, p), 'utf8')
const sectionsDir = 'app/(marketing)/welcome/sections/'
const SECTIONS = ['FeaturesSection', 'PhaseShowcaseSection', 'SocialProofSection', 'CTASection', 'LandingFooter']

describe('landing content is visible by default', () => {
  const reveal = read('components/motion/RevealOnScroll.tsx')

  it('never hides content in markup or via a JS initial state', () => {
    expect(reveal).not.toMatch(/initial=/)
    expect(reveal).not.toMatch(/opacity:\s*0/)
    expect(reveal).not.toMatch(/whileInView/)
  })

  it('reveal CSS only enhances: motion-gated and never sets opacity to 0', () => {
    const css = read('components/motion/reveal.css')
    expect(css).toMatch(/prefers-reduced-motion:\s*no-preference/)
    expect(css).toMatch(/animation-timeline:\s*view\(\)/)
    expect(css).not.toMatch(/opacity:\s*0\b/)
  })
})

describe('landing sections share one container and spacing', () => {
  const layout = read(sectionsDir + 'layout.ts')

  it.each(SECTIONS)('%s uses the shared constants', (name) => {
    const file = read(sectionsDir + name + '.tsx')
    expect(file).toContain('LANDING_CONTAINER')
    if (name !== 'LandingFooter') expect(file).toContain('LANDING_SECTION')
    expect(file).not.toMatch(/max-w-(3xl|4xl|5xl)/)
    expect(file).not.toMatch(/relative py-\d+/)
  })

  it('defines a single width', () => {
    expect(layout.match(/max-w-/g)).toHaveLength(1)
  })
})
