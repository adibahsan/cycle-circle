import { describe, it, expect } from 'vitest'
import { latinOffenders, stripAllowed } from '../../e2e/support/latin-scan'

const text = (value: string) => ({ kind: 'text' as const, where: 'p', value })

describe('latin-scan allow-list', () => {
  it('lets Bengali, digits and the brand name through', () => {
    expect(latinOffenders([text('ক্যালেন্ডার'), text('২৮ দিন'), text('Cycle Circle'), text('© Cycle Circle 2026')])).toEqual([])
  })
  it('lets units after a number through', () => {
    expect(latinOffenders([text('৬৫ kg'), text('36.6 °C')])).toEqual([])
  })
  it('flags English words and unit-like words without a number', () => {
    expect(latinOffenders([text('Save'), text('kg'), text('ক্যালেন্ডার Dashboard')]).map((o) => o.value)).toEqual(['Save', 'kg', 'ক্যালেন্ডার Dashboard'])
  })
  it('lets user-entered names, emails and cited product names through', () => {
    expect(latinOffenders([text('Rina'), { kind: 'attr', where: 'a', value: 'প্রোফাইল সম্পাদনা Rina' }], ['Rina'])).toEqual([])
    expect(latinOffenders([text('info@cycle-circle.com'), text('BDApps ওটিপি'), text('AES-256-GCM দিয়ে')])).toEqual([])
    expect(latinOffenders([text('Rina')]).length).toBe(1)
  })
  it('strips only the allowed parts', () => {
    expect(stripAllowed('Cycle Circle ৫ cm').trim()).toBe('৫')
  })
})
