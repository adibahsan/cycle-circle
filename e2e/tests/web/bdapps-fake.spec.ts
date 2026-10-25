import { test, expect } from '../../support/fixtures'
import { SECRETS } from '../../support/slot.ts'
import { translogFor } from '../../support/translog.ts'

/**
 * The fake BDApps plays both sides: it records every merchant call the app makes, and it
 * sends the app each kind of webhook BDApps sends. Each test uses its own throwaway user
 * and its own call-sequence window, so tests do not disturb each other.
 */
const stamp = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14)
const creds = { applicationId: SECRETS.bdappsAppId, password: SECRETS.bdappsPassword }

async function merchant(fakeUrl: string, path: string, body: Record<string, unknown>) {
  const res = await fetch(new URL(path, fakeUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...creds, ...body }),
  })
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

test.describe('fake BDApps: merchant calls', () => {
  test('unsubscribe through the app is recorded as a merchant call and the plan goes Free', async ({ newUser, fakeBdapps }) => {
    const { phone, page } = await newUser()
    const { user } = await (await page.request.get('/api/auth/status')).json()
    const maskedId = (await fakeBdapps.subscriber(phone))!.maskedId
    const since = (await fakeBdapps.calls()).at(-1)?.seq ?? 0

    const res = await page.request.post('/api/billing/unsubscribe')
    expect(res.ok()).toBe(true)

    const calls = await fakeBdapps.calls({ path: '/subscription/send', sinceSeq: since })
    expect(calls.find((c) => c.body.subscriberId === maskedId)).toMatchObject({
      body: { action: '0' },
      response: { statusCode: 'S1000' },
    })
    expect(await fakeBdapps.subscriber(phone)).toMatchObject({ status: 'UNREGISTERED' })
    expect((await (await page.request.get('/api/auth/status')).json()).user).toMatchObject({ subscriptionStatus: 'FREE' })
    expect(translogFor(user.id).some((l) => l.data.cause === 'unsubscribe')).toBe(true)
  })

  // The app's own SMS-send and CaaS-balance paths (login OTP to an existing subscriber, the
  // CaaS check cron) belong to later tickets (#119 login, #129 billing/cron); here the
  // fake's endpoints are driven over its HTTP the way the app's adapter calls them.
  test("SMS send and CaaS balance are recorded as merchant calls", async ({ newUser, fakeBdapps }) => {
    const { phone } = await newUser()
    const maskedId = (await fakeBdapps.subscriber(phone))!.maskedId
    const since = (await fakeBdapps.calls()).at(-1)?.seq ?? 0
    const fake = fakeBdapps.baseUrl

    const sms = await merchant(fake, '/sms/send', { message: 'hello', destinationAddresses: [maskedId] })
    expect(sms.json).toMatchObject({ statusCode: 'S1000' })
    const bal = await merchant(fake, '/caas/get/balance', { subscriberId: maskedId, paymentInstrumentName: 'Mobile Account', currency: 'BDT' })
    expect(bal.json).toMatchObject({ statusCode: 'S1000', chargeableBalance: '1000' })

    const mine = (await fakeBdapps.calls({ sinceSeq: since })).filter((c) => JSON.stringify(c.body).includes(maskedId))
    expect(mine.map((c) => c.path)).toEqual(['/sms/send', '/caas/get/balance'])
    expect(await fakeBdapps.caasBalance(phone)).toMatchObject({ accountStatus: 'ACTIVE' })
  })
})

test.describe('fake BDApps: scripted failures', () => {
  // Failure queues are global per path and tests run in parallel, so this is ONE test and
  // the only user of '/caas/direct/debit' (desktop project only).
  test('the next N calls fail with a status code, an HTTP status or a timeout, then calls succeed', async ({ newUser, fakeBdapps }, testInfo) => {
    test.skip(testInfo.project.name !== 'web-desktop', 'shares the failure queue for this path; one project only')
    const { phone } = await newUser()
    const addr = (await fakeBdapps.subscriber(phone))!.maskedId
    const path = '/caas/direct/debit'
    const ask = () => merchant(fakeBdapps.baseUrl, path, { subscriberId: addr, amount: '5', externalTrxId: `t-${Date.now()}` })

    await fakeBdapps.failNext(path, { mode: 'error', statusCode: 'E1601', times: 2 })
    expect((await ask()).json).toMatchObject({ statusCode: 'E1601' })
    expect((await ask()).json).toMatchObject({ statusCode: 'E1601' })
    expect((await ask()).json).toMatchObject({ statusCode: 'S1000' })

    await fakeBdapps.failNext(path, { mode: 'http', httpStatus: 502, times: 1 })
    expect((await ask()).status).toBe(502)
    expect((await ask()).status).toBe(200)

    await fakeBdapps.failNext(path, { mode: 'timeout', delayMs: 100, times: 1 })
    await expect(ask()).rejects.toThrow()
    expect((await ask()).json).toMatchObject({ statusCode: 'S1000' })

    // Scripted failures are recorded like any call.
    const failed = (await fakeBdapps.calls({ path })).filter((c) => c.httpStatus !== 200 || c.response.statusCode === 'E1601')
    expect(failed).toHaveLength(4)
  })
})

test.describe('fake BDApps: sending webhooks to the app', () => {
  test('SMS received, delivery report and USSD each reach the app (S1000)', async ({ fakeBdapps }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const received = await fakeBdapps.sendWebhook('/api/webhooks/sms/receive', {
      sourceAddress: 'tel:8801700000000', message: 'HELP', messageId: `m-${id}`, timeStamp: stamp(),
    })
    const report = await fakeBdapps.sendWebhook('/api/webhooks/sms/report', {
      destinationAddress: 'tel:8801700000000', requestId: `r-${id}`, deliveryStatus: 'DeliveredToTerminal', timeStamp: stamp(),
    })
    const ussd = await fakeBdapps.sendWebhook('/api/webhooks/ussd/receive', {
      subscriberId: 'tel:8801700000000', ussdContent: '1', sessionId: `s-${id}`, status: 'mo-init',
    })
    for (const r of [received, report, ussd]) expect(r).toMatchObject({ status: 200, body: { statusCode: 'S1000' } })
  })
})
