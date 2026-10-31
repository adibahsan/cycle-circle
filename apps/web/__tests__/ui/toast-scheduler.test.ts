import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createToastScheduler,
  TOAST_AFTER_POPUP_MS,
  TOAST_VISIBLE_MS,
  type ToastContent,
} from '@/lib/toast-core'

describe('toast scheduler (#157)', () => {
  let seen: (ToastContent | null)[]
  beforeEach(() => {
    vi.useFakeTimers()
    seen = []
  })
  afterEach(() => vi.useRealTimers())
  const last = () => seen[seen.length - 1]

  it('a plain toast fired while the celebration is pending does not cancel it', () => {
    const s = createToastScheduler((i) => seen.push(i))
    s.celebrate({ title: 'Logged!', message: 'ok' })
    s.show({ message: 'Profile 60% complete' }) // profile-updated -> completion refetch
    expect(seen).toHaveLength(0)
    vi.advanceTimersByTime(TOAST_AFTER_POPUP_MS)
    expect(last()).toMatchObject({ title: 'Logged!', celebrate: true })
  })

  it('a plain toast arriving while the celebration shows waits, then appears', () => {
    const s = createToastScheduler((i) => seen.push(i))
    s.celebrate({ title: 'Logged!', message: 'ok' })
    vi.advanceTimersByTime(TOAST_AFTER_POPUP_MS)
    s.show({ message: 'Profile 60% complete' })
    expect(last()).toMatchObject({ celebrate: true })
    vi.advanceTimersByTime(TOAST_VISIBLE_MS)
    expect(last()).toMatchObject({ message: 'Profile 60% complete', celebrate: false })
    vi.advanceTimersByTime(TOAST_VISIBLE_MS)
    expect(last()).toBeNull()
  })

  it('a plain toast with nothing pending shows immediately', () => {
    const s = createToastScheduler((i) => seen.push(i))
    s.show({ message: 'Saved' })
    expect(last()).toMatchObject({ message: 'Saved' })
  })

  it('dismiss moves on to the next queued toast', () => {
    const s = createToastScheduler((i) => seen.push(i))
    s.celebrate({ message: 'c' })
    vi.advanceTimersByTime(TOAST_AFTER_POPUP_MS)
    s.show({ message: 'next' })
    s.dismiss()
    expect(last()).toMatchObject({ message: 'next' })
  })
})
