/** In-memory state of the fake BDApps, and the types its control API returns. */
import { randomBytes } from 'node:crypto'

export interface FakeConfig {
  appId: string
  password: string
  /** Base URL of the web app, for webhooks the fake sends (`/_control/webhook`). */
  appUrl: string
}

/** One merchant call as the app made it, with what the fake answered. */
export interface RecordedCall {
  seq: number
  at: string
  path: string
  body: Record<string, unknown>
  /** 200 for BDApps-style answers (S1000 or Exxxx), the HTTP status for scripted http failures, 0 for timeouts. */
  httpStatus: number
  response: Record<string, unknown>
}

/**
 * Which call a scripted failure applies to. `{ any: true }` matches every call to the path
 * (the exclusive-path escape hatch, e.g. GET `/health`, which carries no subscriber).
 * Otherwise every given field must match: `subscriberId` against `body.subscriberId`
 * (masked id or phone), `destinationAddress` against `body.destinationAddress` or any of
 * `body.destinationAddresses`, `phone` against either after phone normalisation.
 */
export type FailureMatch = { any: true } | { subscriberId?: string; destinationAddress?: string; phone?: string }

/**
 * A queued failure: the next `times` calls to `path` fail instead of running the route.
 * `error` answers HTTP 200 with a BDApps status code (e.g. E1601); `http` answers a bare
 * HTTP error; `timeout` never answers.
 */
export interface ScriptedFailure {
  path: string
  /** Which calls to `path` this failure applies to. Required: a bare path would be stolen by parallel tests. */
  match: FailureMatch
  mode: 'timeout' | 'http' | 'error'
  statusCode?: string
  statusDetail?: string
  httpStatus?: number
  delayMs?: number
  times: number
}

/** An OTP the fake knows the code of: issued by otp/request (`bdapps`), or an App OTP it saw in an SMS (`app`). */
export interface IssuedOtp {
  kind: 'bdapps' | 'app'
  phone: string
  code: string
  referenceNo?: string
  at: string
}

export interface Subscriber {
  /** `+8801XXXXXXXXX`, the format the app stores. */
  phone: string
  /** `tel:<opaque>`: the only address BDApps accepts for this subscriber; new on every subscription. */
  maskedId: string
  status: 'REGISTERED' | 'UNREGISTERED'
  updatedAt: string
}

export interface SentSms {
  at: string
  message: string
  /** Addresses as the app sent them (masked ids or `tel:all`). */
  to: string[]
  /** Phones of the subscribers it reached. */
  phones: string[]
}

export interface CaasBalance {
  phone: string
  accountType: string
  accountStatus: string
  chargeableBalance: string
  updatedAt: string
}

export interface CaasDebit {
  phone: string
  externalTrxId: string
  internalTrxId: string
  referenceId: string
  amount: string
  timeStamp: string
}

export interface FakeState {
  config: FakeConfig
  calls: RecordedCall[]
  failures: ScriptedFailure[]
  /** referenceNo → pending BDApps OTP. */
  pendingOtps: Map<string, { phone: string; code: string; expiresAt: number }>
  /** phone → every OTP issued to it, oldest first. */
  otpsByPhone: Map<string, IssuedOtp[]>
  /** phone → subscriber. */
  subscribers: Map<string, Subscriber>
  sms: SentSms[]
  /** phone → CaaS balance. */
  caasBalances: Map<string, CaasBalance>
  /** List of CaaS debits. */
  caasDebits: CaasDebit[]
  reset(): void
}

export function createState(config: FakeConfig): FakeState {
  const state: FakeState = {
    config,
    calls: [],
    failures: [],
    pendingOtps: new Map(),
    otpsByPhone: new Map(),
    subscribers: new Map(),
    sms: [],
    caasBalances: new Map(),
    caasDebits: [],
    reset() {
      state.calls.length = 0
      state.failures.length = 0
      state.pendingOtps.clear()
      state.otpsByPhone.clear()
      state.subscribers.clear()
      state.sms.length = 0
      state.caasBalances.clear()
      state.caasDebits.length = 0
    },
  }
  return state
}

/** Any phone form (`01…`, `+8801…`, `8801…`, `tel:8801…`) → `+8801XXXXXXXXX`; undefined if it isn't one. */
export function normalizePhone(value: string): string | undefined {
  const m = value.trim().replace(/^tel:/, '').match(/^(?:\+?88)?0?(1[3-9]\d{8})$/)
  return m ? `+880${m[1]}` : undefined
}

/** Phone behind an address in a request body: a masked id → its subscriber's phone, else the raw number. */
function phoneOf(state: FakeState, address: unknown): string | undefined {
  if (typeof address !== 'string') return undefined
  return findByMaskedId(state, address)?.phone ?? normalizePhone(address)
}

export function failureMatches(state: FakeState, match: FailureMatch, body: Record<string, unknown>): boolean {
  if ('any' in match) return true
  const addrs = [body.destinationAddress, ...(Array.isArray(body.destinationAddresses) ? body.destinationAddresses : [])]
  const sub = body.subscriberId
  if (match.subscriberId !== undefined) {
    const want = match.subscriberId
    const wantPhone = normalizePhone(want)
    if (!(sub === want || (wantPhone !== undefined && phoneOf(state, sub) === wantPhone))) return false
  }
  if (match.destinationAddress !== undefined) {
    const want = match.destinationAddress
    const wantPhone = normalizePhone(want)
    if (!addrs.some((a) => a === want || (wantPhone !== undefined && phoneOf(state, a) === wantPhone))) return false
  }
  if (match.phone !== undefined) {
    const want = normalizePhone(match.phone)
    if (!want || ![sub, ...addrs].some((a) => phoneOf(state, a) === want)) return false
  }
  return true
}

/** Validate a `POST /_control/failures` body; returns an error message or undefined. */
export function validateFailure(f: Partial<ScriptedFailure> & Record<string, unknown>): string | undefined {
  if (typeof f.path !== 'string' || !f.path) return 'need path'
  if (!f.mode || !['timeout', 'http', 'error'].includes(f.mode)) return 'mode must be timeout, http or error'
  const m = f.match as Record<string, unknown> | undefined
  if (!m || typeof m !== 'object') return 'need match ({ any: true } or subscriberId/destinationAddress/phone)'
  if ('any' in m) {
    if (m.any !== true) return 'match.any must be true'
  } else {
    const keys = ['subscriberId', 'destinationAddress', 'phone'].filter((k) => m[k] !== undefined)
    if (keys.length === 0) return 'match is empty'
    if (keys.some((k) => typeof m[k] !== 'string' || !m[k])) return 'match fields must be non-empty strings'
  }
  if (f.times !== undefined && !(Number.isInteger(f.times) && f.times >= 1)) return 'times must be an integer >= 1'
  if (f.mode === 'http' && f.httpStatus !== undefined && !(Number.isInteger(f.httpStatus) && f.httpStatus >= 400 && f.httpStatus <= 599)) return 'httpStatus must be 400-599'
  if (f.mode === 'error') {
    if (f.statusCode !== undefined && (typeof f.statusCode !== 'string' || !f.statusCode)) return 'statusCode must be a string'
  }
  if (f.mode === 'timeout' && f.delayMs !== undefined && !(typeof f.delayMs === 'number' && f.delayMs >= 0 && Number.isFinite(f.delayMs))) return 'delayMs must be >= 0'
  return undefined
}

export function newMaskedId(): string {
  return `tel:${randomBytes(24).toString('base64url')}`
}

export function findByMaskedId(state: FakeState, address: string): Subscriber | undefined {
  for (const s of state.subscribers.values()) if (s.maskedId === address) return s
  return undefined
}

export function subscriberView(state: FakeState, phone: string): Subscriber | undefined {
  const s = state.subscribers.get(phone)
  return s && { ...s }
}

export function recordOtp(state: FakeState, otp: IssuedOtp) {
  const list = state.otpsByPhone.get(otp.phone) ?? []
  list.push(otp)
  state.otpsByPhone.set(otp.phone, list)
}
