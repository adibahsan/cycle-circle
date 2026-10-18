import { describe, it, expect, afterAll } from 'vitest'
import { testPrisma } from '../helpers/test-db'
import { getSymptomsByCategory, getPredictionAccuracy } from '@vesta/shared/server/services'

// Ticket #103: panels without a range gain an optional one. Hand-built rows in a
// 2016 window so other rows in the DB never fall inside it. Ids use `an103-`.

const d = (s: string) => new Date(`${s}T00:00:00Z`)
const P = 'an103'

afterAll(async () => {
  await testPrisma.user.deleteMany({ where: { id: { startsWith: `${P}-` } } })
  await testPrisma.$disconnect()
})

async function makeProfile(n: string) {
  const user = await testPrisma.user.create({
    data: { id: `${P}-u-${n}`, phone: `+88018${n.padStart(8, '0')}`, fullName: `an103 ${n}`, authMethod: 'OTP' },
  })
  return testPrisma.profile.create({
    data: { id: `${P}-p-${n}`, userId: user.id, name: 'p', relation: 'SELF', cycleLength: 28, periodLength: 5 },
  })
}

describe('getSymptomsByCategory range', () => {
  it('counts only logs dated inside the range when one is given', async () => {
    const p = await makeProfile('1')
    for (const date of ['2016-03-01', '2016-03-10', '2016-06-01']) {
      await testPrisma.symptomLog.create({
        data: { profileId: p.id, date: d(date), category: 'PHYSICAL', symptomId: 'cramps', value: 'x' },
      })
    }
    const inRange = await getSymptomsByCategory({ from: d('2016-03-01'), to: d('2016-03-31') })
    expect(inRange.find((r) => r.category === 'PHYSICAL')?.count).toBe(2)
    const none = await getSymptomsByCategory({ from: d('2016-01-01'), to: d('2016-01-31') })
    expect(none.find((r) => r.category === 'PHYSICAL')).toBeUndefined()
  })
})

describe('getPredictionAccuracy range', () => {
  it('counts only predictions updated inside the range when one is given', async () => {
    const p = await makeProfile('2')
    await testPrisma.prediction.create({
      data: {
        profileId: p.id,
        tier: 'AVERAGE',
        nextPeriodStart: d('2016-04-01'),
        ovulationDay: d('2016-04-01'),
        fertileStart: d('2016-04-01'),
        fertileEnd: d('2016-04-01'),
        confidence: 0.5,
        updatedAt: d('2016-04-05'),
      },
    })
    const inRange = await getPredictionAccuracy({ from: d('2016-04-01'), to: d('2016-04-30') })
    expect(inRange.find((r) => r.tier === 'AVERAGE')).toMatchObject({ count: 1, avgConfidence: 0.5 })
    const none = await getPredictionAccuracy({ from: d('2016-05-01'), to: d('2016-05-31') })
    expect(none.find((r) => r.tier === 'AVERAGE')).toBeUndefined()
  })
})
