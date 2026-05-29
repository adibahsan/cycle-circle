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
        throw new ApiError(
          502,
          `BDApps HTTP error: ${response.status} ${response.statusText}`,
          'BDAPPS_HTTP_ERROR',
        )
      }

      const data = (await response.json()) as Record<string, unknown>

      // BDApps uses "S1000" as the success status code
      const statusCode = data.statusCode as string | undefined
      if (statusCode !== undefined && statusCode !== 'S1000') {
        throw new ApiError(
          502,
          `BDApps error: ${statusCode}`,
          `BDAPPS_${statusCode}`,
        )
      }

      return data
    } catch (error) {
      lastError = error
      // Do not retry ApiErrors that come from a well-formed BDApps response
      if (error instanceof ApiError && error.code?.startsWith('BDAPPS_S')) {
        throw error
      }
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
  return `tel:${subscriberId}`
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
  const url = `${getBaseUrl()}/otp/request`
  const body: Record<string, unknown> = {
    ...authFields(),
    subscriberId: toTelUri(subscriberId),
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
 */
export async function verifyOtp(
  referenceNo: string,
  otp: string,
): Promise<OtpVerifyResult> {
  const url = `${getBaseUrl()}/otp/verify`
  const data = await fetchWithRetry(url, {
    ...authFields(),
    referenceNo,
    otp,
  })
  return {
    statusCode: data.statusCode as string,
    subscriptionStatus: data.subscriptionStatus as string,
    subscriberId: data.subscriberId as string,
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
    paymentInstrumentName: 'PaymentInstrument',
    amount,
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
  const url = `${getBaseUrl()}/caas/get/balance`
  const data = await fetchWithRetry(url, {
    ...authFields(),
    subscriberId: toTelUri(subscriberId),
    paymentInstrumentName: 'PaymentInstrument',
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
  const url = `${getBaseUrl()}/sms/send`
  const data = await fetchWithRetry(url, {
    ...authFields(),
    message,
    destinationAddresses,
    deliveryStatusRequest,
  })
  return {
    messageId: data.messageId as string,
    status: data.status as string,
  }
}
