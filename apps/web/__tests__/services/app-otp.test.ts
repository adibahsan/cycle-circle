import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { testPrisma } from '../helpers/test-db'

// BDApps is the system boundary: stub its getStatus and SMS calls, keep the rest real.
const bdapps = vi.hoisted(() => ({
  getSubscriptionStatus: vi.fn(),
  smsSend: vi.fn(),
}))
vi.mock('@vesta/shared/server/adapters/bdapps', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vesta/shared/server/adapters/bdapps')>()),
  ...bdapps,
}))

const { startAppOtpLogin, verifyAppOtp } = await import('@vesta/shared/server/services/app-otp-service')

const P = 'test-appotp'
const MASKED_ID = 'tel:dGVzdC1hcHAtb3RwOnJvYmk'
const users = {
  subscriber: { id: `${P}-sub`, phone: '+8801910000001' },
  legacy: { id: `${P}-legacy`, phone: '+8801910000002' },
  emailOnly: { id: `${P}-email`, phone: '+8801910000003' },
}
const NO_USER_PHONE = '+8801910000009'

/** The 6-digit code from the last SMS we sent. */
function sentCode(): string {
  const [message] = bdapps.smsSend.mock.calls.at(-1)!
  return /\d{6}/.exec(message)![0]
}

async function cleanup() {
  const ids = Object.values(users).map((u) => u.id)
  const phones = Object.values(users).map((u) => u.phone)
  await testPrisma.otpChallenge.deleteMany({ where: { phone: { in: [...phones, NO_USER_PHONE] } } })
  await testPrisma.subscription.deleteMany({ where: { userId: { in: ids } } })
  await testPrisma.user.deleteMany({ where: { id: { in: ids } } })
}

beforeAll(async () => {
  await cleanup()
  await testPrisma.user.create({
    data: { ...users.subscriber, authMethod: 'OTP', subscriptionStatus: 'PRO' },
  })
  await testPrisma.subscription.create({
    data: { userId: users.subscriber.id, status: 'PRO', bdappsSubscriberId: MASKED_ID },
  })
  // Logged in before masked ids were stored: only the raw phone, which BDApps rejects.
  await testPrisma.user.create({
    data: { ...users.legacy, authMethod: 'OTP', subscriptionStatus: 'PRO' },
  })
  await testPrisma.subscription.create({
    data: { userId: users.legacy.id, status: 'PRO', bdappsSubscriberId: users.legacy.phone },
  })
  await testPrisma.user.create({
    data: { ...users.emailOnly, email: 'appotp-email@test.local', authMethod: 'EMAIL', subscriptionStatus: 'FREE' },
  })
})
afterAll(cleanup)

beforeEach(async () => {
  bdapps.getSubscriptionStatus.mockReset().mockResolvedValue('REGISTERED')
  bdapps.smsSend.mockReset().mockResolvedValue({ messageId: 'MSG1', status: 'S1000' })
  await testPrisma.otpChallenge.deleteMany({ where: { phone: { in: Object.values(users).map((u) => u.phone) } } })
})

describe('App OTP login for an existing subscriber', () => {
  it('sends a 6-digit code by SMS to the stored masked subscriber id', async () => {
    const res = await startAppOtpLogin(users.subscriber.phone, 'en')

    expect(res.kind).toBe('sent')
    expect(bdapps.getSubscriptionStatus).toHaveBeenCalledWith(MASKED_ID)
    expect(bdapps.smsSend).toHaveBeenCalledTimes(1)
    const [message, to] = bdapps.smsSend.mock.calls[0]
    expect(to).toEqual([MASKED_ID])
    expect(message).toMatch(/Cycle Circle/)
    expect(message).not.toMatch(/https?:/)
    expect(sentCode()).toHaveLength(6)
  })
})

describe('App OTP fallback when we cannot SMS the subscriber', () => {
  it('falls back for a number with no account (subscribed outside the site)', async () => {
    expect(await startAppOtpLogin(NO_USER_PHONE, 'en')).toEqual({ kind: 'fallback', hasEmail: false })
    expect(bdapps.smsSend).not.toHaveBeenCalled()
  })

  it('falls back for a legacy row that holds only the raw phone', async () => {
    expect(await startAppOtpLogin(users.legacy.phone, 'en')).toEqual({ kind: 'fallback', hasEmail: false })
    expect(bdapps.smsSend).not.toHaveBeenCalled()
  })

  it('offers email login when the account has an email', async () => {
    expect(await startAppOtpLogin(users.emailOnly.phone, 'en')).toEqual({ kind: 'fallback', hasEmail: true })
  })

  it('falls back without changing the plan when the stored id is no longer registered', async () => {
    bdapps.getSubscriptionStatus.mockResolvedValue('UNREGISTERED')
    expect(await startAppOtpLogin(users.subscriber.phone, 'en')).toEqual({ kind: 'fallback', hasEmail: false })
    expect(bdapps.smsSend).not.toHaveBeenCalled()
    const user = await testPrisma.user.findUnique({ where: { id: users.subscriber.id } })
    expect(user?.subscriptionStatus).toBe('PRO')
  })
})

describe('verifying an App OTP', () => {
  async function start() {
    const res = await startAppOtpLogin(users.subscriber.phone, 'en')
    if (res.kind !== 'sent') throw new Error('expected an App OTP to be sent')
    return { referenceNo: res.referenceNo, code: sentCode() }
  }

  it('logs the subscriber in with the right code and leaves the plan alone', async () => {
    const { referenceNo, code } = await start()
    const user = await verifyAppOtp(referenceNo, code)
    expect(user.id).toBe(users.subscriber.id)
    expect(user.subscriptionStatus).toBe('PRO')
  })

  it('accepts a code only once', async () => {
    const { referenceNo, code } = await start()
    await verifyAppOtp(referenceNo, code)
    await expect(verifyAppOtp(referenceNo, code)).rejects.toMatchObject({ code: 'ALREADY_VERIFIED' })
  })

  it('rejects a wrong code as 400 INVALID_OTP', async () => {
    const { referenceNo, code } = await start()
    const wrong = code === '000000' ? '111111' : '000000'
    await expect(verifyAppOtp(referenceNo, wrong)).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_OTP' })
  })

  it('locks the code after 5 wrong tries, even if the 6th is right', async () => {
    const { referenceNo, code } = await start()
    const wrong = code === '000000' ? '111111' : '000000'
    for (let i = 0; i < 5; i++) {
      await expect(verifyAppOtp(referenceNo, wrong)).rejects.toMatchObject({ code: 'INVALID_OTP' })
    }
    await expect(verifyAppOtp(referenceNo, code)).rejects.toMatchObject({ statusCode: 429, code: 'RATE_LIMITED' })
  })

  it('rejects an expired code', async () => {
    const { referenceNo, code } = await start()
    await testPrisma.otpChallenge.updateMany({ where: { referenceNo }, data: { expiresAt: new Date(Date.now() - 1000) } })
    await expect(verifyAppOtp(referenceNo, code)).rejects.toMatchObject({ code: 'CHALLENGE_EXPIRED' })
  })
})

describe('App OTP abuse limits', () => {
  it('sends at most 5 App OTPs per number per day', async () => {
    for (let i = 0; i < 5; i++) await startAppOtpLogin(users.subscriber.phone, 'en')
    await expect(startAppOtpLogin(users.subscriber.phone, 'en')).rejects.toMatchObject({ statusCode: 429, code: 'RATE_LIMITED' })
    expect(bdapps.smsSend).toHaveBeenCalledTimes(5)
  })
})
