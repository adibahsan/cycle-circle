import { describe, it, expect } from 'vitest'
import { combineBilingualSms, parseBulkSmsInput } from '@vesta/shared/server/services'

describe('combineBilingualSms', () => {
  it('joins EN and BN with a newline when BN is present', () => {
    expect(combineBilingualSms('EN', 'BN')).toBe('EN\nBN')
  })

  it('returns only EN when BN is undefined', () => {
    expect(combineBilingualSms('EN')).toBe('EN')
  })

  it('returns only EN when BN is null', () => {
    expect(combineBilingualSms('EN', null)).toBe('EN')
  })

  it('returns only EN when BN is blank whitespace', () => {
    expect(combineBilingualSms('EN', '   ')).toBe('EN')
  })

  it('returns only EN when BN is an empty string', () => {
    expect(combineBilingualSms('EN', '')).toBe('EN')
  })
})

describe('parseBulkSmsInput', () => {
  it('parses a mixed input: EN+BN, EN-only, blank lines, EN+BN again', () => {
    const result = parseBulkSmsInput('Tip one | টিপ এক\nTip two\n\n  \nTip three | তিন')
    expect(result).toEqual([
      { messageEn: 'Tip one', messageBn: 'টিপ এক' },
      { messageEn: 'Tip two' },
      { messageEn: 'Tip three', messageBn: 'তিন' },
    ])
  })

  it('skips blank lines', () => {
    const result = parseBulkSmsInput('\n\n  \nHello\n\n')
    expect(result).toEqual([{ messageEn: 'Hello' }])
  })

  it('handles EN-only lines (no pipe)', () => {
    const result = parseBulkSmsInput('Hello world')
    expect(result).toEqual([{ messageEn: 'Hello world' }])
  })

  it('trims whitespace around the pipe separator', () => {
    const result = parseBulkSmsInput('Hello  |  হ্যালো')
    expect(result).toEqual([{ messageEn: 'Hello', messageBn: 'হ্যালো' }])
  })

  it('returns an empty array for empty/whitespace-only input', () => {
    expect(parseBulkSmsInput('')).toEqual([])
    expect(parseBulkSmsInput('   \n  \n')).toEqual([])
  })
})
