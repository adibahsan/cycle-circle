import { describe, it, expect } from 'vitest'
import { toCsv, chartToCsv, csvFileName } from '@vesta/shared/utils/csv'

const BOM = '﻿'

describe('toCsv (shared helper)', () => {
  it('starts with a UTF-8 BOM and keeps Bengali intact', () => {
    const csv = toCsv(['নাম'], [['আমার ডেটা']])
    expect(csv.startsWith(BOM)).toBe(true)
    expect(csv).toContain('আমার ডেটা')
  })

  it('neutralises every formula trigger in text cells', () => {
    const csv = toCsv(['h'], [['=1+1'], ['+1'], ['-1'], ['@SUM(A1)'], ['\tx']])
    for (const cell of ["'=1+1", "'+1", "'-1", "'@SUM(A1)"]) expect(csv).toContain(cell)
  })

  it('leaves real negative numbers alone', () => {
    expect(toCsv(['h'], [[-3]])).toBe(`${BOM}h\r\n-3`)
  })

  it('quotes commas, quotes and newlines', () => {
    const csv = toCsv(['h'], [['a,b'], ['say "hi"']])
    expect(csv).toContain('"a,b"')
    expect(csv).toContain('"say ""hi"""')
  })
})

describe('chartToCsv', () => {
  it('writes the x column then one column per series, using labels as headers', () => {
    const csv = chartToCsv(
      [
        { date: '2026-10-01', count: 2, extra: 1 },
        { date: '2026-10-02', count: 0, extra: null },
      ],
      'date',
      'Date',
      [
        { key: 'count', label: 'Signups' },
        { key: 'extra', label: 'Extra' },
      ],
    )
    expect(csv).toBe(`${BOM}Date,Signups,Extra\r\n2026-10-01,2,1\r\n2026-10-02,0,`)
  })

  it('escapes a category label that looks like a formula', () => {
    const csv = chartToCsv([{ name: '=cmd', n: 1 }], 'name', 'Name', [{ key: 'n', label: 'N' }])
    expect(csv).toContain("'=cmd,1")
  })
})

describe('csvFileName', () => {
  it('joins a slug of the panel with the range key', () => {
    expect(csvFileName('Daily Active Users', '2026-10-03_2026-11-01')).toBe(
      'daily-active-users_2026-10-03_2026-11-01.csv',
    )
  })
  it('falls back to export for an empty title', () => {
    expect(csvFileName('  ', 'k')).toBe('export_k.csv')
  })
})
