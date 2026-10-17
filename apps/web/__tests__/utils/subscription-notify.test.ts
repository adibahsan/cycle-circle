import { describe, it, expect } from 'vitest'
import { mapNotifyStatus } from '@/lib/subscription-notify'

describe('mapNotifyStatus', () => {
  it('maps REGISTERED to registered', () => {
    expect(mapNotifyStatus('REGISTERED')).toBe('registered')
  })
  it('maps UNREGISTERED to unregistered', () => {
    expect(mapNotifyStatus('UNREGISTERED')).toBe('unregistered')
  })
  it('tolerates a trailing dot and case', () => {
    expect(mapNotifyStatus('registered.')).toBe('registered')
    expect(mapNotifyStatus('Unregistered.')).toBe('unregistered')
  })
  it('ignores other statuses', () => {
    expect(mapNotifyStatus('PENDING')).toBeNull()
    expect(mapNotifyStatus(undefined)).toBeNull()
    expect(mapNotifyStatus(42)).toBeNull()
  })
})
