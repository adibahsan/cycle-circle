import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

async function loadChecker() {
  vi.resetModules()
  return import('@vesta/shared/server/simulator/checker')
}

beforeEach(() => {
  vi.unstubAllEnvs()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('BDApps simulator URL resolution', () => {
  it('prefers explicit webhook URLs over webhook base URLs', async () => {
    vi.stubEnv('BDAPPS_WEBHOOK_BASE_URL', 'https://hooks.example/base/')
    vi.stubEnv('BDAPPS_SMS_RECEIVE_WEBHOOK_URL', 'https://override.example/custom-sms')
    vi.stubEnv('BDAPPS_SIMULATOR_CALLBACK_BASE_URL', '')

    const { callbackUrls, simulatorConfig } = await loadChecker()

    expect(callbackUrls(new Request('https://derived.example/tools'))).toEqual({
      smsReceive: 'https://override.example/custom-sms',
      smsReport: 'https://hooks.example/base/api/webhooks/sms/report',
      ussdReceive: 'https://hooks.example/base/api/webhooks/ussd/receive',
      subscriptionNotify: 'https://hooks.example/base/api/webhooks/subscription/notify',
      caasNotify: 'https://hooks.example/base/api/webhooks/caas/notify',
    })
    expect(simulatorConfig().callbackBaseUrl).toBe('http://host.docker.internal:3000')
  })

  it('falls back to the inferred request host and keeps capture URLs separate', async () => {
    vi.stubEnv('BDAPPS_WEBHOOK_BASE_URL', '')
    vi.stubEnv('BDAPPS_SIMULATOR_CALLBACK_BASE_URL', '')

    const { callbackUrls, simulatorCaptureUrls, simulatorConfig } = await loadChecker()
    const request = new Request('https://simulator-host.example/check')

    expect(callbackUrls(request)).toEqual({
      smsReceive: 'https://simulator-host.example/api/webhooks/sms/receive',
      smsReport: 'https://simulator-host.example/api/webhooks/sms/report',
      ussdReceive: 'https://simulator-host.example/api/webhooks/ussd/receive',
      subscriptionNotify: 'https://simulator-host.example/api/webhooks/subscription/notify',
      caasNotify: 'https://simulator-host.example/api/webhooks/caas/notify',
    })
    expect(simulatorCaptureUrls(request)).toEqual({
      smsReceive: 'https://simulator-host.example/api/simulator-check/webhooks/sms/receive',
      smsReport: 'https://simulator-host.example/api/simulator-check/webhooks/sms/report',
      ussdReceive: 'https://simulator-host.example/api/simulator-check/webhooks/ussd/receive',
      subscriptionNotify: 'https://simulator-host.example/api/simulator-check/webhooks/subscription/notify',
      caasNotify: 'https://simulator-host.example/api/simulator-check/webhooks/caas/notify',
    })
    expect(simulatorConfig(request).callbackBaseUrl).toBe('https://simulator-host.example')
  })

  it('uses the simulator callback base as the real webhook fallback when webhook base is unset', async () => {
    vi.stubEnv('BDAPPS_WEBHOOK_BASE_URL', '')
    vi.stubEnv('BDAPPS_SIMULATOR_CALLBACK_BASE_URL', 'https://callbacks.example/')

    const { callbackUrls, simulatorCaptureUrls, simulatorConfig } = await loadChecker()

    expect(callbackUrls()).toEqual({
      smsReceive: 'https://callbacks.example/api/webhooks/sms/receive',
      smsReport: 'https://callbacks.example/api/webhooks/sms/report',
      ussdReceive: 'https://callbacks.example/api/webhooks/ussd/receive',
      subscriptionNotify: 'https://callbacks.example/api/webhooks/subscription/notify',
      caasNotify: 'https://callbacks.example/api/webhooks/caas/notify',
    })
    expect(simulatorCaptureUrls().caasNotify).toBe(
      'https://callbacks.example/api/simulator-check/webhooks/caas/notify',
    )
    expect(simulatorConfig().callbackBaseUrl).toBe('https://callbacks.example')
  })

  it('defaults to host.docker.internal when no request host is available', async () => {
    vi.stubEnv('BDAPPS_WEBHOOK_BASE_URL', '')
    vi.stubEnv('BDAPPS_SIMULATOR_CALLBACK_BASE_URL', '')

    const { callbackUrls, simulatorCaptureUrls } = await loadChecker()

    expect(callbackUrls()).toEqual({
      smsReceive: 'http://host.docker.internal:3000/api/webhooks/sms/receive',
      smsReport: 'http://host.docker.internal:3000/api/webhooks/sms/report',
      ussdReceive: 'http://host.docker.internal:3000/api/webhooks/ussd/receive',
      subscriptionNotify: 'http://host.docker.internal:3000/api/webhooks/subscription/notify',
      caasNotify: 'http://host.docker.internal:3000/api/webhooks/caas/notify',
    })
    expect(simulatorCaptureUrls()).toEqual({
      smsReceive: 'http://host.docker.internal:3000/api/simulator-check/webhooks/sms/receive',
      smsReport: 'http://host.docker.internal:3000/api/simulator-check/webhooks/sms/report',
      ussdReceive: 'http://host.docker.internal:3000/api/simulator-check/webhooks/ussd/receive',
      subscriptionNotify: 'http://host.docker.internal:3000/api/simulator-check/webhooks/subscription/notify',
      caasNotify: 'http://host.docker.internal:3000/api/simulator-check/webhooks/caas/notify',
    })
  })

  it('only enables the checker in production when explicitly requested', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ENABLE_BDAPPS_SIMULATOR_CHECKER', 'false')

    let mod = await loadChecker()
    expect(mod.isSimulatorCheckerEnabled()).toBe(false)

    vi.stubEnv('ENABLE_BDAPPS_SIMULATOR_CHECKER', 'true')
    mod = await loadChecker()
    expect(mod.isSimulatorCheckerEnabled()).toBe(true)
  })
})
