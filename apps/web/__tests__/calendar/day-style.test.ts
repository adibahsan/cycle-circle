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
