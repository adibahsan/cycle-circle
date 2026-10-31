// Ticket #208: dashboard KPIs count what their labels say. These assert on global counts
// (every profile, every Pro user), so this file runs in the serial group (vitest.config.ts).
import { describe, it, expect, afterAll } from 'vitest'
import { testPrisma } from '../helpers/test-db'
import {
  getDashboardStats,
  getSubscriptionStatusBreakdown,
  countProUsers,
  getSymptomLoggingRate,
  getLoggingStreakDistribution,
} from '@vesta/shared/server/services'
import { parseDateRange } from '@vesta/shared/utils/date-range'

const P = 'kpi208'
const NOW = new Date('2031-05-10T06:00:00Z') // 12:00 on 10 May in Bangladesh

async function makeUser(n: string, opts: { pro?: boolean; deleted?: boolean; profiles?: number } = {}) {
  const user = await testPrisma.user.create({
    data: {
      id: `${P}-u-${n}`,
      phone: `+8801919${n.padStart(6, '0')}`,
      authMethod: 'OTP',
      subscriptionStatus: opts.pro ? 'PRO' : 'FREE',
      deletedAt: opts.deleted ? new Date('2031-05-01T00:00:00Z') : null,
    },
  })
  const profiles = []
  for (let i = 0; i < (opts.profiles ?? 1); i++) {
    profiles.push(
      await testPrisma.profile.create({
        data: { id: `${P}-p-${n}-${i}`, userId: user.id, name: 'p', relation: 'SELF' },
      }),
    )
  }
  if (opts.pro) {
    await testPrisma.subscription.create({ data: { userId: user.id, status: 'PRO' } })
  }
  return { user, profiles }
}

const clean = () => testPrisma.user.deleteMany({ where: { id: { startsWith: `${P}-` } } })

afterAll(async () => {
  await clean()
  await testPrisma.$disconnect()
})

describe('dashboard KPIs', () => {
  it('total profiles leaves out deleted users\' profiles', async () => {
    await clean()
    const before = (await getDashboardStats(NOW)).totalProfiles
    await makeUser('a', { profiles: 2 })
    await makeUser('b', { deleted: true, profiles: 3 })
    expect((await getDashboardStats(NOW)).totalProfiles).toBe(before + 2)
  })

  it('logs today counts symptom logs and period logs from the Bangladesh day', async () => {
    await clean()
    const { profiles } = await makeUser('c')
    const pid = profiles[0].id
    const symptom = (createdAt: string) =>
      testPrisma.symptomLog.create({
        data: { profileId: pid, date: new Date('2031-05-10'), category: 'PHYSICAL', symptomId: 'headache', value: 'x', createdAt: new Date(createdAt) },
      })
    await symptom('2031-05-10T03:00:00Z')
    await symptom('2031-05-09T18:30:00Z') // 00:30 on 10 May in Bangladesh: counts
    await symptom('2031-05-09T17:30:00Z') // 23:30 on 9 May in Bangladesh: does not
    await testPrisma.periodLog.create({
      data: { profileId: pid, startDate: new Date('2031-05-10'), endDate: new Date('2031-05-14'), flowIntensity: 'MEDIUM', createdAt: new Date('2031-05-10T04:00:00Z') },
    })
    expect((await getDashboardStats(NOW)).dailyLogs).toBe(3)
  })

  it('Pro count is the same on the dashboard, the subscriptions breakdown and countProUsers', async () => {
    await clean()
    const before = await countProUsers()
    await makeUser('d', { pro: true })
    await makeUser('e', { pro: true, deleted: true }) // a deleted user is not a subscriber
    await makeUser('f')

    const dash = (await getDashboardStats(NOW)).proSubscribers
    const breakdown = await getSubscriptionStatusBreakdown()
    const proOnBreakdown = breakdown.find((r) => r.status === 'PRO')?.count ?? 0
    expect(await countProUsers()).toBe(before + 1)
    expect(dash).toBe(before + 1)
    expect(proOnBreakdown).toBe(before + 1)
  })
})

describe('profile-based engagement metrics skip deleted users', () => {
  it('logging rate and streaks use only live users\' profiles', async () => {
    await clean()
    const range = parseDateRange({ range: '7d' }, NOW)
    const live = await makeUser('g')
    await testPrisma.symptomLog.create({
      data: { profileId: live.profiles[0].id, date: new Date('2031-05-10'), category: 'PHYSICAL', symptomId: 'headache', value: 'x' },
    })
    const totalLive = await testPrisma.profile.count({ where: { user: { deletedAt: null } } })
    const rate = await getSymptomLoggingRate(range, NOW)
    const today = rate.find((r) => r.date === '2031-05-10')!
    expect(today.rate).toBe(Math.round((1 / totalLive) * 100) / 100)

    const beforeStreak = Object.fromEntries((await getLoggingStreakDistribution(range, NOW)).map((b) => [b.bucket, b.count]))
    await makeUser('h', { deleted: true, profiles: 4 })
    const afterStreak = Object.fromEntries((await getLoggingStreakDistribution(range, NOW)).map((b) => [b.bucket, b.count]))
    expect(afterStreak['0']).toBe(beforeStreak['0'])
  })
})
