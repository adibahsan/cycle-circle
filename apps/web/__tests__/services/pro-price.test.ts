import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { testPrisma } from '../helpers/test-db'
import {
  getProPriceOn,
  getCurrentProPrice,
  setProPrice,
  listProPriceHistory,
  AUDIT_ACTIONS,
} from '@vesta/shared/server/services'
import { withProPriceStates } from '@vesta/shared/utils/pro-price-state'

const ADMIN = 'test-proprice-admin'
// Far-future days keep these entries clear of the seeded first entry (5 taka/day from 2000-01-01).
const NOW = new Date('2045-05-01T06:00:00Z') // Bangladesh 2045-05-01 12:00

async function cleanup() {
  await testPrisma.proPrice.deleteMany({ where: { createdBy: ADMIN } })
  await testPrisma.adminAuditLog.deleteMany({ where: { adminId: ADMIN } })
  await testPrisma.user.deleteMany({ where: { id: ADMIN } })
}

describe('Pro price (db)', () => {
  beforeAll(async () => {
    await cleanup()
    await testPrisma.user.create({
      data: { id: ADMIN, phone: '+8801940000021', fullName: 'Price Admin', authMethod: 'OTP', profileCompleted: true },
    })
  })
  afterAll(cleanup)
  beforeEach(async () => {
    await testPrisma.proPrice.deleteMany({ where: { createdBy: ADMIN } })
  })

  it('starts at 5 taka per day, seeded by the migration', async () => {
    const p = await getProPriceOn('2044-01-01')
    expect(p).toMatchObject({ amount: 5, period: 'DAILY', createdBy: null })
  })

  it('a price change applies from its effective day, not before', async () => {
    await setProPrice(ADMIN, { amount: 7.5, period: 'DAILY', effectiveFrom: '2045-05-10' }, NOW)
    expect((await getProPriceOn('2045-05-09'))?.amount).toBe(5)
    expect(await getProPriceOn('2045-05-10')).toMatchObject({
      amount: 7.5,
      period: 'DAILY',
      effectiveFrom: '2045-05-10',
      createdByName: 'Price Admin',
    })
    expect((await getProPriceOn('2045-06-01'))?.amount).toBe(7.5)
  })

  it('defaults the effective day to today in Bangladesh', async () => {
    const e = await setProPrice(ADMIN, { amount: 6, period: 'WEEKLY' }, NOW)
    expect(e.effectiveFrom).toBe('2045-05-01')
    expect(await getCurrentProPrice(NOW)).toMatchObject({ amount: 6, period: 'WEEKLY' })
  })

  it('switches at 00:00 Bangladesh time, which is 18:00 UTC the day before', async () => {
    await setProPrice(ADMIN, { amount: 9, period: 'MONTHLY', effectiveFrom: '2045-05-02' }, NOW)
    expect((await getCurrentProPrice(new Date('2045-05-01T17:59:59.999Z')))?.amount).toBe(5)
    expect((await getCurrentProPrice(new Date('2045-05-01T18:00:00.000Z')))?.amount).toBe(9)
  })

  it('on the same effective day the newest entry wins and both stay in history', async () => {
    await setProPrice(ADMIN, { amount: 8, period: 'DAILY', effectiveFrom: '2045-05-05' }, NOW)
    await setProPrice(ADMIN, { amount: 10, period: 'DAILY', effectiveFrom: '2045-05-05' }, NOW)
    expect((await getProPriceOn('2045-05-05'))?.amount).toBe(10)
    const mine = (await listProPriceHistory()).filter((e) => e.createdBy === ADMIN)
    expect(mine.map((e) => e.amount)).toEqual([10, 8])
  })

  it('the state shown for each entry agrees with the price the service picks', async () => {
    await setProPrice(ADMIN, { amount: 6, period: 'DAILY', effectiveFrom: '2045-05-01' }, NOW)
    await setProPrice(ADMIN, { amount: 7, period: 'DAILY', effectiveFrom: '2045-05-20' }, NOW)
    await setProPrice(ADMIN, { amount: 8, period: 'DAILY', effectiveFrom: '2045-05-20' }, NOW)
    const states = withProPriceStates(await listProPriceHistory(), '2045-05-01')
    const inEffect = states.filter((x) => x.state === 'IN_EFFECT')
    expect(inEffect).toHaveLength(1)
    expect(inEffect[0].id).toBe((await getCurrentProPrice(NOW))!.id)
    expect(states.find((x) => x.amount === 7)?.state).toBe('REPLACED')
    expect(states.find((x) => x.amount === 8)?.state).toBe('SCHEDULED')
    expect((await getProPriceOn('2045-05-20'))!.amount).toBe(8)
  })

  it('lists history newest effective day first, including the seeded entry', async () => {
    await setProPrice(ADMIN, { amount: 7, period: 'DAILY', effectiveFrom: '2045-05-03' }, NOW)
    await setProPrice(ADMIN, { amount: 12, period: 'WEEKLY', effectiveFrom: '2045-05-20' }, NOW)
    const all = await listProPriceHistory()
    expect(all.map((e) => e.effectiveFrom).slice(0, 2)).toEqual(['2045-05-20', '2045-05-03'])
    expect(all[all.length - 1]).toMatchObject({ amount: 5, period: 'DAILY', effectiveFrom: '2000-01-01' })
  })

  it.each([
    [0, 'DAILY'],
    [-3, 'DAILY'],
    [Number.NaN, 'DAILY'],
    [Number.POSITIVE_INFINITY, 'DAILY'],
    ['5', 'DAILY'],
    [5.123, 'DAILY'],
    [1_000_000, 'DAILY'],
    [5, 'YEARLY'],
    [5, undefined],
  ])('refuses amount %s with period %s and writes nothing', async (amount, period) => {
    const before = await testPrisma.proPrice.count()
    await expect(setProPrice(ADMIN, { amount, period } as never, NOW)).rejects.toThrow()
    expect(await testPrisma.proPrice.count()).toBe(before)
  })

  it.each(['2045-02-31', '10/05/2045', '', '2045-5-1'])('refuses effective day %j', async (effectiveFrom) => {
    await expect(setProPrice(ADMIN, { amount: 5, period: 'DAILY', effectiveFrom }, NOW)).rejects.toThrow(/day/i)
  })

  it('refuses an effective day already past, so history is not rewritten', async () => {
    await expect(setProPrice(ADMIN, { amount: 5, period: 'DAILY', effectiveFrom: '2045-04-30' }, NOW)).rejects.toThrow(
      /past/i,
    )
  })

  it('writes an audit row with the old and new price', async () => {
    const e = await setProPrice(ADMIN, { amount: 7, period: 'WEEKLY', effectiveFrom: '2045-05-12' }, NOW)
    const row = await testPrisma.adminAuditLog.findFirst({
      where: { adminId: ADMIN, action: AUDIT_ACTIONS.PRO_PRICE_SET, targetId: e.id },
    })
    expect(row).toBeTruthy()
    expect(row?.targetType).toBe('ProPrice')
    expect(row?.metadata).toMatchObject({
      to: { amount: 7, period: 'WEEKLY', effectiveFrom: '2045-05-12' },
      from: { amount: 5, period: 'DAILY' },
    })
  })
})
