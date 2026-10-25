import { describe, it, expect, vi, beforeEach } from 'vitest'

// No DB: prisma and the mail adapter are mocked. The real HMAC hashing runs, so a code
// "sent" by the mail mock is what verify has to be given.
const db = vi.hoisted(() => {
  const m = {
    user: { findUnique: vi.fn(), update: vi.fn() },
    emailVerification: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  }
  m.$transaction.mockImplementation(async (fn: (tx: typeof m) => unknown) => fn(m))
  return m
})
const mail = vi.hoisted(() => ({ sendVerificationCodeEmail: vi.fn() }))
const dev = vi.hoisted(() => ({ on: false }))

vi.mock('@vesta/shared/server/db', () => ({ prisma: db }))
vi.mock('@vesta/shared/server/adapters/mail', () => mail)
vi.mock('@vesta/shared/server/dev', () => ({ isDevModeEnabled: () => dev.on }))

const { requestEmailVerification, verifyEmailCode } = await import(
  '@vesta/shared/server/services/email-verification-service'
)

const USER = 'u1'

/** Run a request and hand back the stored challenge row, as verify would find it. */
async function sendCode(email = 'New@Example.com') {
  db.user.findUnique.mockImplementation(async (a: { where: { id?: string; email?: string } }) =>
    a.where.id ? { language: 'EN' } : null,
  )
  db.emailVerification.findFirst.mockResolvedValueOnce(null) // no cooldown
  db.emailVerification.create.mockImplementation(async ({ data }: { data: object }) => ({ id: 'c1', attempts: 0, ...data }))
  const { code } = await requestEmailVerification(USER, email)
  const row = { id: 'c1', attempts: 0, ...db.emailVerification.create.mock.calls.at(-1)![0].data }
  return { code, row }
}

async function codeFails(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toMatchObject({ code })
}

beforeEach(() => {
  vi.clearAllMocks()
  dev.on = false
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => fn(db))
})

describe('requestEmailVerification', () => {
  it('stores a hashed code for the normalised email and mails the plain code', async () => {
    const { code, row } = await sendCode('  New@Example.com ')
    expect(code).toMatch(/^\d{6}$/)
    expect(row.email).toBe('new@example.com')
    expect(row.codeHash).not.toContain(code)
    expect(row.expiresAt.getTime() - Date.now()).toBeGreaterThan(9.9 * 60_000)
    expect(row.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(10 * 60_000)
    expect(mail.sendVerificationCodeEmail).toHaveBeenCalledWith('new@example.com', code, 'en', USER)
  })

  it('mails in Bengali for a BN user', async () => {
    db.user.findUnique.mockImplementation(async (a: { where: { id?: string } }) => (a.where.id ? { language: 'BN' } : null))
    db.emailVerification.findFirst.mockResolvedValueOnce(null)
    db.emailVerification.create.mockResolvedValue({ id: 'c1' })
    await requestEmailVerification(USER, 'a@b.co')
    expect(mail.sendVerificationCodeEmail.mock.calls[0][2]).toBe('bn')
  })

  it('rejects a malformed address with INVALID_EMAIL', async () => {
    await codeFails(requestEmailVerification(USER, 'not-an-email'), 'INVALID_EMAIL')
    expect(mail.sendVerificationCodeEmail).not.toHaveBeenCalled()
  })

  it('rejects an address used by another account with EMAIL_TAKEN', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'someone-else' })
    await codeFails(requestEmailVerification(USER, 'taken@example.com'), 'EMAIL_TAKEN')
    expect(db.emailVerification.create).not.toHaveBeenCalled()
  })

  it('enforces the 60s resend cooldown with OTP_COOLDOWN', async () => {
    db.user.findUnique.mockResolvedValue(null)
    db.emailVerification.findFirst.mockResolvedValueOnce({ createdAt: new Date(Date.now() - 10_000) })
    await codeFails(requestEmailVerification(USER, 'new@example.com'), 'OTP_COOLDOWN')
    expect(mail.sendVerificationCodeEmail).not.toHaveBeenCalled()
  })

  it('drops the challenge when the mail fails to send', async () => {
    db.user.findUnique.mockResolvedValue(null)
    db.emailVerification.findFirst.mockResolvedValueOnce(null)
    db.emailVerification.create.mockResolvedValue({ id: 'c1' })
    mail.sendVerificationCodeEmail.mockRejectedValueOnce(new Error('smtp down'))
    await expect(requestEmailVerification(USER, 'new@example.com')).rejects.toThrow('smtp down')
    expect(db.emailVerification.delete).toHaveBeenCalledWith({ where: { id: 'c1' } })
  })
})

describe('verifyEmailCode', () => {
  it('saves the email when the code is right', async () => {
    const { code, row } = await sendCode()
    db.emailVerification.findFirst.mockResolvedValueOnce(row)
    db.user.findUnique.mockResolvedValue(null) // still free
    db.emailVerification.updateMany.mockResolvedValue({ count: 1 })

    await expect(verifyEmailCode(USER, code)).resolves.toEqual({ email: 'new@example.com' })
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: USER }, data: { email: 'new@example.com' } })
  })

  it('counts a wrong code and does not save', async () => {
    const { row } = await sendCode()
    db.emailVerification.findFirst.mockResolvedValueOnce(row)
    await codeFails(verifyEmailCode(USER, '000000'), 'INVALID_OTP')
    expect(db.emailVerification.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { attempts: { increment: 1 } } })
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it('locks after 5 wrong attempts, even for the right code', async () => {
    const { code, row } = await sendCode()
    db.emailVerification.findFirst.mockResolvedValueOnce({ ...row, attempts: 5 })
    await codeFails(verifyEmailCode(USER, code), 'OTP_LOCKED')
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it('rejects an expired code with CHALLENGE_EXPIRED', async () => {
    const { code, row } = await sendCode()
    db.emailVerification.findFirst.mockResolvedValueOnce({ ...row, expiresAt: new Date(Date.now() - 1000) })
    await codeFails(verifyEmailCode(USER, code), 'CHALLENGE_EXPIRED')
  })

  it('returns CHALLENGE_NOT_FOUND when nothing was requested', async () => {
    db.emailVerification.findFirst.mockResolvedValueOnce(null)
    await codeFails(verifyEmailCode(USER, '123456'), 'CHALLENGE_NOT_FOUND')
  })

  it('returns EMAIL_TAKEN when someone claimed the address after the code was sent', async () => {
    const { code, row } = await sendCode()
    db.emailVerification.findFirst.mockResolvedValueOnce(row)
    db.user.findUnique.mockResolvedValue({ id: 'someone-else' })
    await codeFails(verifyEmailCode(USER, code), 'EMAIL_TAKEN')
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it('maps a racing unique-index violation to EMAIL_TAKEN', async () => {
    const { code, row } = await sendCode()
    db.emailVerification.findFirst.mockResolvedValueOnce(row)
    db.user.findUnique.mockResolvedValue(null)
    db.emailVerification.updateMany.mockResolvedValue({ count: 1 })
    db.user.update.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }))
    await codeFails(verifyEmailCode(USER, code), 'EMAIL_TAKEN')
  })

  it('accepts a dev OTP code only in DEV_MODE', async () => {
    const { row } = await sendCode()
    db.user.findUnique.mockResolvedValue(null)
    db.emailVerification.updateMany.mockResolvedValue({ count: 1 })

    db.emailVerification.findFirst.mockResolvedValueOnce(row)
    await codeFails(verifyEmailCode(USER, '420420'), 'INVALID_OTP')

    dev.on = true
    db.emailVerification.findFirst.mockResolvedValueOnce(row)
    await expect(verifyEmailCode(USER, '420420')).resolves.toEqual({ email: 'new@example.com' })
  })
})
