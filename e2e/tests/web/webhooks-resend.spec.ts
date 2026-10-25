import { test, expect } from '../../support/fixtures'
import { newEmail } from '../../support/users.ts'
import { URLS } from '../../support/slot.ts'

test.describe('Resend webhook', () => {
  test('updates the email log delivery status', async ({ db, request }) => {
    const resendId = `re_e2e_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const to = newEmail('resend-hook')

    await db.emailLog.create({
      data: {
        type: 'MAGIC_LINK',
        to,
        subject: 'E2E Resend webhook',
        status: 'SENT',
        provider: 'RESEND',
        resendId,
        deliveryStatus: 'PENDING',
      },
    })

    // RESEND_WEBHOOK_SECRET is empty in E2E: Svix headers must still be present.
    const res = await request.post(`${URLS.web}/api/webhooks/resend`, {
      headers: {
        'content-type': 'application/json',
        'svix-id': `msg_${resendId}`,
        'svix-timestamp': String(Math.floor(Date.now() / 1000)),
        'svix-signature': 'v1,unused',
      },
      data: { type: 'email.delivered', data: { email_id: resendId } },
    })
    expect(res.status()).toBe(200)
    expect(await res.text()).toBe('OK')

    const log = await db.emailLog.findFirst({ where: { resendId } })
    expect(log).toMatchObject({ deliveryStatus: 'DELIVERED', to })
  })
})
