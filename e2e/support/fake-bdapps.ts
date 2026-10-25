/** Typed client for the fake BDApps control API (`e2e/fake-bdapps`). */
import type { FailureMatch, IssuedOtp, RecordedCall, ScriptedFailure, Subscriber, CaasBalance, CaasDebit } from '../fake-bdapps/state.ts'
import { URLS } from './slot.ts'

export type { FailureMatch, IssuedOtp, RecordedCall, ScriptedFailure, Subscriber, CaasBalance, CaasDebit }

/** `yyyyMMddHHmmss`, the timestamp format of BDApps webhooks. */
export type BdappsTimestamp = string

/** Body of `POST /api/webhooks/subscription/notify`. */
export interface SubscriptionNotifyPayload {
  applicationId: string
  /** The subscriber's masked id (`tel:<opaque>`). */
  subscriberId: string
  /** e.g. `REGISTERED`, `UNREGISTERED`. */
  status: string
  timeStamp: BdappsTimestamp
}

/** Body of `POST /api/webhooks/sms/receive`. */
export interface SmsReceivePayload {
  sourceAddress: string
  message: string
  messageId: string
  timeStamp: BdappsTimestamp
}

/** Body of `POST /api/webhooks/sms/report`. */
export interface SmsReportPayload {
  destinationAddress: string
  requestId: string
  deliveryStatus: string
  timeStamp: BdappsTimestamp
}

/** Body of `POST /api/webhooks/ussd/receive`. */
export interface UssdReceivePayload {
  subscriberId: string
  ussdContent: string
  sessionId: string
  status: string
}

export interface WebhookPayloads {
  '/api/webhooks/subscription/notify': SubscriptionNotifyPayload
  '/api/webhooks/sms/receive': SmsReceivePayload
  '/api/webhooks/sms/report': SmsReportPayload
  '/api/webhooks/ussd/receive': UssdReceivePayload
}

export class FakeBdappsClient {
  constructor(readonly baseUrl: string = URLS.fakeBdapps) {}

  private async req<T>(method: string, path: string, body?: unknown): Promise<{ status: number; json: T }> {
    const res = await fetch(new URL(path, this.baseUrl), {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: res.status, json: (await res.json()) as T }
  }

  /**
   * The newest OTP issued to `phone` (any form: `01…`, `+880…`), waiting up to `timeoutMs`
   * for one issued at or after `since` (default: any). Covers BDApps OTPs and App OTPs
   * (the code in the login SMS to an existing subscriber).
   */
  async latestOtp(phone: string, { since, timeoutMs = 10_000 }: { since?: Date; timeoutMs?: number } = {}): Promise<IssuedOtp> {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const { status, json } = await this.req<IssuedOtp>('GET', `/_control/otp?phone=${encodeURIComponent(phone)}`)
      if (status === 200 && (!since || new Date(json.at) >= since)) return json
      if (Date.now() > deadline) throw new Error(`fake BDApps issued no OTP for ${phone}${since ? ` since ${since.toISOString()}` : ''}`)
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  /** Merchant calls the apps made, oldest first; filter by endpoint path and/or `sinceSeq`. */
  async calls(filter: { path?: string; sinceSeq?: number } = {}): Promise<RecordedCall[]> {
    const q = new URLSearchParams()
    if (filter.path) q.set('path', filter.path)
    if (filter.sinceSeq) q.set('sinceSeq', String(filter.sinceSeq))
    return (await this.req<RecordedCall[]>('GET', `/_control/calls?${q}`)).json
  }

  /** The subscriber behind a phone number, or undefined if BDApps never subscribed it. */
  async subscriber(phone: string): Promise<Subscriber | undefined> {
    const { status, json } = await this.req<Subscriber>('GET', `/_control/subscribers/${encodeURIComponent(phone)}`)
    return status === 200 ? json : undefined
  }

  /** CaaS balance for a phone, or undefined if never queried. */
  async caasBalance(phone: string): Promise<CaasBalance | undefined> {
    const { status, json } = await this.req<CaasBalance>('GET', `/_control/caas/balance?phone=${encodeURIComponent(phone)}`)
    return status === 200 ? json : undefined
  }

  /** CaaS debits, optionally filtered by phone. */
  async caasDebits(phone?: string): Promise<CaasDebit[]> {
    const q = phone ? `?phone=${encodeURIComponent(phone)}` : ''
    return (await this.req<CaasDebit[]>('GET', `/_control/caas/debits${q}`)).json
  }

  /**
   * Make the next `times` (default 1) calls to `path` that satisfy `match` fail. `match` is
   * required so parallel tests scripting the same path never steal each other's failure;
   * `{ any: true }` matches every call and is only for paths nobody else uses (`/health`).
   */
  async failNext(path: string, failure: Omit<ScriptedFailure, 'path' | 'times'> & { times?: number }): Promise<void> {
    const { status, json } = await this.req('POST', '/_control/failures', { path, ...failure })
    if (status !== 200) throw new Error(`failNext rejected: ${JSON.stringify(json)}`)
  }

  /** POST `body` to the web app at `appPath` as BDApps would (webhooks). Returns the app's answer. */
  async sendWebhook<P extends keyof WebhookPayloads>(appPath: P, body: WebhookPayloads[P]): Promise<{ status: number; body: unknown }> {
    return (await this.req<{ status: number; body: unknown }>('POST', '/_control/webhook', { path: appPath, body })).json
  }

  /** Forget everything. Only for the runner: tests share the fake, so never reset it from a test. */
  async reset(): Promise<void> {
    await this.req('POST', '/_control/reset', {})
  }
}
