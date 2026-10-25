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
 * A queued failure: the next `times` calls to `path` fail instead of running the route.
 * `error` answers HTTP 200 with a BDApps status code (e.g. E1601); `http` answers a bare
 * HTTP error; `timeout` never answers.
 */
export interface ScriptedFailure {
  path: string
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
