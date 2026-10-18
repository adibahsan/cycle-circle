import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  formatInsightNumber,
  formatMonthTick,
  summarizeCycleLengths,
  summarizeSymptoms,
} from '@/lib/insights-data'
import i18n from '@vesta/shared/utils/i18n'

const ASCII_DIGIT = /[0-9]/
const BN_DIGIT = /[০-৯]/

describe('formatInsightNumber', () => {
  it('uses Latin digits in English', () => {
    expect(formatInsightNumber(28.5, 'en')).toBe('28.5')
  })
  it('uses Bengali digits in Bengali', () => {
    expect(formatInsightNumber(28, 'bn')).toBe('২৮')
    expect(formatInsightNumber(3.2, 'bn')).toBe('৩.২')
  })
})

describe('formatMonthTick', () => {
  it('formats month and two-digit year in English', () => {
    expect(formatMonthTick('2026-01-15', 'en')).toBe('Jan 26')
  })
  it('formats month and year in Bengali with no Latin digits or letters', () => {
    const s = formatMonthTick('2026-01-15', 'bn')
    expect(s).toMatch(BN_DIGIT)
    expect(s).not.toMatch(ASCII_DIGIT)
    expect(s).not.toMatch(/[A-Za-z]/)
  })
  it('does not shift the month across the UTC boundary', () => {
    expect(formatMonthTick('2026-03-01', 'en')).toBe('Mar 26')
  })
})

describe('summarizeCycleLengths', () => {
  it('reports count, shortest, longest and latest', () => {
    expect(
      summarizeCycleLengths([
        { date: '2026-01-01', cycleLength: 29 },
        { date: '2026-02-01', cycleLength: 31 },
        { date: '2026-03-01', cycleLength: 27 },
      ]),
    ).toEqual({ count: 3, shortest: 27, longest: 31, latest: 27 })
  })
  it('is null with no cycles', () => {
    expect(summarizeCycleLengths([])).toBeNull()
  })
})

describe('summarizeSymptoms', () => {
  it('names the most logged category and the total', () => {
    expect(
      summarizeSymptoms([
        { category: 'MOOD', count: 4 },
        { category: 'PHYSICAL', count: 9 },
        { category: 'LIFESTYLE', count: 0 },
      ]),
    ).toEqual({ top: 'PHYSICAL', topCount: 9, total: 13 })
  })
  it('is null when nothing was logged', () => {
    expect(summarizeSymptoms([{ category: 'MOOD', count: 0 }])).toBeNull()
  })
})

describe('insights a11y copy', () => {
  const keys = ['cycleSummary', 'symptomSummary', 'symptomAllTime', 'regularitySummary', 'fertileSummary', 'dataTable', 'sampleSize', 'cycleColumn', 'dateColumn', 'categoryColumn']
  it('every new key exists in English and Bengali', () => {
    const en = i18n.getResourceBundle('en', 'translation').insights as Record<string, string>
    const bn = i18n.getResourceBundle('bn', 'translation').insights as Record<string, string>
    for (const k of keys) {
      expect(en[k], `en ${k}`).toBeTruthy()
      expect(bn[k], `bn ${k}`).toBeTruthy()
    }
  })
  it('Bengali copy has no English words outside placeholders', () => {
    const bn = i18n.getResourceBundle('bn', 'translation').insights as Record<string, string>
    for (const k of keys) {
      expect(bn[k].replace(/\{\{\w+\}\}/g, ''), k).not.toMatch(/[A-Za-z]/)
    }
  })
})

describe('insights chart loading', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../../src/app/(main)/insights/InsightsClient.tsx'), 'utf8')
  it('the page module does not import the chart library statically', () => {
    expect(src).not.toMatch(/from ['"]recharts['"]/)
  })
  it('does not format with the browser default locale', () => {
    expect(src).not.toMatch(/toLocaleString\(\s*['"]default['"]/)
  })
})
