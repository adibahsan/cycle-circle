/**
 * Handbook chapter "BDApps billing events" (docs/handbook/chapters/bdapps-billing-events.md), ticket #249.
 * Each event is produced for real against the fake BDApps with a throwaway User, then read back
 * from the Admin Logs page (translog and webhook channels).
 */
import { test, expect } from '../../../support/fixtures.ts'
import { ADMIN_STATE } from '../../support/admin-demo.ts'
import { toDbPhone } from '../../../support/users.ts'
import { SECRETS } from '../../../support/slot.ts'
import { shot } from '../../support/shot.ts'

test.use({ storageState: ADMIN_STATE })

test.describe('BDApps billing events', () => {
  test('subscribe: the phone login writes plan.change otp-verify', async ({ page, newUser, db }) => {
    const { phone } = await newUser()
    const user = await db.user.findFirstOrThrow({ where: { phone: toDbPhone(phone) } })
    await page.goto(`/logs?channel=translog&userId=${user.id}`)
    await expect(page.locator('li').filter({ hasText: 'plan.change' }).first()).toBeVisible({ timeout: 15_000 })
    await shot(page, 'bb-subscribe')
  })

  test('unsubscribe: the User taps Unsubscribe', async ({ page, newUser, db }) => {
    const { phone, context } = await newUser()
    const user = await db.user.findFirstOrThrow({ where: { phone: toDbPhone(phone) } })
    const res = await context.request.post('/api/billing/unsubscribe')
    expect(res.ok()).toBe(true)
    await page.goto(`/logs?channel=translog&userId=${user.id}&text=unsubscribe`)
    await expect(page.locator('li').filter({ hasText: 'plan.change' }).first()).toBeVisible({ timeout: 15_000 })
    await shot(page, 'bb-unsubscribe')
  })

  test('lapse and webhook: BDApps reports the number as unregistered', async ({ page, newUser, fakeBdapps, db }) => {
    const { phone } = await newUser()
    const user = await db.user.findFirstOrThrow({ where: { phone: toDbPhone(phone) } })
    const subscriber = await fakeBdapps.subscriber(phone)
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
    const sent = await fakeBdapps.sendWebhook('/api/webhooks/subscription/notify', {
      applicationId: SECRETS.bdappsAppId, subscriberId: subscriber!.maskedId, status: 'UNREGISTERED', timeStamp: stamp,
    })
    expect(sent.status).toBe(200)

    await page.goto(`/logs?channel=translog&userId=${user.id}&text=webhook`)
    await expect(page.locator('li').filter({ hasText: 'plan.change' }).first()).toBeVisible({ timeout: 15_000 })
    await shot(page, 'bb-lapse')

    await page.goto(`/logs?channel=webhook&userId=${user.id}`)
    await expect(page.locator('li').filter({ hasText: 'subscription.notify' }).first()).toBeVisible({ timeout: 15_000 })
    await shot(page, 'bb-webhooks')
  })
})
