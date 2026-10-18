import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Pin the env the adapter reads at import time: production base URL, no dev shortcuts.
vi.mock('@vesta/shared/utils/env', () => ({
  env: {
    BDAPPS_APP_ID: 'APP_TEST',
    BDAPPS_PASSWORD: 'secret',
    BDAPPS_BASE_URL: 'https://bdapps.test',
    BDAPPS_SIMULATOR_BASE_URL: undefined,
    NODE_ENV: 'production',
    DEV_MODE: false,
    APP_URL: 'https://cycle-circle.com',
  },
}))

const {
  requestOtp,
  verifyOtp,
  getSubscriptionStatus,
  setSubscription,
  smsSend,
  normalizeSubscriptionStatus,
  phoneFromSubscriberId,
  isSubscribed,
  storedSubscriberId,
  isPhoneSubscriberId,
} = await import('@vesta/shared/server/adapters/bdapps')

const MASKED = 'ZTk2ZTk1OGEwN2IzNWI2NTlkOGQ4N2I0Njg4ODgwOTVlYThlOWUyMmE4NGU4ZTEwYzE5NzVhZWMyNDI5NGI1Nzpyb2Jp'

const fetchMock = vi.fn()

function reply(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  )
}

function sentBody(call = 0) {
  return JSON.parse(fetchMock.mock.calls[call][1].body as string)
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('BDApps subscription adapter', () => {
  it('requests an OTP on /subscription/otp/request with a tel: subscriber and app metadata', async () => {
    reply({ statusCode: 'S1000', referenceNo: 'REF1' })
    const res = await requestOtp('+8801805718862')
    expect(fetchMock.mock.calls[0][0]).toBe('https://bdapps.test/subscription/otp/request')
    expect(sentBody()).toMatchObject({
      applicationId: 'APP_TEST',
      password: 'secret',
      subscriberId: 'tel:8801805718862',
      applicationMetaData: { client: 'WEBAPP', appCode: 'https://cycle-circle.com' },
    })
    expect(res.referenceNo).toBe('REF1')
  })

  it('verifies on /subscription/otp/verify and normalises the subscription status', async () => {
    reply({ statusCode: 'S1000', subscriptionStatus: 'REGISTERED.', subscriberId: 'tel:masked' })
    const res = await verifyOtp('REF1', '123456')
    expect(fetchMock.mock.calls[0][0]).toBe('https://bdapps.test/subscription/otp/verify')
    expect(res.subscriptionStatus).toBe('REGISTERED')
  })

  it('does not retry a well-formed BDApps error', async () => {
    reply({ statusCode: 'E1313', statusDetail: 'Authentication failed' })
    await expect(verifyOtp('REF1', '000000')).rejects.toMatchObject({ code: 'BDAPPS_E1313' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each(['E1850', 'E1854'])('reports a wrong or expired BDApps OTP (%s) as 400 INVALID_OTP', async (code) => {
    reply({ statusCode: code, statusDetail: 'Invalid OTP' })
    await expect(verifyOtp('REF1', '000000')).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_OTP' })
  })

  it('reports an OTP request for an already-subscribed number (E1351) as 409 ALREADY_SUBSCRIBED', async () => {
    reply({ statusCode: 'E1351', statusDetail: 'user already registered' })
    await expect(requestOtp('+8801805718862')).rejects.toMatchObject({ statusCode: 409, code: 'ALREADY_SUBSCRIBED' })
  })

  it('does not retry an HTTP 4xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Not Found', { status: 404 }))
    await expect(verifyOtp('REF1', '000000')).rejects.toMatchObject({ code: 'BDAPPS_HTTP_ERROR' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reads subscription status, treating E1951 as UNREGISTERED', async () => {
    reply({ statusCode: 'S1000', subscriptionStatus: 'REGISTERED' })
    expect(await getSubscriptionStatus('+8801805718862')).toBe('REGISTERED')
    expect(fetchMock.mock.calls[0][0]).toBe('https://bdapps.test/subscription/getStatus')
    expect(sentBody().subscriberId).toBe('tel:8801805718862')

    reply({ statusCode: 'E1951', statusDetail: 'User Already UnRegistered' })
    expect(await getSubscriptionStatus('+8801805718862')).toBe('UNREGISTERED')
  })

  it('unsubscribes via /subscription/send with action "0"', async () => {
    reply({ statusCode: 'S1000', subscriptionStatus: 'UNREGISTERED.' })
    const status = await setSubscription('+8801805718862', 'unsubscribe')
    expect(fetchMock.mock.calls[0][0]).toBe('https://bdapps.test/subscription/send')
    expect(sentBody()).toMatchObject({ subscriberId: 'tel:8801805718862', action: '0' })
    expect(status).toBe('UNREGISTERED')
  })

  it('treats unsubscribing an already-unregistered number as UNREGISTERED', async () => {
    reply({ statusCode: 'E1951', statusDetail: 'User Already UnRegistered' })
    expect(await setSubscription('+8801805718862', 'unsubscribe')).toBe('UNREGISTERED')
  })

  it('sends SMS to tel: addresses and reads the documented response shape', async () => {
    reply({
      statusCode: 'S1000',
      requestId: 'REQ1',
      destinationResponses: [{ address: 'tel:x', messageId: 'MSG1', statusCode: 'S1000' }],
    })
    const res = await smsSend('hi', ['+8801805718862', 'tel:all'])
    expect(sentBody().destinationAddresses).toEqual(['tel:8801805718862', 'tel:all'])
    expect(res).toMatchObject({ requestId: 'REQ1', messageId: 'MSG1' })
  })

  it('sends SMS without a delivery report by default (our SMS plan rejects reports with E1312)', async () => {
    reply({ statusCode: 'S1000', destinationResponses: [{ messageId: 'MSG1', statusCode: 'S1000' }] })
    await smsSend('hi', ['tel:masked'])
    expect(sentBody().deliveryStatusRequest).toBe('0')
  })
})

describe('BDApps helpers', () => {
  it('normalises status strings', () => {
    expect(normalizeSubscriptionStatus('registered.')).toBe('REGISTERED')
    expect(normalizeSubscriptionStatus(' UNREGISTERED. ')).toBe('UNREGISTERED')
    expect(normalizeSubscriptionStatus(undefined)).toBe('')
  })

  it('maps a tel: subscriber id back to our +880 phone format', () => {
    expect(phoneFromSubscriberId('tel:8801805718862')).toBe('+8801805718862')
    expect(phoneFromSubscriberId('8801805718862')).toBe('+8801805718862')
    expect(phoneFromSubscriberId('tel:ZTk2ZTk1OGEw')).toBeNull()
  })
})

describe('masked subscriber ids (apps with number masking, e.g. APP_140389)', () => {
  it('stores a masked verify subscriberId as tel:<id>, falling back to the phone', () => {
    expect(storedSubscriberId({ subscriberId: MASKED }, '+8801805718862')).toBe(`tel:${MASKED}`)
    expect(storedSubscriberId({ subscriberId: `tel:${MASKED}` }, '+8801805718862')).toBe(`tel:${MASKED}`)
    expect(storedSubscriberId({ subscriberId: 'tel:8801805718862' }, '+8801805718862')).toBe('tel:8801805718862')
    expect(storedSubscriberId({ subscriberId: '' }, '+8801805718862')).toBe('tel:8801805718862')
  })

  it('reads status for a masked id as tel:<id> (bare masked ids give E1325)', async () => {
    reply({ statusCode: 'S1000', subscriptionStatus: 'REGISTERED' })
    expect(await getSubscriptionStatus(`tel:${MASKED}`)).toBe('REGISTERED')
    expect(sentBody().subscriberId).toBe(`tel:${MASKED}`)
  })

  it('tells raw phone ids from masked ids', () => {
    expect(isPhoneSubscriberId('+8801805718862')).toBe(true)
    expect(isPhoneSubscriberId('tel:8801805718862')).toBe(true)
    expect(isPhoneSubscriberId(`tel:${MASKED}`)).toBe(false)
  })
})

describe('isSubscribed: a successful verify means Pro unless BDApps says otherwise', () => {
  it('counts registered and charging-pending states as subscribed', () => {
    expect(isSubscribed('REGISTERED')).toBe(true)
    expect(isSubscribed('INITIAL CHARGING PENDING')).toBe(true)
    expect(isSubscribed('')).toBe(true)
  })
  it('does not count unregistered or blocked', () => {
    expect(isSubscribed('UNREGISTERED')).toBe(false)
    expect(isSubscribed('BLOCKED')).toBe(false)
  })
})

describe('request/response logging (merchant channel, ADR 0004)', () => {
  it('logs each call with the full response and OTP, never the password', async () => {
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.stubEnv('LOG_STDOUT', 'true')
    reply({ statusCode: 'S1000', subscriptionStatus: 'INITIAL CHARGING PENDING', subscriberId: MASKED })
    await verifyOtp('REF1', '987654')
    const line = out.mock.calls.map((c) => String(c[0])).find((l) => l.includes('"channel":"merchant"')) ?? ''
    out.mockRestore()
    vi.unstubAllEnvs()
    expect(JSON.parse(line)).toMatchObject({
      channel: 'merchant',
      event: 'subscription/otp/verify',
      data: { request: { otp: '987654', password: '<REDACTED>' }, response: { subscriberId: MASKED } },
    })
    expect(line).not.toContain('secret')
  })
})
