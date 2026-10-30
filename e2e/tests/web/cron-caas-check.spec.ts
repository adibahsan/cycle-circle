import { test, expect } from '../../support/fixtures'
import { SECRETS, URLS } from '../../support/slot.ts'

/**
 * The route slug is historical: today the job calls `/subscription/getStatus` for
 * each BDApps PRO subscriber (see route comment). Spec #114 / ticket #132 AC say
 * "balances"; reconcile in https://github.com/adibahsan/cycle-circle/issues/142.
 * We assert the live behaviour (status checks + UNREGISTERED → Free) against the fake.
 */
const creds = { applicationId: SECRETS.bdappsAppId, password: SECRETS.bdappsPassword }

async function merchant(fakeUrl: string, path: string, body: Record<string, unknown>) {
  const res = await fetch(new URL(path, fakeUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...creds, ...body }),
  })
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

test.describe('cron: caas-check', () => {
  test('reads subscription status from the fake BDApps for a throwaway Pro user', async ({
    newUser,
    fakeBdapps,
    request,
  }) => {
    const { phone } = await newUser()
    const maskedId = (await fakeBdapps.subscriber(phone))!.maskedId
    const sinceSeq = (await fakeBdapps.calls()).at(-1)?.seq ?? 0

    const res = await request.post(`${URLS.web}/api/cron/caas-check`, {
      headers: { authorization: `Bearer ${SECRETS.cronSecret}` },
      data: { overrideDisabled: true },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.skipped).not.toBe(true)
    expect(typeof body.checked).toBe('number')
    expect(body.checked).toBeGreaterThanOrEqual(1)

    const statusCalls = await fakeBdapps.calls({ path: '/subscription/getStatus', sinceSeq })
    expect(statusCalls.some((c) => c.body.subscriberId === maskedId)).toBe(true)
  })

  test('downgrades a throwaway Pro user when fake BDApps returns UNREGISTERED', async ({
    newUser,
    fakeBdapps,
    request,
  }) => {
    const { phone, page } = await newUser()
    const maskedId = (await fakeBdapps.subscriber(phone))!.maskedId

    // Flip BDApps only (DB stays PRO) so the nightly status check must downgrade.
    const unreg = await merchant(fakeBdapps.baseUrl, '/subscription/send', {
      subscriberId: maskedId,
      action: '0',
    })
    expect(unreg.json).toMatchObject({ statusCode: 'S1000', subscriptionStatus: 'UNREGISTERED' })
    expect(await fakeBdapps.subscriber(phone)).toMatchObject({ status: 'UNREGISTERED' })
    expect((await (await page.request.get('/api/auth/status')).json()).user).toMatchObject({
      subscriptionStatus: 'PRO',
    })

    const res = await request.post(`${URLS.web}/api/cron/caas-check`, {
      headers: { authorization: `Bearer ${SECRETS.cronSecret}` },
      data: { overrideDisabled: true },
    })
    expect(res.ok()).toBe(true)
    const body = await res.json()
    expect(body.skipped).not.toBe(true)
    expect(body.downgraded).toBeGreaterThanOrEqual(1)

    expect((await (await page.request.get('/api/auth/status')).json()).user).toMatchObject({
      subscriptionStatus: 'FREE',
    })
  })
})
