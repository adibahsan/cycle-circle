import { test, expect } from '../../support/fixtures'
import { SECRETS } from '../../support/slot.ts'
import { translogFor } from '../../support/translog.ts'

/** BDApps timestamps are `yyyyMMddHHmmss`. */
const bdappsStamp = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14)

test.describe('BDApps webhook: subscription notify (unsubscribed)', () => {
  test('moves a Pro subscriber to Free, shows Free after a reload, and the translog records the cause', async ({ newUser, fakeBdapps }) => {
    const { phone, page } = await newUser()
    await page.goto('/subscription')
    await expect(page.getByText('Cycle Circle Pro', { exact: true })).toBeVisible()

    const { user } = await (await page.request.get('/api/auth/status')).json()
    expect(user).toMatchObject({ subscriptionStatus: 'PRO' })

    // BDApps tells the app the subscriber unsubscribed (outside the app, e.g. by USSD).
    const subscriber = await fakeBdapps.subscriber(phone)
    const sent = await fakeBdapps.sendWebhook('/api/webhooks/subscription/notify', {
      applicationId: SECRETS.bdappsAppId,
      subscriberId: subscriber!.maskedId,
      status: 'UNREGISTERED',
      timeStamp: bdappsStamp(),
    })
    expect(sent).toMatchObject({ status: 200, body: { statusCode: 'S1000' } })

    await page.reload()
    await expect(page.getByText('Cycle Circle Free', { exact: true })).toBeVisible()
    await expect(page.getByText('Cycle Circle Pro', { exact: true })).toHaveCount(0)

    // The translog has no screen: read the line the app wrote.
    await expect
      .poll(() => translogFor(user.id).find((l) => l.event === 'plan.change' && l.data.cause === 'webhook'))
      .toMatchObject({ data: { from: 'PRO', to: 'FREE', cause: 'webhook', changed: true } })
  })
})
