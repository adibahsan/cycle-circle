import { describe, it, expect } from 'vitest'
import {
  parseSmsCsv,
  parseBulkSmsInput,
  countSmsParts,
  composeSms,
  scheduleDrafts,
  SMS_CSV_TEMPLATE,
} from '@vesta/shared/server/services'

describe('parseSmsCsv', () => {
  it('parses header + rows with Bengali into the shared draft shape', () => {
    const csv = 'scheduled_date,message_en,message_bn\n2026-11-01,Drink water,পানি পান করুন\n,Rest well,'
    const { drafts, errors } = parseSmsCsv(csv)
    expect(errors).toEqual([])
    expect(drafts).toEqual([
      { messageEn: 'Drink water', messageBn: 'পানি পান করুন', scheduledDate: '2026-11-01' },
      { messageEn: 'Rest well' },
    ])
  })

  it('handles quoted fields with commas, escaped quotes, newlines, BOM and CRLF', () => {
    const csv = '﻿scheduled_date,message_en,message_bn\r\n2026-11-02,"Hi, ""friend""\nline two",টিপ\r\n'
    const { drafts } = parseSmsCsv(csv)
    expect(drafts).toEqual([
      { messageEn: 'Hi, "friend"\nline two', messageBn: 'টিপ', scheduledDate: '2026-11-02' },
    ])
  })

  it('accepts columns in any order and ignores blank rows', () => {
    const { drafts } = parseSmsCsv('message_en,scheduled_date\nA,2026-11-03\n\n,\nB,')
    expect(drafts).toEqual([{ messageEn: 'A', scheduledDate: '2026-11-03' }, { messageEn: 'B' }])
  })

  it('reports invalid dates and missing English text per line, keeps valid rows', () => {
    const { drafts, errors } = parseSmsCsv(
      'scheduled_date,message_en,message_bn\nnot-a-date,Hello,\n2026-11-04,,শুধু বাংলা\n2026-11-05,Ok,',
    )
    expect(drafts).toEqual([{ messageEn: 'Ok', scheduledDate: '2026-11-05' }])
    expect(errors.map((e) => e.line)).toEqual([2, 3])
  })

  it('errors when message_en header is missing', () => {
    const { drafts, errors } = parseSmsCsv('foo,bar\n1,2')
    expect(drafts).toEqual([])
    expect(errors).toHaveLength(1)
  })

  it('template parses cleanly', () => {
    const { drafts, errors } = parseSmsCsv(SMS_CSV_TEMPLATE)
    expect(errors).toEqual([])
    expect(drafts.length).toBeGreaterThan(0)
  })

  it('shares draft shape with the line parser', () => {
    expect(parseBulkSmsInput('A | বি')[0]).toEqual({ messageEn: 'A', messageBn: 'বি' })
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

describe('composeSms', () => {
  it('EN sends English only', () => expect(composeSms('Hi', 'হাই', 'EN')).toBe('Hi'))
  it('BN sends Bengali only', () => expect(composeSms('Hi', 'হাই', 'BN')).toBe('হাই'))
  it('BOTH joins EN then BN', () => expect(composeSms('Hi', 'হাই', 'BOTH')).toBe('Hi\nহাই'))
  it('BOTH without Bengali falls back to English', () => expect(composeSms('Hi', null, 'BOTH')).toBe('Hi'))
  it('BN without Bengali text throws', () => {
    expect(() => composeSms('Hi', '  ', 'BN')).toThrow()
  })
})

describe('scheduleDrafts', () => {
  const now = new Date('2026-10-19T10:00:00Z')
  it('dated rows use their own date at 08:00 UTC; undated fill from start date by order', () => {
    const dates = scheduleDrafts(
      [{ messageEn: 'a' }, { messageEn: 'b', scheduledDate: '2026-12-25' }, { messageEn: 'c' }],
      '2026-11-01',
      now,
    )
    expect(dates.map((d) => d.toISOString())).toEqual([
      '2026-11-01T08:00:00.000Z',
      '2026-12-25T08:00:00.000Z',
      '2026-11-02T08:00:00.000Z',
    ])
  })
  it('defaults the start to tomorrow', () => {
    const [d] = scheduleDrafts([{ messageEn: 'a' }], undefined, now)
    expect(d.toISOString()).toBe('2026-10-20T08:00:00.000Z')
  })
})
