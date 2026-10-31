import { describe, it, expect } from 'vitest'
import { createQueryTracker } from '../query-tracker'

describe('createQueryTracker', () => {
  it('merges a late update into the newest query, not the stale snapshot (#138)', () => {
    const t = createQueryTracker('status=active&page=1')
    // admin picks Status = suspended; the router has not landed yet
    t.apply({ status: 'suspended' })
    // debounced search fires with the old snapshot still rendered
    const q = new URLSearchParams(t.apply({ search: 'abc' }))
    expect(q.get('status')).toBe('suspended')
    expect(q.get('search')).toBe('abc')
    expect(q.get('page')).toBe('1')
  })

  it('deletes empty keys, keeps an explicit page, and re-syncs to the real URL', () => {
    const t = createQueryTracker('search=x&page=3')
    expect(t.apply({ search: '', page: 2 })).toBe('page=2')
    t.sync('status=deleted')
    expect(t.apply({ sort: 'createdAt' })).toBe('status=deleted&sort=createdAt&page=1')
  })
})
