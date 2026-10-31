import { describe, it, expect } from 'vitest'
import {
  parseCampaignCsv,
  campaignCsvTemplate,
  SMS_MAX_PARTS,
  SMS_MAX_CAMPAIGN_MESSAGES,
  countSmsParts,
} from '@vesta/shared/server/services'

describe('parseCampaignCsv', () => {
  it('parses day,text rows with Bengali text', () => {
    const { rows, errors } = parseCampaignCsv('day,text\n2043-01-01,Drink water\n2043-01-03,পানি পান করুন')
    expect(errors).toEqual([])
    expect(rows).toEqual([
      { line: 2, day: '2043-01-01', body: 'Drink water' },
      { line: 3, day: '2043-01-03', body: 'পানি পান করুন' },
    ])
  })

  it('handles quoted fields with commas, escaped quotes, newlines, BOM and CRLF', () => {
    const { rows, errors } = parseCampaignCsv('\uFEFFday,text\r\n2043-01-02,"Hi, ""friend""\nline two"\r\n2043-01-03,after\r\n')
    expect(errors).toEqual([])
    expect(rows[0]).toEqual({ line: 2, day: '2043-01-02', body: 'Hi, "friend"\nline two' })
    expect(rows[1].line).toBe(4)
  })

  it('accepts columns in any order and skips blank rows', () => {
    const { rows, errors } = parseCampaignCsv('text,day\nA,2043-01-03\n\n,\nB,2043-01-04')
    expect(errors).toEqual([])
    expect(rows.map((r) => r.day)).toEqual(['2043-01-03', '2043-01-04'])
  })

  it('reports every bad row by line and keeps the good ones', () => {
    const { rows, errors } = parseCampaignCsv(
      ['day,text', 'not-a-date,Hello', '2043-02-30,Hello', ',Hello', '2043-01-05,', '2043-01-06,ok', '2043-01-06,twice'].join('\n'),
    )
    expect(rows.map((r) => r.day)).toEqual(['2043-01-06'])
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4, 5, 7])
    expect(errors[4].message).toMatch(/line 6/)
  })

  it('refuses over-long text (too many SMS parts)', () => {
    const { errors } = parseCampaignCsv(`day,text\n2043-01-05,${'a'.repeat(SMS_MAX_PARTS * 153 + 1)}`)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toMatch(/parts/)
  })

  it('caps the row count', () => {
    const lines = Array.from({ length: SMS_MAX_CAMPAIGN_MESSAGES + 5 }, (_, i) => `2043-01-01,x${i}`)
    const { errors } = parseCampaignCsv(['day,text', ...lines].join('\n'))
    expect(errors.filter((e) => /too many/i.test(e.message))).toHaveLength(1)
  })

  it('errors on an empty file, missing columns, or no rows', () => {
    expect(parseCampaignCsv('').errors).toHaveLength(1)
    expect(parseCampaignCsv('foo,bar\n1,2').errors[0].message).toMatch(/header/)
    expect(parseCampaignCsv('day,text\n').errors[0].message).toMatch(/no rows/)
  })

  it('the template parses cleanly', () => {
    const { rows, errors } = parseCampaignCsv(campaignCsvTemplate('2043-01-01', '2043-01-02'))
    expect(errors).toEqual([])
    expect(rows).toHaveLength(2)
  })
})

describe('countSmsParts', () => {
  it('GSM-7 boundaries 160 / 153', () => {
    expect(countSmsParts('a'.repeat(160))).toEqual({ encoding: 'GSM7', parts: 1, charsLeft: 0 })
    expect(countSmsParts('a'.repeat(161))).toEqual({ encoding: 'GSM7', parts: 2, charsLeft: 145 })
    expect(countSmsParts('a'.repeat(306))).toEqual({ encoding: 'GSM7', parts: 2, charsLeft: 0 })
    expect(countSmsParts('a'.repeat(307)).parts).toBe(3)
  })

  it('UCS-2 boundaries 70 / 67 for Bengali', () => {
    expect(countSmsParts('ক'.repeat(70))).toEqual({ encoding: 'UCS2', parts: 1, charsLeft: 0 })
    expect(countSmsParts('ক'.repeat(71))).toEqual({ encoding: 'UCS2', parts: 2, charsLeft: 63 })
    expect(countSmsParts('ক'.repeat(134)).parts).toBe(2)
    expect(countSmsParts('ক'.repeat(135)).parts).toBe(3)
  })

  it('one non-GSM character flips the whole message to UCS-2', () => {
    expect(countSmsParts('a'.repeat(100) + 'ক').encoding).toBe('UCS2')
    expect(countSmsParts('a'.repeat(100) + 'ক').parts).toBe(2)
  })

  it('GSM extension characters cost two septets', () => {
    expect(countSmsParts('€'.repeat(80))).toMatchObject({ encoding: 'GSM7', parts: 1, charsLeft: 0 })
    expect(countSmsParts('€'.repeat(81)).parts).toBe(2)
  })

  it('empty text is zero parts', () => {
    expect(countSmsParts('')).toEqual({ encoding: 'GSM7', parts: 0, charsLeft: 160 })
  })
})
