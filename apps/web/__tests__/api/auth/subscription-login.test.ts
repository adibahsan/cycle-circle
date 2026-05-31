import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/app/api/auth/subscription/rate-limit', () => ({
  checkSubscriptionRateLimit: vi.fn(),
}))
vi.mock('@vesta/shared/server/adapters/bdapps', () => ({
  subscriptionGetStatus: vi.fn(),
  subscriptionSend: vi.fn(),
}))
vi.mock('@vesta/shared/server/auth', () => ({
  validateMsisdn: vi.fn(),
  issueJwt: vi.fn(),
  setAuthCookie: vi.fn(),
}))
vi.mock('@vesta/shared/server/services', () => ({
  completeSubscriptionLogin: vi.fn(),
}))

import { POST as POST_STATUS } from '../../../src/app/api/auth/subscription/status/route'
import { POST as POST_REQUEST } from '../../../src/app/api/auth/subscription/request/route'
import * as rateLimit from '../../../src/app/api/auth/subscription/rate-limit'
import * as bdapps from '@vesta/shared/server/adapters/bdapps'
import * as auth from '@vesta/shared/server/auth'
import * as services from '@vesta/shared/server/services'
import { ApiError } from '@vesta/shared/server/api-error'

const PHONE = '+8801700000000'

function makeRequest(path: string) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(auth.validateMsisdn).mockReturnValue(PHONE)
  vi.mocked(auth.issueJwt).mockResolvedValue('jwt-token')
  vi.mocked(auth.setAuthCookie).mockResolvedValue(undefined)
  vi.mocked(rateLimit.checkSubscriptionRateLimit).mockReturnValue({ allowed: true, remaining: 2 })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('POST /api/auth/subscription/status', () => {
  it('completes login when the subscriber is registered', async () => {
    vi.mocked(bdapps.subscriptionGetStatus).mockResolvedValue({
      statusCode: 'S1000',
      statusDetail: 'Request was successfully processed',
      subscriptionStatus: 'REGISTERED',
      subscriberId: 'tel:+8801700000000',
    } as never)
    vi.mocked(services.completeSubscriptionLogin).mockResolvedValue({
      id: 'user-1',
      phone: PHONE,
      role: 'USER',
      authMethod: 'SUBSCRIPTION',
      subscriptionStatus: 'PRO',
      profileCompleted: true,
    } as never)

    const response = await POST_STATUS(makeRequest('/api/auth/subscription/status'))

    expect(response.status).toBe(200)
    expect(bdapps.subscriptionGetStatus).toHaveBeenCalledWith(PHONE)
    expect(services.completeSubscriptionLogin).toHaveBeenCalledWith(PHONE, 'tel:+8801700000000', 5)
    expect(auth.issueJwt).toHaveBeenCalledWith({
      sub: 'user-1',
      phone: PHONE,
      role: 'USER',
    })
    expect(auth.setAuthCookie).toHaveBeenCalledWith('jwt-token')
    expect(await response.json()).toEqual({
      authenticated: true,
      subscriptionStatus: 'REGISTERED',
      user: {
        id: 'user-1',
        phone: PHONE,
        authMethod: 'SUBSCRIPTION',
        subscriptionStatus: 'PRO',
        profileCompleted: true,
      },
      token: 'jwt-token',
    })
  })

  it('returns an unauthenticated payload when the subscriber is unregistered', async () => {
    vi.mocked(bdapps.subscriptionGetStatus).mockResolvedValue({
      statusCode: 'S1000',
      statusDetail: 'not registered',
      subscriptionStatus: 'UNREGISTERED',
      subscriberId: 'tel:+8801700000000',
    } as never)

    const response = await POST_STATUS(makeRequest('/api/auth/subscription/status'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      authenticated: false,
      subscriptionStatus: 'UNREGISTERED',
      message: 'Subscription not registered',
    })
  })

  it('rejects invalid phone numbers', async () => {
    vi.mocked(auth.validateMsisdn).mockImplementation(() => {
      throw new ApiError(400, 'Invalid Bangladeshi phone number', 'INVALID_PHONE')
    })

    const response = await POST_STATUS(
      new Request('http://localhost/api/auth/subscription/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '123' }),
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: {
        message: 'Invalid Bangladeshi phone number',
        code: 'INVALID_PHONE',
      },
    })
    expect(bdapps.subscriptionGetStatus).not.toHaveBeenCalled()
  })

  it('returns rate-limited responses when the request budget is exhausted', async () => {
    vi.mocked(rateLimit.checkSubscriptionRateLimit).mockReturnValue({
      allowed: false,
      remaining: 0,
    })

    const response = await POST_STATUS(makeRequest('/api/auth/subscription/status'))

    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({
      error: {
        message: 'Too many subscription status requests. Try again in a minute.',
        code: 'RATE_LIMITED',
      },
    })
    expect(bdapps.subscriptionGetStatus).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/subscription/request', () => {
  it('calls send and completes login when the subscriber is registered', async () => {
    vi.mocked(bdapps.subscriptionSend).mockResolvedValue({
      statusCode: 'S1000',
      statusDetail: 'Request was successfully processed',
      subscriptionStatus: 'REGISTERED',
      subscriberId: 'tel:+8801700000000',
    } as never)
    vi.mocked(services.completeSubscriptionLogin).mockResolvedValue({
      id: 'user-2',
      phone: PHONE,
      role: 'USER',
      authMethod: 'SUBSCRIPTION',
      subscriptionStatus: 'PRO',
      profileCompleted: true,
    } as never)

    const response = await POST_REQUEST(makeRequest('/api/auth/subscription/request'))

    expect(response.status).toBe(200)
    expect(bdapps.subscriptionSend).toHaveBeenCalledWith(PHONE, '1')
    expect(services.completeSubscriptionLogin).toHaveBeenCalledWith(PHONE, 'tel:+8801700000000', 5)
    expect(auth.issueJwt).toHaveBeenCalledWith({
      sub: 'user-2',
      phone: PHONE,
      role: 'USER',
    })
    expect(auth.setAuthCookie).toHaveBeenCalledWith('jwt-token')
    expect(await response.json()).toEqual({
      authenticated: true,
      subscriptionStatus: 'REGISTERED',
      user: {
        id: 'user-2',
        phone: PHONE,
        authMethod: 'SUBSCRIPTION',
        subscriptionStatus: 'PRO',
        profileCompleted: true,
      },
      token: 'jwt-token',
    })
  })

  it('returns a pending payload when the subscriber is still unregistered', async () => {
    vi.mocked(bdapps.subscriptionSend).mockResolvedValue({
      statusCode: 'S1000',
      statusDetail: 'not registered',
      subscriptionStatus: 'UNREGISTERED',
      subscriberId: 'tel:+8801700000000',
    } as never)

    const response = await POST_REQUEST(makeRequest('/api/auth/subscription/request'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      authenticated: false,
      pending: true,
      subscriptionStatus: 'UNREGISTERED',
      message: 'Subscription registration pending',
    })
    expect(services.completeSubscriptionLogin).not.toHaveBeenCalled()
  })

  it('rejects invalid phone numbers', async () => {
    vi.mocked(auth.validateMsisdn).mockImplementation(() => {
      throw new ApiError(400, 'Invalid Bangladeshi phone number', 'INVALID_PHONE')
    })

    const response = await POST_REQUEST(
      new Request('http://localhost/api/auth/subscription/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '123' }),
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: {
        message: 'Invalid Bangladeshi phone number',
        code: 'INVALID_PHONE',
      },
    })
    expect(bdapps.subscriptionSend).not.toHaveBeenCalled()
  })

  it('rejects rate-limited requests', async () => {
    vi.mocked(rateLimit.checkSubscriptionRateLimit).mockReturnValue({
      allowed: false,
      remaining: 0,
    })

    const response = await POST_REQUEST(makeRequest('/api/auth/subscription/request'))

    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({
      error: {
        message: 'Too many subscription requests. Try again in a minute.',
        code: 'RATE_LIMITED',
      },
    })
    expect(bdapps.subscriptionSend).not.toHaveBeenCalled()
  })
})
