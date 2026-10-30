import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/app/queries/auth-queries', () => ({ getCurrentUser: async () => ({ id: 'u1' }) }))
vi.mock('@/app/queries/profile-queries', () => ({
  getProfiles: async () => [{ id: 'p1', goal: null }],
  getActiveProfileId: async () => 'p1',
}))
const getSymptomLogs = vi.fn(async (..._args: unknown[]) => [])
vi.mock('@/app/queries/symptom-queries', () => ({ getSymptomLogs: (...a: unknown[]) => getSymptomLogs(...a) }))
vi.mock('@/app/(main)/symptoms/SymptomsClient', () => ({ SymptomsClient: () => null }))

import SymptomsPage from '@/app/(main)/symptoms/page'

afterEach(() => {
  vi.useRealTimers()
  getSymptomLogs.mockClear()
})

describe('symptoms page opens on the Bangladesh today', () => {
  for (const [label, instant] of [
    ['18:30 UTC (00:30 Bangladesh)', '2026-10-04T18:30:00.000Z'],
    ['23:59 UTC (05:59 Bangladesh)', '2026-10-04T23:59:00.000Z'],
  ] as const) {
    it(`${label}`, async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(instant))
      const el = (await SymptomsPage({ searchParams: Promise.resolve({}) })) as { props: { date: string } }
      expect(el.props.date).toBe('2026-10-05')
      expect(getSymptomLogs).toHaveBeenCalledWith('p1', '2026-10-05')
    })
  }

  it('an explicit ?date= still wins', async () => {
    const el = (await SymptomsPage({ searchParams: Promise.resolve({ date: '2026-09-01' }) })) as { props: { date: string } }
    expect(el.props.date).toBe('2026-09-01')
  })
})
