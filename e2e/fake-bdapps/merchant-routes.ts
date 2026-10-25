/**
 * The BDApps merchant endpoints the fake implements: path → handler. A handler gets the
 * parsed body (credentials already checked) and returns the BDApps JSON answer.
 * Behaviour mirrors the live API for a number-masking app (see GLOSSARY: Masked subscriber id):
 *   - otp/request for a number that is already a subscriber fails with E1351;
 *   - otp/verify subscribes the number under a new masked id;
 *   - every later call must address the subscriber by that masked id; raw numbers get E1951.
 */
import { randomInt } from 'node:crypto'
import {
  type FakeState,
  findByMaskedId,
  newMaskedId,
  normalizePhone,
  recordOtp,
} from './state.ts'

export type MerchantRoute = (body: Record<string, unknown>, state: FakeState) => Record<string, unknown>

const OTP_TTL_MS = 5 * 60 * 1000

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

export const ok = (extra: Record<string, unknown> = {}) => ({
  statusCode: 'S1000',
  statusDetail: 'Request was successfully processed.',
  version: '1.0',
  ...extra,
})

export const bdappsError = (statusCode: string, statusDetail: string) => ({ statusCode, statusDetail, version: '1.0' })

const E1951 = () => bdappsError('E1951', 'Format of the address is invalid Or User Already UnRegistered')

/** The live subscriber a masked id points at, if that id is still current. */
function subscriberAt(state: FakeState, address: unknown) {
  return typeof address === 'string' ? findByMaskedId(state, address) : undefined
}

export const merchantRoutes: Record<string, MerchantRoute> = {
  '/subscription/otp/request': (body, state) => {
    const phone = normalizePhone(String(body.subscriberId ?? ''))
    if (!phone) return bdappsError('E1312', 'Request is missing required parameter subscriberId')
    if (state.subscribers.get(phone)?.status === 'REGISTERED') return bdappsError('E1351', 'User already registered')
    const referenceNo = `ref-${randomInt(1e11, 1e12)}`
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    state.pendingOtps.set(referenceNo, { phone, code, expiresAt: Date.now() + OTP_TTL_MS })
    recordOtp(state, { kind: 'bdapps', phone, code, referenceNo, at: new Date().toISOString() })
    return ok({ referenceNo })
  },

  '/subscription/otp/verify': (body, state) => {
    const referenceNo = String(body.referenceNo ?? '')
    const pending = state.pendingOtps.get(referenceNo)
    if (!pending || pending.expiresAt < Date.now()) return bdappsError('E1854', 'Could not find OTP')
    if (String(body.otp) !== pending.code) return bdappsError('E1850', 'Invalid OTP')
    state.pendingOtps.delete(referenceNo)
    const maskedId = newMaskedId()
    state.subscribers.set(pending.phone, { phone: pending.phone, maskedId, status: 'REGISTERED', updatedAt: new Date().toISOString() })
    return ok({ subscriptionStatus: 'REGISTERED', subscriberId: maskedId })
  },

  '/subscription/getStatus': (body, state) => {
    const s = subscriberAt(state, body.subscriberId)
    return s?.status === 'REGISTERED' ? ok({ subscriptionStatus: 'REGISTERED' }) : E1951()
  },

  '/subscription/send': (body, state) => {
    const s = subscriberAt(state, body.subscriberId)
    if (!s) return E1951()
    if (String(body.action) === '1') {
      s.status = 'REGISTERED'
    } else {
      if (s.status !== 'REGISTERED') return E1951()
      s.status = 'UNREGISTERED'
    }
    s.updatedAt = new Date().toISOString()
    return ok({ subscriptionStatus: s.status })
  },

  /** Records the message; a 6-digit code in it is kept as that subscriber's latest App OTP. */
  '/sms/send': (body, state) => {
    const to = Array.isArray(body.destinationAddresses) ? body.destinationAddresses.map(String) : []
    const message = String(body.message ?? '')
    const reached = to.includes('tel:all')
      ? [...state.subscribers.values()].filter((s) => s.status === 'REGISTERED')
      : to.map((a) => subscriberAt(state, a)).filter((s) => s?.status === 'REGISTERED')
    const phones = reached.map((s) => s!.phone)
    state.sms.push({ at: new Date().toISOString(), message, to, phones })
    const code = message.match(/\b(\d{6})\b/)?.[1]
    if (code && !to.includes('tel:all')) {
      for (const phone of phones) recordOtp(state, { kind: 'app', phone, code, at: new Date().toISOString() })
    }
    const destinationResponses = to.map((address) => {
      const good = address === 'tel:all' || subscriberAt(state, address)?.status === 'REGISTERED'
      return {
        address,
        messageId: `msg-${randomInt(1e11, 1e12)}`,
        statusCode: good ? 'S1000' : 'E1951',
        statusDetail: good ? 'Success' : 'Format of the address is invalid Or User Already UnRegistered',
        timeStamp: stamp(),
      }
    })
    return ok({ requestId: `req-${randomInt(1e11, 1e12)}`, destinationResponses })
  },
}
