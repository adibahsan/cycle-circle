import { env } from '../../utils/env'

export interface SimulatorUrlSet {
  smsReceive: string
  smsReport: string
  ussdReceive: string
  subscriptionNotify: string
  caasNotify: string
}

const DEFAULT_SIMULATOR_REST_BASE_URL = 'http://127.0.0.1:7002'
const DEFAULT_SIMULATOR_UI_URL = 'http://localhost:10001/mchoice-tap-sdk'
const DEFAULT_SIMULATOR_CALLBACK_BASE_URL = 'http://host.docker.internal:3000'

const REAL_WEBHOOK_PATHS = {
  smsReceive: '/api/webhooks/sms/receive',
  smsReport: '/api/webhooks/sms/report',
  ussdReceive: '/api/webhooks/ussd/receive',
  subscriptionNotify: '/api/webhooks/subscription/notify',
  caasNotify: '/api/webhooks/caas/notify',
} as const

const SIMULATOR_CAPTURE_PATHS = {
  smsReceive: '/api/simulator-check/webhooks/sms/receive',
  smsReport: '/api/simulator-check/webhooks/sms/report',
  ussdReceive: '/api/simulator-check/webhooks/ussd/receive',
  subscriptionNotify: '/api/simulator-check/webhooks/subscription/notify',
  caasNotify: '/api/simulator-check/webhooks/caas/notify',
} as const

type UrlSourceKey = keyof SimulatorUrlSet

export function resolveSimulatorConfig(request?: Request) {
  return {
    restBaseUrl: trimTrailingSlash(env.BDAPPS_SIMULATOR_BASE_URL || DEFAULT_SIMULATOR_REST_BASE_URL),
    uiUrl: env.BDAPPS_SIMULATOR_UI_URL || DEFAULT_SIMULATOR_UI_URL,
    callbackBaseUrl: trimTrailingSlash(resolveSimulatorCallbackBaseUrl(request)),
  }
}

export function resolveWebhookUrls(request?: Request): SimulatorUrlSet {
  const baseUrl = resolveWebhookBaseUrl(request)
  return resolveUrlSet(baseUrl, REAL_WEBHOOK_PATHS, {
    smsReceive: env.BDAPPS_SMS_RECEIVE_WEBHOOK_URL,
    smsReport: env.BDAPPS_SMS_REPORT_WEBHOOK_URL,
    ussdReceive: env.BDAPPS_USSD_RECEIVE_WEBHOOK_URL,
    subscriptionNotify: env.BDAPPS_SUBSCRIPTION_NOTIFY_WEBHOOK_URL,
    caasNotify: env.BDAPPS_CAAS_NOTIFY_WEBHOOK_URL,
  })
}

export function resolveSimulatorCaptureUrls(request?: Request): SimulatorUrlSet {
  return resolveUrlSet(resolveSimulatorCallbackBaseUrl(request), SIMULATOR_CAPTURE_PATHS)
}

function resolveWebhookBaseUrl(request?: Request) {
  return trimTrailingSlash(
    env.BDAPPS_WEBHOOK_BASE_URL ||
      env.BDAPPS_SIMULATOR_CALLBACK_BASE_URL ||
      inferRequestBaseUrl(request) ||
      DEFAULT_SIMULATOR_CALLBACK_BASE_URL,
  )
}

function resolveSimulatorCallbackBaseUrl(request?: Request) {
  return trimTrailingSlash(
    env.BDAPPS_SIMULATOR_CALLBACK_BASE_URL || inferRequestBaseUrl(request) || DEFAULT_SIMULATOR_CALLBACK_BASE_URL,
  )
}

function resolveUrlSet(
  baseUrl: string,
  paths: Record<UrlSourceKey, string>,
  explicitUrls: Partial<Record<UrlSourceKey, string>> = {},
): SimulatorUrlSet {
  return {
    smsReceive: resolveUrl(explicitUrls.smsReceive, baseUrl, paths.smsReceive),
    smsReport: resolveUrl(explicitUrls.smsReport, baseUrl, paths.smsReport),
    ussdReceive: resolveUrl(explicitUrls.ussdReceive, baseUrl, paths.ussdReceive),
    subscriptionNotify: resolveUrl(explicitUrls.subscriptionNotify, baseUrl, paths.subscriptionNotify),
    caasNotify: resolveUrl(explicitUrls.caasNotify, baseUrl, paths.caasNotify),
  }
}

function resolveUrl(explicitUrl: string | undefined, baseUrl: string, path: string) {
  if (explicitUrl) return trimTrailingSlash(explicitUrl)
  return joinUrl(baseUrl, path)
}

function inferRequestBaseUrl(request?: Request) {
  if (!request) return null

  const host = request.headers.get('x-forwarded-host')?.trim() || request.headers.get('host')?.trim()
  if (host) {
    const protocol =
      request.headers.get('x-forwarded-proto')?.trim() || safeRequestProtocol(request) || 'http'
    return `${protocol}://${host}`
  }

  try {
    return new URL(request.url).origin
  } catch {
    return null
  }
}

function safeRequestProtocol(request: Request) {
  try {
    return new URL(request.url).protocol.replace(/:$/, '')
  } catch {
    return null
  }
}

function joinUrl(baseUrl: string, path: string) {
  const base = trimTrailingSlash(baseUrl)
  const normalizedPath = path.replace(/^\/+/, '')
  return new URL(normalizedPath, `${base}/`).toString().replace(/\/+$/, '')
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}
