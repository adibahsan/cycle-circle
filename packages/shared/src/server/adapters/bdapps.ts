import { env } from '../../utils/env'
import { ApiError } from '../api-error'

// ─── Base URL resolution ──────────────────────────────────────────────────────

function getBaseUrl(): string {
  if (env.BDAPPS_SIMULATOR_BASE_URL && env.NODE_ENV === 'development') {
    return env.BDAPPS_SIMULATOR_BASE_URL
  }
  return env.BDAPPS_BASE_URL
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

const RETRY_DELAYS = [1000, 2000, 4000]

/** Wraps an error that retrying cannot fix, so the retry loop rethrows it at once. */
class NonRetryable {
  constructor(readonly error: ApiError) {}
}

async function fetchWithRetry(
  url: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let lastError: unknown

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const err = new ApiError(
          502,
          `BDApps HTTP error: ${response.status} ${response.statusText}`,
          'BDAPPS_HTTP_ERROR',
        )
        // 4xx (e.g. a 404 on a disabled API) won't fix itself on retry
        if (response.status < 500) throw new NonRetryable(err)
        throw err
      }

      const data = (await response.json()) as Record<string, unknown>

      // BDApps uses "S1000" as the success status code
      const statusCode = data.statusCode as string | undefined
      if (statusCode !== undefined && statusCode !== 'S1000') {
        // A well-formed BDApps error (wrong OTP, unregistered user, …) is final
        throw new NonRetryable(
          new ApiError(
            502,
            `BDApps error: ${statusCode}${data.statusDetail ? ` (${data.statusDetail})` : ''}`,
            `BDAPPS_${statusCode}`,
          ),
        )
      }

      return data
    } catch (error) {
      if (error instanceof NonRetryable) throw error.error
      lastError = error
      if (attempt < RETRY_DELAYS.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAYS[attempt]),
        )
      }
    }
  }

  throw lastError
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toTelUri(subscriberId: string): string {
  if (subscriberId.startsWith('tel:')) return subscriberId
  if (subscriberId.startsWith('+88')) return `tel:88${subscriberId.slice(3)}`
  return `tel:${subscriberId}`
}

/**
 * Map a BDApps subscriber id (`tel:8801XXXXXXXXX`) to our stored phone format
 * (`+8801XXXXXXXXX`). Returns null for masked ids, which BDApps can send instead.
 */
export function phoneFromSubscriberId(subscriberId: string): string | null {
  const digits = subscriberId.replace(/^tel:/, '')
  return /^8801\d{9}$/.test(digits) ? `+${digits}` : null
}

export type SubscriptionStatusValue = 'REGISTERED' | 'UNREGISTERED' | string

/** BDApps samples send "REGISTERED." with a trailing dot; strip it and upper-case. */
export function normalizeSubscriptionStatus(status: unknown): SubscriptionStatusValue {
  if (typeof status !== 'string') return ''
  return status.trim().replace(/\.$/, '').toUpperCase()
}

/** E1951 = "Format of the address is invalid Or User Already UnRegistered". */
function isUnregisteredError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'BDAPPS_E1951'
}

function authFields() {
  if (!env.BDAPPS_APP_ID || !env.BDAPPS_PASSWORD) {
    throw new Error('BDAPPS_APP_ID and BDAPPS_PASSWORD must be set')
  }
  return {
    applicationId: env.BDAPPS_APP_ID,
    password: env.BDAPPS_PASSWORD,
  }
}

// ─── OTP ─────────────────────────────────────────────────────────────────────

export interface OtpRequestResult {
  statusCode: string
  referenceNo: string
}

/**
 * Request an OTP for the given subscriber. The optional `applicationHash` is
 * used by the Android SMS auto-fill API.
 */
export async function requestOtp(
  subscriberId: string,
  applicationHash?: string,
): Promise<OtpRequestResult> {
  const url = `${getBaseUrl()}/subscription/otp/request`
  const body: Record<string, unknown> = {
    ...authFields(),
    subscriberId: toTelUri(subscriberId),
    applicationMetaData: {
      client: 'WEBAPP',
      device: 'Browser',
      os: 'Web',
      appCode: env.APP_URL,
    },
  }
  if (applicationHash) body.applicationHash = applicationHash

  const data = await fetchWithRetry(url, body)
  return {
    statusCode: data.statusCode as string,
    referenceNo: data.referenceNo as string,
  }
}

export interface OtpVerifyResult {
  statusCode: string
  subscriptionStatus: string
  subscriberId: string
}

/**
 * Verify an OTP against the reference number returned by `requestOtp`.
 * A successful verify also subscribes the number to the app on BDApps
 * (`subscriptionStatus: "REGISTERED"`). `subscriberId` may be masked.
 */
export async function verifyOtp(
  referenceNo: string,
  otp: string,
): Promise<OtpVerifyResult> {
  const url = `${getBaseUrl()}/subscription/otp/verify`
  const data = await fetchWithRetry(url, {
    ...authFields(),
    referenceNo,
    otp,
  })
  return {
    statusCode: data.statusCode as string,
    subscriptionStatus: normalizeSubscriptionStatus(data.subscriptionStatus),
    subscriberId: data.subscriberId as string,
  }
}

// ─── Subscription ─────────────────────────────────────────────────────────────

/**
 * Current BDApps subscription status for a number. An unregistered number comes
 * back as error E1951, which we report as UNREGISTERED rather than throwing.
 */
export async function getSubscriptionStatus(
  subscriberId: string,
): Promise<SubscriptionStatusValue> {
  if (env.DEV_MODE) return 'REGISTERED'
  try {
    const data = await fetchWithRetry(`${getBaseUrl()}/subscription/getStatus`, {
      ...authFields(),
      subscriberId: toTelUri(subscriberId),
    })
    return normalizeSubscriptionStatus(data.subscriptionStatus)
  } catch (error) {
    if (isUnregisteredError(error)) return 'UNREGISTERED'
    throw error
  }
}

/**
 * Subscribe or unsubscribe a number (`/subscription/send`, action "1" / "0").
 * Unsubscribing an already-unregistered number counts as success.
 */
export async function setSubscription(
  subscriberId: string,
  action: 'subscribe' | 'unsubscribe',
): Promise<SubscriptionStatusValue> {
  if (env.DEV_MODE) return action === 'subscribe' ? 'REGISTERED' : 'UNREGISTERED'
  try {
    const data = await fetchWithRetry(`${getBaseUrl()}/subscription/send`, {
      ...authFields(),
      subscriberId: toTelUri(subscriberId),
      action: action === 'subscribe' ? '1' : '0',
    })
    return normalizeSubscriptionStatus(data.subscriptionStatus)
  } catch (error) {
    if (action === 'unsubscribe' && isUnregisteredError(error)) return 'UNREGISTERED'
    throw error
  }
}

// ─── CaaS ─────────────────────────────────────────────────────────────────────

export interface CaasDebitResult {
  statusCode: string
  externalTrxId: string
  internalTrxId: string
  referenceId: string
  timeStamp: string
}

/**
 * Charge a subscriber's wallet via the CaaS direct-debit API.
 */
export async function caasDirectDebit(
  subscriberId: string,
  externalTrxId: string,
  amount: number,
): Promise<CaasDebitResult> {
  const url = `${getBaseUrl()}/caas/direct/debit`
  const data = await fetchWithRetry(url, {
    ...authFields(),
    externalTrxId,
    subscriberId: toTelUri(subscriberId),
    paymentInstrumentName: 'MobileAccount',
    amount: String(amount),
    currency: 'BDT',
  })
  return {
    statusCode: data.statusCode as string,
    externalTrxId: data.externalTrxId as string,
    internalTrxId: data.internalTrxId as string,
    referenceId: data.referenceId as string,
    timeStamp: data.timeStamp as string,
  }
}

export interface CaasBalanceResult {
  statusCode: string
  accountType: string
  accountStatus: string
  chargeableBalance: string
}

/**
 * Query the chargeable balance for a subscriber.
 */
export async function caasGetBalance(
  subscriberId: string,
): Promise<CaasBalanceResult> {
  // Dev: skip the simulator and report a synthetic healthy balance so the
  // caas-check cron doesn't ECONNREFUSED + retry against a non-running service.
  if (env.DEV_MODE || (env.NODE_ENV === 'development' && !env.BDAPPS_SIMULATOR_BASE_URL)) {
    console.log('[CAAS][dev] (not queried — simulator skipped) balance for', subscriberId)
    return {
      statusCode: 'S1000',
      accountType: 'PREPAID',
      accountStatus: 'ACTIVE',
      chargeableBalance: '1000',
    }
  }
  const url = `${getBaseUrl()}/caas/get/balance`
  const data = await fetchWithRetry(url, {
    ...authFields(),
    subscriberId: toTelUri(subscriberId),
    paymentInstrumentName: 'MobileAccount',
  })
  return {
    statusCode: data.statusCode as string,
    accountType: data.accountType as string,
    accountStatus: data.accountStatus as string,
    chargeableBalance: data.chargeableBalance as string,
  }
}

// ─── SMS ──────────────────────────────────────────────────────────────────────

export interface SmsSendResult {
  requestId?: string
  /** Message id of the first destination (the only one for `tel:all` broadcasts). */
  messageId: string
  status: string
}

/**
 * Send an SMS to one or more destination addresses.
 *
 * @param deliveryStatusRequest 1 = request delivery report, 0 = no report
 */
export async function smsSend(
  message: string,
  destinationAddresses: string[],
  deliveryStatusRequest = 1,
): Promise<SmsSendResult> {
  // Dev: the BDApps simulator usually isn't running locally — log the message to
  // the console instead of POSTing to it (avoids ECONNREFUSED + retry backoff).
  if (env.DEV_MODE || (env.NODE_ENV === 'development' && !env.BDAPPS_SIMULATOR_BASE_URL)) {
    console.log('[SMS][dev] (not sent — simulator skipped) →', destinationAddresses, '|', message)
    return { messageId: `dev-${Date.now()}`, status: 'DEV' }
  }
  const url = `${getBaseUrl()}/sms/send`
  const data = await fetchWithRetry(url, {
    ...authFields(),
    version: '1.0',
    message,
    destinationAddresses: destinationAddresses.map(toTelUri),
    deliveryStatusRequest: String(deliveryStatusRequest),
  })
  const first = (data.destinationResponses as Array<Record<string, unknown>> | undefined)?.[0]
  return {
    requestId: data.requestId as string | undefined,
    messageId: (first?.messageId as string | undefined) ?? '',
    status: (first?.statusCode as string | undefined) ?? (data.statusCode as string),
  }
}
