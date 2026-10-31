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

  // Serial project on purpose: the bug's fallback lands on the newest active SENT broadcast, so beside
  // the parallel admin SMS tests it would hit one of theirs (and pass here unexpectedly).
  test('a delivery report with an unknown requestId leaves our broadcast counts unchanged', async ({ fakeBdapps, db }) => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const admin = await db.user.findFirstOrThrow({ where: { role: 'ADMIN' } })
    // Setup only: a sent broadcast with a known provider id, newest by sentAt (UI send can't fix the order).
    const broadcast = await db.smsBroadcast.create({
      data: {
        message: `E2E SMS Bogus ${runId}`,
        sendLanguage: 'EN',
        status: 'SENT',
        sentAt: new Date(),
        active: true,
        providerMessageId: `real-req-${runId}`,
        targetCount: 1,
        deliveredCount: 0,
        failedCount: 0,
        createdBy: admin.id,
      },
    })
    try {
      const res = await fakeBdapps.sendWebhook('/api/webhooks/sms/report', {
        destinationAddress: 'tel:8801700000097',
        requestId: `bogus-req-${runId}`,
        deliveryStatus: 'DELIVERED',
        timeStamp: stamp(),
      })
      expect(res).toMatchObject({ status: 200, body: { statusCode: 'S1000' } })

      const after = await db.smsBroadcast.findUniqueOrThrow({ where: { id: broadcast.id } })
      expect(after).toMatchObject({ deliveredCount: 0, failedCount: 0, targetCount: 1 })
    } finally {
      await db.smsBroadcast.update({ where: { id: broadcast.id }, data: { active: false } })
    }
  })
})
