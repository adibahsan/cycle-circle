import { test, expect } from '../../support/fixtures'
import { newEmail } from '../../support/users.ts'
import { SECRETS, URLS } from '../../support/slot.ts'

/** Svix HMAC over `id.timestamp.body`, matching apps/web resend webhook verify. */
async function svixSignature(secret: string, id: string, timestamp: string, body: string): Promise<string> {
  const keyData = Uint8Array.from(
    atob(secret.startsWith('whsec_') ? secret.slice(6) : secret),
    (c) => c.charCodeAt(0),
  )
  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(`${id}.${timestamp}.${body}`))
  const computedBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
  return `v1,${computedBase64}`
}

async function postResend(
  request: {
    post: (
      url: string,
      opts: { headers: Record<string, string>; data: string },
    ) => Promise<{ status: () => number; text: () => Promise<string> }>
  },
  body: string,
  {
    resendId,
    signature,
    timestamp,
  }: { resendId: string; signature: string; timestamp: string },
) {
  return request.post(`${URLS.web}/api/webhooks/resend`, {
    headers: {
      'content-type': 'application/json',
      'svix-id': `msg_${resendId}`,
      'svix-timestamp': timestamp,
      'svix-signature': signature,
    },
    // Raw string so Svix HMAC matches `request.text()` on the server.
    data: body,
  })
}

test.describe('Resend webhook', () => {
  test('valid signature marks DELIVERED; bad signature stays PENDING; bounce → BOUNCED', async ({
    db,
    request,
  }) => {
    const secret = SECRETS.resendWebhookSecret
    const deliveredId = `re_e2e_d_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const bouncedId = `re_e2e_b_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const to = newEmail('resend-hook')

    for (const resendId of [deliveredId, bouncedId]) {
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
    }

    const ts = String(Math.floor(Date.now() / 1000))
    const deliveredBody = JSON.stringify({ type: 'email.delivered', data: { email_id: deliveredId } })
    const bad = await postResend(request, deliveredBody, {
      resendId: deliveredId,
      signature: 'v1,not-a-valid-signature',
      timestamp: ts,
    })
    expect(bad.status()).toBe(401)
    expect(await db.emailLog.findFirst({ where: { resendId: deliveredId } })).toMatchObject({
      deliveryStatus: 'PENDING',
    })

    const goodSig = await svixSignature(secret, `msg_${deliveredId}`, ts, deliveredBody)
    const good = await postResend(request, deliveredBody, {
      resendId: deliveredId,
      signature: goodSig,
      timestamp: ts,
    })
    expect(good.status()).toBe(200)
    expect(await good.text()).toBe('OK')
    expect(await db.emailLog.findFirst({ where: { resendId: deliveredId } })).toMatchObject({
      deliveryStatus: 'DELIVERED',
      to,
    })

    const bounceBody = JSON.stringify({ type: 'email.bounced', data: { email_id: bouncedId } })
    const bounceTs = String(Math.floor(Date.now() / 1000))
    const bounceSig = await svixSignature(secret, `msg_${bouncedId}`, bounceTs, bounceBody)
    const bounce = await postResend(request, bounceBody, {
      resendId: bouncedId,
      signature: bounceSig,
      timestamp: bounceTs,
    })
    expect(bounce.status()).toBe(200)
    expect(await db.emailLog.findFirst({ where: { resendId: bouncedId } })).toMatchObject({
      deliveryStatus: 'BOUNCED',
      to,
    })
  })
})
