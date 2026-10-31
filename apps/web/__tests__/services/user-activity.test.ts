import { describe, it, expect, afterAll } from 'vitest'
import { testPrisma } from '../helpers/test-db'
import { recordUserActivity, getDailyActiveUsers } from '@vesta/shared/server/services'

// Ticket 206 (spec #192): active users are recorded once per user per Bangladesh day.
// Fixtures sit in a 2017 window so other rows never fall inside it. Rows use the `ua206-` prefix.

const P = 'ua206'
const at = (iso: string) => new Date(iso)

async function makeUser(n: string, extra: Record<string, unknown> = {}) {
  return testPrisma.user.create({
    data: { id: `${P}-u-${n}`, phone: `+8801718${n.padStart(6, '0')}`, authMethod: 'OTP', ...extra },
  })
}

const countOn = async (day: string, now: Date) => {
  const series = await getDailyActiveUsers({ dateFrom: at(`${day}T00:00:00+06:00`), dateTo: at(`${day}T23:59:59+06:00`) }, now)
  return series.find((r) => r.date === day)?.count
}

afterAll(async () => {
  await testPrisma.user.deleteMany({ where: { id: { startsWith: `${P}-` } } })
  await testPrisma.$disconnect()
})

describe('recordUserActivity', () => {
  it('counts a user once per Bangladesh day however often it is called', async () => {
    const u = await makeUser('1')
    const now = at('2017-03-10T05:00:00Z')
    await recordUserActivity(u.id, now)
    await recordUserActivity(u.id, at('2017-03-10T09:00:00Z'))
    expect(await testPrisma.userActivity.count({ where: { userId: u.id } })).toBe(1)
    expect(await countOn('2017-03-10', now)).toBeGreaterThanOrEqual(1)
  })

  it('splits the Bangladesh day at 18:00Z', async () => {
    const u = await makeUser('2')
    await recordUserActivity(u.id, at('2017-03-10T17:59:59Z')) // Bangladesh 2017-03-10 23:59
    await recordUserActivity(u.id, at('2017-03-10T18:00:00Z')) // Bangladesh 2017-03-11 00:00
    const rows = await testPrisma.userActivity.findMany({ where: { userId: u.id }, orderBy: { day: 'asc' } })
    expect(rows.map((r) => r.day.toISOString().slice(0, 10))).toEqual(['2017-03-10', '2017-03-11'])
  })

  it('never records suspended or deleted users', async () => {
    const s = await makeUser('3', { suspendedAt: at('2017-01-01T00:00:00Z') })
    const d = await makeUser('4', { deletedAt: new Date() }) // real clock: 2017 would sit inside nightly-maintenance's purge window
    await recordUserActivity(s.id, at('2017-03-10T05:00:00Z'))
    await recordUserActivity(d.id, at('2017-03-10T05:00:00Z'))
    expect(await testPrisma.userActivity.count({ where: { userId: { in: [s.id, d.id] } } })).toBe(0)
  })
})

describe('getDailyActiveUsers', () => {
  it('counts a user who was active and later suspended or deleted as not active', async () => {
    const a = await makeUser('5')
    const b = await makeUser('6')
    const c = await makeUser('7')
    const now = at('2017-04-10T05:00:00Z')
    for (const u of [a, b, c]) await recordUserActivity(u.id, now)
    const base = await countOn('2017-04-10', now)
    await testPrisma.user.update({ where: { id: b.id }, data: { suspendedAt: now } })
    await testPrisma.user.update({ where: { id: c.id }, data: { deletedAt: new Date() } })
    expect(await countOn('2017-04-10', now)).toBe(base! - 2)
  })

  it('gap-fills days with zero and ends the range at the Bangladesh today', async () => {
    const series = await getDailyActiveUsers(3, at('2017-05-10T18:30:00Z'))
    expect(series.map((r) => r.date)).toEqual(['2017-05-09', '2017-05-10', '2017-05-11'])
  })
})
