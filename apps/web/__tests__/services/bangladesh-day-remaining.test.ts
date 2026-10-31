import { describe, it, expect, afterAll } from 'vitest'
import { testPrisma } from '../helpers/test-db'
import { loadRecentSymptomPattern, wasEmailSentToday, wasEmailSentTodayForUser } from '@vesta/shared/server/services'

// Ticket 175 (spec https://github.com/adibahsan/cycle-circle/issues/167): the last server sites
// that read "today". Services take `now`; the day is the Bangladesh day (UTC+6).
// Fixtures sit in 2016 and use the `bd175-` id prefix.

const P = 'bd175'
const at = (iso: string) => new Date(iso)
const stored = (day: string) => new Date(`${day}T00:00:00Z`)

async function makeUser(n: string) {
  const user = await testPrisma.user.create({
    data: { id: `${P}-u-${n}`, phone: `+8801775${n.padStart(6, '0')}`, fullName: `bd175 ${n}`, authMethod: 'OTP' },
  })
  const profile = await testPrisma.profile.create({
    data: { id: `${P}-p-${n}`, userId: user.id, name: 'p', relation: 'SELF', cycleLength: 28, periodLength: 5 },
  })
  return { user, profile }
}

afterAll(async () => {
  await testPrisma.emailLog.deleteMany({ where: { profileId: { startsWith: `${P}-` } } })
  await testPrisma.emailLog.deleteMany({ where: { userId: { startsWith: `${P}-` } } })
  await testPrisma.user.deleteMany({ where: { id: { startsWith: `${P}-` } } })
  await testPrisma.$disconnect()
})

describe('loadRecentSymptomPattern includes the Bangladesh today', () => {
  it.each([
    ['23:59Z', '2016-08-10T23:59:00Z'],
    ['18:30Z', '2016-08-10T18:30:00Z'],
  ])('at %s a log on the next Bangladesh day (2016-08-11) is counted', async (_l, iso) => {
    const { profile } = await makeUser('1')
    await testPrisma.symptomLog.create({
      data: { profileId: profile.id, date: stored('2016-08-11'), category: 'PHYSICAL', symptomId: 'headache', value: 'x' },
    })
    const pattern = await loadRecentSymptomPattern(profile.id, at(iso))
    expect(pattern).toEqual([{ symptomId: 'headache', count: 1 }])
    await testPrisma.user.deleteMany({ where: { id: `${P}-u-1` } })
  })

  it('at 17:59Z (Bangladesh 23:59 on the 10th) a log dated the 11th is not yet counted', async () => {
    const { profile } = await makeUser('2')
    await testPrisma.symptomLog.create({
      data: { profileId: profile.id, date: stored('2016-08-11'), category: 'PHYSICAL', symptomId: 'headache', value: 'x' },
    })
    expect(await loadRecentSymptomPattern(profile.id, at('2016-08-10T17:59:00Z'))).toEqual([])
  })
})

describe('"already emailed today" resets at Bangladesh midnight', () => {
  async function sentAt(profileId: string, userId: string, sentAtIso: string) {
    await testPrisma.emailLog.create({
      data: {
        type: 'LOGGING_REMINDER', to: 'a@example.com', subject: 's', status: 'SENT', provider: 'RESEND',
        profileId, userId, sentAt: at(sentAtIso),
      },
    })
  }

  it('an email sent 19:00Z on day D counts as sent on Bangladesh day D+1, not D', async () => {
    const { user, profile } = await makeUser('3')
    await sentAt(profile.id, user.id, '2016-09-09T19:00:00Z') // Bangladesh 2016-09-10 01:00
    // Still Bangladesh 09-10 at 10:00Z: sent today.
    expect(await wasEmailSentToday('LOGGING_REMINDER', profile.id, at('2016-09-10T10:00:00Z'))).toBe(true)
    expect(await wasEmailSentTodayForUser('LOGGING_REMINDER', user.id, at('2016-09-10T10:00:00Z'))).toBe(true)
    // The next Bangladesh day has begun at 18:00Z: not sent today.
    expect(await wasEmailSentToday('LOGGING_REMINDER', profile.id, at('2016-09-10T19:00:00Z'))).toBe(false)
    expect(await wasEmailSentTodayForUser('LOGGING_REMINDER', user.id, at('2016-09-10T19:00:00Z'))).toBe(false)
  })

  it('an email sent 17:30Z (Bangladesh 23:30 the day before) does not count for the next day', async () => {
    const { user, profile } = await makeUser('4')
    await sentAt(profile.id, user.id, '2016-09-09T17:30:00Z') // Bangladesh 2016-09-09 23:30
    expect(await wasEmailSentToday('LOGGING_REMINDER', profile.id, at('2016-09-09T18:30:00Z'))).toBe(false)
  })
})
