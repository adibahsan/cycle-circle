import { test, expect } from '../../support/fixtures'
import { SECRETS, URLS } from '../../support/slot.ts'

/**
 * The route slug is historical: today the job calls `/subscription/getStatus` for
 * each BDApps PRO subscriber (see route comment). Spec #114 / ticket AC say
 * "balances"; we assert the live behaviour (status checks) against the fake.
 */
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
})
