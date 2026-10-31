// Counts every Pro user, so it runs in the serial group (see vitest.config.ts).
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { testPrisma } from '../helpers/test-db'
import { getProSnapshots, snapshotProCount } from '@vesta/shared/server/services'

const P = 'test-prosnap'
const u = (n: string) => `${P}-${n}`
const YEAR = { gte: new Date('2032-01-01'), lt: new Date('2033-01-01') }

async function seedPro(n: string, phoneSuffix: number) {
  await testPrisma.user.create({
    data: { id: u(n), phone: `+8801970${String(phoneSuffix).padStart(6, '0')}`, authMethod: 'OTP', subscriptionStatus: 'PRO' },
  })
}

async function cleanup() {
  await testPrisma.proSnapshot.deleteMany({ where: { day: YEAR } })
  await testPrisma.user.deleteMany({ where: { id: { startsWith: P } } })
}

beforeAll(cleanup)
beforeEach(cleanup)
afterAll(async () => {
  await cleanup()
  await testPrisma.$disconnect()
})

describe('Pro snapshot', () => {
  it('stores one row per Bangladesh day: a re-run the same day overwrites', async () => {
    // 19:30 UTC on 10 March is 01:30 on 11 March in Bangladesh
    const a = await snapshotProCount(new Date('2032-03-10T19:30:00Z'))
    expect(a.day).toBe('2032-03-11')
    await seedPro('snap', 8)
    const b = await snapshotProCount(new Date('2032-03-10T23:00:00Z'))
    expect(b.day).toBe('2032-03-11')
    expect(b.proCount).toBe(a.proCount + 1)
    expect(await testPrisma.proSnapshot.count({ where: { day: new Date('2032-03-11') } })).toBe(1)
  })

  it('does not count deleted users, and reads back a range', async () => {
    await seedPro('keep', 9)
    await seedPro('gone', 10)
    const before = (await snapshotProCount(new Date('2032-03-12T06:00:00Z'))).proCount
    await testPrisma.user.update({ where: { id: u('gone') }, data: { deletedAt: new Date() } })
    const after = (await snapshotProCount(new Date('2032-03-13T06:00:00Z'))).proCount
    expect(after).toBe(before - 1)
    expect(await getProSnapshots({ from: '2032-03-12', to: '2032-03-13' })).toEqual([
      { day: '2032-03-12', proCount: before },
      { day: '2032-03-13', proCount: after },
    ])
  })
})
