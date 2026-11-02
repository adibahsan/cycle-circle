import { describe, it, expect, vi, beforeEach } from 'vitest'

// #254: logging in copies the vesta_lang cookie to User.language, so a Bengali
// choice made before login reaches reminders and emails.
const jar = new Map<string, string>()
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}))

const svc = vi.hoisted(() => ({
  findMagicLink: vi.fn(),
  completeMagicLinkAuth: vi.fn(),
  findOtpChallenge: vi.fn(),
  verifyAppOtp: vi.fn(),
  completeOtpAuth: vi.fn(),
  setUserLanguage: vi.fn(),
}))
vi.mock('@vesta/shared/server/services', () => svc)
vi.mock('@vesta/shared/server/auth', () => ({
  WEB_AUDIENCE: 'web',
  issueJwt: vi.fn(async () => 'jwt'),
  setAuthCookie: vi.fn(async () => {}),
}))
vi.mock('@vesta/shared/server/adapters/redis', () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true })) }))
vi.mock('@vesta/shared/utils/env', () => ({ env: { APP_URL: 'https://cycle-circle.com' } }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@/app/api/auth/log-failure', () => ({ logCustomerRefusal: vi.fn() }))

import { GET as magicLinkCallback } from '@/app/api/auth/magic-link/callback/route'
import { POST as otpVerify } from '@/app/api/auth/otp/verify/route'

const USER = { id: 'u1', email: 'a@b.c', phone: '+8801700000001', role: 'USER', profileCompleted: true, subscriptionStatus: 'FREE' }

const loginByMagicLink = () =>
  magicLinkCallback(new Request('http://localhost:3000/api/auth/magic-link/callback?token=t'))

const loginByOtp = () =>
  otpVerify(new Request('http://localhost:3000/api/auth/otp/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ referenceNo: 'ref-1', otp: '123456' }),
  }))

beforeEach(() => {
  jar.clear()
  Object.values(svc).forEach((fn) => fn.mockReset())
  svc.findMagicLink.mockResolvedValue({ id: 'ml', email: 'a@b.c', used: false, expiresAt: new Date(Date.now() + 60_000) })
  svc.completeMagicLinkAuth.mockResolvedValue(USER)
  // App OTP (existing subscriber): the service checks the code.
  svc.findOtpChallenge.mockResolvedValue({ id: 'c1', phone: USER.phone, codeHash: 'h' })
  svc.verifyAppOtp.mockResolvedValue(USER)
  svc.setUserLanguage.mockResolvedValue(undefined)
})

describe.each([
  ['magic link', loginByMagicLink],
  ['phone OTP', loginByOtp],
])('login by %s', (_label, login) => {
  it('with vesta_lang=bn saves BN to the User', async () => {
    jar.set('vesta_lang', 'bn')
    await login()
    expect(svc.setUserLanguage).toHaveBeenCalledWith('u1', 'bn')
  })

  it('without a language cookie leaves the saved language alone', async () => {
    await login()
    expect(svc.setUserLanguage).not.toHaveBeenCalled()
  })

  it('still logs in when saving the language fails', async () => {
    jar.set('vesta_lang', 'bn')
    svc.setUserLanguage.mockRejectedValue(new Error('db down'))
    const res = await login()
    expect(res.status).toBeLessThan(400)
  })
})

// #258: a magic link carries the requesting page's language; the browser that
// opens it may have no cookie or a different one.
describe('login by magic link with a stored language', () => {
  beforeEach(() => {
    svc.findMagicLink.mockResolvedValue({ id: 'ml', email: 'a@b.c', used: false, expiresAt: new Date(Date.now() + 60_000), language: 'BN' })
  })

  it('saves the stored language when the opening browser has no cookie', async () => {
    await loginByMagicLink()
    expect(svc.setUserLanguage).toHaveBeenCalledWith('u1', 'bn')
  })

  it('saves the stored language over the opening browser\'s cookie', async () => {
    jar.set('vesta_lang', 'en')
    await loginByMagicLink()
    expect(svc.setUserLanguage).toHaveBeenCalledWith('u1', 'bn')
    expect(svc.setUserLanguage).toHaveBeenCalledTimes(1)
  })
})
