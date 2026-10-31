import { describe, it, expect } from 'vitest'
import { withProPriceStates } from '../pro-price-state'

const e = (id: string, effectiveFrom: string, minute: number) => ({
  id,
  effectiveFrom,
  createdAt: new Date(Date.UTC(2030, 0, 1, 0, minute)),
})
const states = (entries: ReturnType<typeof e>[], today: string) =>
  Object.fromEntries(withProPriceStates(entries, today).map((x) => [x.id, x.state]))

describe('withProPriceStates', () => {
  it('marks the latest started entry in effect, later ones scheduled, earlier ones past', () => {
    const got = states([e('a', '2000-01-01', 0), e('b', '2030-01-01', 1), e('c', '2030-06-01', 2)], '2030-03-01')
    expect(got).toEqual({ a: 'PAST', b: 'IN_EFFECT', c: 'SCHEDULED' })
  })

  it('marks an entry replaced when a newer one is set for the same future day', () => {
    const got = states([e('a', '2000-01-01', 0), e('old', '2031-01-01', 1), e('new', '2031-01-01', 2)], '2030-03-01')
    expect(got).toEqual({ a: 'IN_EFFECT', old: 'REPLACED', new: 'SCHEDULED' })
  })

  it('marks a same-day duplicate that started already as replaced, not in effect', () => {
    const got = states([e('old', '2030-01-01', 1), e('new', '2030-01-01', 2)], '2030-03-01')
    expect(got).toEqual({ old: 'REPLACED', new: 'IN_EFFECT' })
  })

  it('lists newest effective day first', () => {
    const ids = withProPriceStates([e('a', '2000-01-01', 0), e('c', '2031-01-01', 2), e('b', '2030-01-01', 1)], '2030-03-01').map((x) => x.id)
    expect(ids).toEqual(['c', 'b', 'a'])
  })
})
