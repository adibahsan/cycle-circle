import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// #81 (spec #66): settings, profiles and subscription in the new look.
const SRC = path.resolve(__dirname, '../../src')
const read = (p: string) => fs.readFileSync(path.join(SRC, p), 'utf8')

const SETTINGS = 'app/(main)/settings/SettingsClient.tsx'
const PROFILES = 'app/(main)/profiles/ProfilesClient.tsx'
const SUBSCRIPTION = 'app/(main)/subscription/SubscriptionClient.tsx'
const PAGES = [SETTINGS, PROFILES, SUBSCRIPTION]

describe('#81 section headers', () => {
  it('settings uses the shared SectionHeader, not a local copy', () => {
    const src = read(SETTINGS)
    expect(src).toContain("from '@/components/ui/SectionHeader'")
    expect(src).not.toMatch(/function SectionHeader/)
  })

  it('the subscription comparison heading is the shared SectionHeader', () => {
    const src = read(SUBSCRIPTION)
    expect(src).toContain("from '@/components/ui/SectionHeader'")
    expect(src).toMatch(/<SectionHeader[^>]*subscription\.freeVsPro/)
  })

  it('profiles has no heading level that skips from h1 to h3', () => {
    expect(read(PROFILES)).not.toMatch(/<h3/)
  })
})

describe('#81 surfaces are panels and tints', () => {
  it.each(PAGES)('%s uses panel or tinted surfaces', (f) => {
    const src = read(f)
    expect(src).toMatch(/tone="(panel|peach|pink|mint|lavender|sky|sage)"|rounded-panel/)
  })

  it.each(PAGES)('%s has no hand-rolled 3xl cards, gradients or glow shadows', (f) => {
    const src = read(f)
    expect(src).not.toMatch(/rounded-3xl/)
    expect(src).not.toMatch(/linear-gradient\(/)
    expect(src).not.toMatch(/shadow-glow/)
    expect(src).not.toMatch(/surface-wash|surface-peach/)
  })

  it.each(PAGES)('%s draws decorative icon badges on a pastel tint', (f) => {
    expect(read(f)).toMatch(/bg-tint-(peach|pink|mint|lavender|sky|sage)/)
  })

  it('settings section icons are not painted in the goal accent', () => {
    expect(read(SETTINGS)).not.toMatch(/rounded-lg bg-\[var\(--goal-accent\)\] flex items-center/)
  })
})

describe('#81 pill controls', () => {
  it('the settings segmented control is a pill track with pill segments', () => {
    const src = read(SETTINGS)
    const group = src.slice(src.indexOf('role="radiogroup"'), src.indexOf('function Toggle'))
    expect(group).toMatch(/role="radiogroup"[^>]*rounded-full/)
    expect(group).not.toMatch(/rounded-\[10px\]|rounded-xl/)
    expect(group.match(/rounded-full/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
  })
})

describe('#81 calm motion', () => {
  it.each(PAGES)('%s has no looping animation', (f) => {
    const src = read(f)
    expect(src).not.toMatch(/animate-(pulse|spin|bounce|ping)/)
    expect(src).not.toMatch(/repeat:\s*Infinity/)
  })
})

describe('#81 profiles tap targets', () => {
  it('the add-profile close button is at least 44px', () => {
    const src = read(PROFILES)
    const close = src.slice(src.indexOf('onClick={onClose}'), src.indexOf("aria-label={t('common.cancel')}"))
    expect(close).toMatch(/min-w-11/)
    expect(close).toMatch(/min-h-11/)
  })
})
