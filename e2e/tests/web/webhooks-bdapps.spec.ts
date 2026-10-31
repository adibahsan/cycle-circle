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

  // Serial project on purpose: it asserts on a message sent "now" and shares the database with
  // the parallel admin SMS tests.
  test('a delivery report with an unknown requestId leaves our message counts unchanged', async ({ fakeBdapps, db }) => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const admin = await db.user.findFirstOrThrow({ where: { role: 'ADMIN' } })
    // Setup only: a sent campaign message with known provider ids, newest by sentAt (UI send can't fix the order).
    const campaign = await db.smsCampaign.create({
      data: {
        name: `E2E SMS Bogus ${runId}`,
        createdBy: admin.id,
        messages: {
          create: {
            day: new Date('2012-05-05T00:00:00Z'),
            body: `E2E SMS Bogus ${runId}`,
            status: 'SENT',
            sentAt: new Date(),
            providerRequestId: `real-req-${runId}`,
            providerMessageId: `real-msg-${runId}`,
            audienceSize: 1,
            deliveredCount: 0,
            failedCount: 0,
          },
        },
      },
      include: { messages: true },
    })
    const message = campaign.messages[0]
    try {
      const res = await fakeBdapps.sendWebhook('/api/webhooks/sms/report', {
        destinationAddress: 'tel:8801700000097',
        requestId: `bogus-req-${runId}`,
        deliveryStatus: 'DELIVERED',
        timeStamp: stamp(),
      })
      expect(res).toMatchObject({ status: 200, body: { statusCode: 'S1000' } })

      const after = await db.smsCampaignMessage.findUniqueOrThrow({ where: { id: message.id } })
      expect(after).toMatchObject({ deliveredCount: 0, failedCount: 0, audienceSize: 1 })

      // The real requestId does reach the message.
      await fakeBdapps.sendWebhook('/api/webhooks/sms/report', {
        destinationAddress: 'tel:8801700000097',
        requestId: `real-req-${runId}`,
        deliveryStatus: 'DELIVERED',
        timeStamp: stamp(),
      })
      const counted = await db.smsCampaignMessage.findUniqueOrThrow({ where: { id: message.id } })
      expect(counted.deliveredCount).toBe(1)
    } finally {
      await db.smsCampaign.delete({ where: { id: campaign.id } })
    }
  })
})
