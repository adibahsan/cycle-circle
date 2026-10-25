import { test, expect } from '../../support/fixtures'

/**
 * The health route GETs BDAPPS_SIMULATOR_UI_URL (not a merchant endpoint), which the E2E env
 * points at the fake's `/health`. That is a faithful model of what the route checks: it is
 * "up" for any HTTP status below 500 and "down" for 5xx, a network error or a 4s timeout.
 *
 * Scripted failures are global per path in the shared fake, and Playwright runs tests in
 * parallel, so the up, 5xx and timeout phases live in ONE test that is the only user of
 * `/health`, and it runs on the desktop project only (desktop and phone would race).
 */
test.describe('BDApps health endpoint', () => {
  test('reports up, then down while BDApps is scripted to fail, then up again', async ({ page, fakeBdapps }, testInfo) => {
    test.skip(testInfo.project.name !== 'web-desktop', 'shares the fake BDApps failure queue; one project only')
    const health = () => page.request.get('/api/health/bdapps')

    const up = await health()
    expect(up.status()).toBe(200)
    expect(await up.json()).toMatchObject({ status: 'ok' })

    // A BDApps status code, for the next 2 calls only.
    await fakeBdapps.failNext('/health', { mode: 'http', httpStatus: 503, times: 2 })
    for (let i = 0; i < 2; i++) {
      const down = await health()
      expect(down.status()).toBe(503)
      expect(await down.json()).toMatchObject({ status: 'error', httpStatus: 503 })
    }
    expect((await health()).status()).toBe(200)

    // A timeout (the fake drops the socket), for the next call only.
    await fakeBdapps.failNext('/health', { mode: 'timeout', delayMs: 100, times: 1 })
    const timedOut = await health()
    expect(timedOut.status()).toBe(503)
    const body = await timedOut.json()
    expect(body.status).toBe('error')
    expect(body.message).toBeTruthy()

    // Cleared: up again.
    expect(await (await health()).json()).toMatchObject({ status: 'ok' })
  })
})
