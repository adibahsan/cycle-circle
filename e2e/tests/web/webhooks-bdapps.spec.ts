import { test, expect } from '../../support/fixtures'
import { SECRETS } from '../../support/slot.ts'

/** BDApps timestamps are `yyyyMMddHHmmss`. */
const stamp = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14)

test.describe('BDApps webhooks: recorded events and duplicates', () => {
  test('SMS receive is stored once; a duplicate messageId is ignored', async ({ fakeBdapps, db }) => {
    const messageId = `m-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const payload = {
      sourceAddress: 'tel:8801700000099',
      message: 'HELP',
      messageId,
      timeStamp: stamp(),
    }

    const first = await fakeBdapps.sendWebhook('/api/webhooks/sms/receive', payload)
    const second = await fakeBdapps.sendWebhook('/api/webhooks/sms/receive', payload)
    for (const r of [first, second]) expect(r).toMatchObject({ status: 200, body: { statusCode: 'S1000' } })

    const rows = await db.webhookEvent.findMany({ where: { idempotencyKey: messageId } })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'SMS_RECEIVE' })
  })

  test('USSD receive is stored once; a duplicate sessionId is ignored', async ({ fakeBdapps, db }) => {
    const sessionId = `s-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const payload = {
      subscriberId: 'tel:8801700000098',
      ussdContent: '1',
      sessionId,
      status: 'mo-init',
    }

    const first = await fakeBdapps.sendWebhook('/api/webhooks/ussd/receive', payload)
    const second = await fakeBdapps.sendWebhook('/api/webhooks/ussd/receive', payload)
    for (const r of [first, second]) expect(r).toMatchObject({ status: 200, body: { statusCode: 'S1000' } })

    const rows = await db.webhookEvent.findMany({ where: { idempotencyKey: sessionId } })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'USSD_RECEIVE' })
  })

  test('SMS delivery report is stored once; a duplicate requestId+address is ignored', async ({
    fakeBdapps,
    db,
  }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const destinationAddress = 'tel:8801700000097'
    const requestId = `r-e2e-${id}`
    const payload = {
      destinationAddress,
      requestId,
      deliveryStatus: 'DeliveredToTerminal',
      timeStamp: stamp(),
    }

    const first = await fakeBdapps.sendWebhook('/api/webhooks/sms/report', payload)
    const second = await fakeBdapps.sendWebhook('/api/webhooks/sms/report', payload)
    for (const r of [first, second]) expect(r).toMatchObject({ status: 200, body: { statusCode: 'S1000' } })

    const key = `${requestId}:${destinationAddress}`
    const rows = await db.webhookEvent.findMany({ where: { idempotencyKey: key } })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'SMS_REPORT' })
  })

  test('subscription notify is recorded as a Webhook event (subscribed)', async ({
    newUser,
    fakeBdapps,
    db,
  }) => {
    const { phone } = await newUser()
    const subscriber = await fakeBdapps.subscriber(phone)
    const timeStamp = stamp()
    const key = `${subscriber!.maskedId}:${timeStamp}`

    const sent = await fakeBdapps.sendWebhook('/api/webhooks/subscription/notify', {
      applicationId: SECRETS.bdappsAppId,
      subscriberId: subscriber!.maskedId,
      status: 'REGISTERED',
      timeStamp,
    })
    expect(sent).toMatchObject({ status: 200, body: { statusCode: 'S1000' } })

    const rows = await db.webhookEvent.findMany({ where: { idempotencyKey: key } })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'SUBSCRIPTION_NOTIFY' })
  })
})
