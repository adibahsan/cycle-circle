import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { testPrisma } from '../helpers/test-db'

// BDApps and the mailer are the system boundaries: stub SMS and email sends, keep the rest real.
const bdapps = vi.hoisted(() => ({ smsSend: vi.fn() }))
const mail = vi.hoisted(() => ({ sendEmail: vi.fn() }))
vi.mock('@vesta/shared/server/adapters/bdapps', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vesta/shared/server/adapters/bdapps')>()),
  ...bdapps,
}))
vi.mock('@vesta/shared/server/adapters/mail', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vesta/shared/server/adapters/mail')>()),
  ...mail,
}))

const { ApiError } = await import('@vesta/shared/server/api-error')
const { logger } = await import('@vesta/shared/server/log')
const { runDailyReminders } = await import('@vesta/shared/server/services')

const P = 'test-rem253'
const USER_ID = `${P}-user`
const PROFILE_ID = `${P}-profile`
const MASKED_ID = 'tel:dGVzdC1yZW1pbmRlcjpyb2Jp'
const NOW = new Date('2026-03-10T06:00:00Z') // Bangladesh 03-10, 12:00

type Kind = 'period' | 'fertile' | 'logging' | 'completion'

const cronLog = vi.spyOn(logger, 'cron').mockImplementation(() => {})
const errorLog = vi.spyOn(logger, 'error').mockImplementation(() => {})

/** One user whose only due Reminder is `kind`, with the given stored subscriber id (or none). */
async function seed(kind: Kind, subscriberId: string | null) {
  await testPrisma.user.create({
    data: {
      id: USER_ID,
      phone: '+8801910000253',
      email: 'reminder253@test.local',
      fullName: 'Test Reminder',
      authMethod: 'OTP',
      subscriptionStatus: 'FREE',
      profileCompleted: kind !== 'completion',
      createdAt: new Date('2026-03-05T00:00:00Z'),
    },
  })
  if (subscriberId) {
    await testPrisma.subscription.create({
      data: { userId: USER_ID, status: 'FREE', bdappsSubscriberId: subscriberId },
    })
  }
  if (kind === 'completion') return
  await testPrisma.profile.create({
    data: {
      id: PROFILE_ID,
      userId: USER_ID,
      name: 'Test Profile',
      relation: 'SELF',
      cycleLength: 28,
      periodLength: 5,
      lastPeriodStart: new Date('2026-01-01'),
    },
  })
  await testPrisma.notificationPreference.create({
    data: {
      profileId: PROFILE_ID,
      periodAlert: kind === 'period',
      fertileWindow: kind === 'fertile',
      loggingReminder: kind === 'logging',
    },
  })
  const day = (d: string) => new Date(`${d}T00:00:00Z`)
  await testPrisma.prediction.create({
    data: {
      profileId: PROFILE_ID,
      tier: 'AVERAGE',
      nextPeriodStart: day(kind === 'period' ? '2026-03-11' : '2026-04-20'),
      ovulationDay: day('2026-03-14'),
      fertileStart: day(kind === 'fertile' ? '2026-03-10' : '2026-04-01'),
      fertileEnd: day('2026-03-15'),
      confidence: 0.5,
    },
  })
  if (kind === 'logging') return
  // A recent log keeps the logging reminder out of the other kinds' way (their pref is off anyway).
}

async function cleanup() {
  await testPrisma.user.deleteMany({ where: { id: USER_ID } })
}

const skippedLogs = () => cronLog.mock.calls.filter(([event]) => event === 'notification.sms.skipped')

beforeEach(async () => {
  await cleanup()
  bdapps.smsSend.mockReset().mockResolvedValue({ messageId: 'MSG1', status: 'S1000' })
  mail.sendEmail.mockReset().mockResolvedValue(undefined)
  cronLog.mockClear()
  errorLog.mockClear()
})
afterEach(cleanup)

const run = () => runDailyReminders({ now: NOW, userId: USER_ID, force: true })

describe('reminder SMS goes to the masked subscriber id', () => {
  it.each<[Kind, RegExp]>([
    ['period', /period expected in 1 days/],
    ['fertile', /fertile window starts today/],
    ['logging', /Don't forget to log/],
    ['completion', /profile setup isn't complete/],
  ])('%s reminder is sent to the stored masked id', async (kind, text) => {
    await seed(kind, MASKED_ID)
    await run()

    expect(bdapps.smsSend).toHaveBeenCalledTimes(1)
    const [message, to] = bdapps.smsSend.mock.calls[0]!
    expect(to).toEqual([MASKED_ID])
    expect(message).toMatch(text)
    expect(mail.sendEmail).toHaveBeenCalledTimes(1)
  })
})

describe('no usable masked id', () => {
  it.each<[string, string | null]>([
    ['no subscriber row', null],
    ['a phone-shaped stored id', 'tel:8801910000253'],
  ])('%s: no SMS, one no-masked-id skip log, email still sent', async (_label, stored) => {
    await seed('period', stored)
    await run()

    expect(bdapps.smsSend).not.toHaveBeenCalled()
    expect(skippedLogs()).toHaveLength(1)
    const [, data, extra] = skippedLogs()[0]!
    expect(data).toMatchObject({ alert: 'Period alert', reason: 'no-masked-id' })
    expect(extra).toMatchObject({ level: 'info' })
    expect(mail.sendEmail).toHaveBeenCalledTimes(1)
  })

  it('a Free phone user with no masked id gets no profile-completion SMS attempt', async () => {
    await seed('completion', null)
    await run()

    expect(bdapps.smsSend).not.toHaveBeenCalled()
    expect(skippedLogs()).toHaveLength(1)
  })
})

describe('SMS send errors', () => {
  it('E1951 is a warn-level unregistered skip, not a failure', async () => {
    await seed('period', MASKED_ID)
    bdapps.smsSend.mockRejectedValue(new ApiError(502, 'invalid address', 'BDAPPS_E1951'))
    await run()

    expect(skippedLogs()).toHaveLength(1)
    const [, data, extra] = skippedLogs()[0]!
    expect(data).toMatchObject({ alert: 'Period alert', reason: 'unregistered' })
    expect(extra).toMatchObject({ level: 'warn' })
    expect(errorLog.mock.calls.filter(([event]) => event === 'notification.sms.failed')).toHaveLength(0)
  })

  it('any other error is still logged as notification.sms.failed', async () => {
    await seed('period', MASKED_ID)
    bdapps.smsSend.mockRejectedValue(new Error('BDApps down'))
    await run()

    const failed = errorLog.mock.calls.filter(([event]) => event === 'notification.sms.failed')
    expect(failed).toHaveLength(1)
    expect(failed[0]![2]).toMatchObject({ alert: 'Period alert' })
    expect(skippedLogs()).toHaveLength(0)
  })
})
