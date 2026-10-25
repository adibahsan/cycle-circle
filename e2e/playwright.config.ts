/**
 * E2E suite against production builds of web + admin and the fake BDApps.
 * Run it through `pnpm e2e` (scripts/run.ts builds and resets the DB first); see README.md.
 */
import path from 'node:path'
import { defineConfig, devices, type Project } from '@playwright/test'
import { ENV, E2E_DIR, REPO_DIR, SLOT, URLS } from './support/slot.ts'

const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } }
const phone = devices['Pixel 7']

/**
 * Specs that mutate shared slot state (every Pro user, every soft-deleted user,
 * the fake `/health` failure queue, or broadcast dispatch). They run in the
 * serial `cron` project after all parallel projects finish — see README.
 */
export const CRON_SERIAL_SPECS =
  /(?:^|[/\\])(cron-daily-reminders|cron-nightly-maintenance|cron-caas-check|webhooks-bdapps|health|bdapps-health)\.spec\.ts$/

function pair(name: 'web' | 'admin' | 'cross-app', baseURL: string): Project[] {
  const ignore = name === 'web' ? { testIgnore: CRON_SERIAL_SPECS } : {}
  return [
    { name: `${name}-desktop`, testDir: `./tests/${name}`, use: { ...desktop, baseURL }, ...ignore },
    { name: `${name}-phone`, testDir: `./tests/${name}`, use: { ...phone, baseURL }, ...ignore },
  ]
}

const reuse = process.env.E2E_REUSE_SERVERS === '1'
const serverLogs = process.env.E2E_SERVER_LOGS === '1' ? 'pipe' : 'ignore'

const parallelProjects = [...pair('web', URLS.web), ...pair('admin', URLS.admin), ...pair('cross-app', URLS.web)]

export default defineConfig({
  globalSetup: './global-setup.ts',
  fullyParallel: true,
  workers: process.env.CI ? 4 : undefined,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list']],
  outputDir: `./.results/slot-${SLOT}`,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    timezoneId: 'Asia/Dhaka',
    locale: 'en-US',
    trace: 'retain-on-failure',
  },
  projects: [
    ...parallelProjects,
    {
      // Desktop-only: cron/health/webhooks-bdapps are viewport-independent and
      // must not race parallel plan/user/broadcast specs (see README → Serial cron).
      name: 'cron',
      testDir: './tests/web',
      testMatch: CRON_SERIAL_SPECS,
      dependencies: parallelProjects.map((p) => p.name as string),
      fullyParallel: false,
      workers: 1,
      use: { ...desktop, baseURL: URLS.web },
    },
  ],
  webServer: [
    {
      command: 'pnpm exec tsx fake-bdapps/main.ts',
      cwd: E2E_DIR,
      env: ENV.fakeBdapps,
      url: `${URLS.fakeBdapps}/_control/health`,
      reuseExistingServer: reuse,
      stdout: serverLogs,
      stderr: 'pipe',
    },
    {
      command: `pnpm exec next start --port ${new URL(URLS.web).port}`,
      cwd: path.join(REPO_DIR, 'apps/web'),
      env: ENV.web,
      url: `${URLS.web}/api/health/db`,
      reuseExistingServer: reuse,
      timeout: 120_000,
      stdout: serverLogs,
      stderr: 'pipe',
    },
    {
      command: `pnpm exec next start --port ${new URL(URLS.admin).port}`,
      cwd: path.join(REPO_DIR, 'apps/admin'),
      env: ENV.admin,
      url: `${URLS.admin}/login`,
      reuseExistingServer: reuse,
      timeout: 120_000,
      stdout: serverLogs,
      stderr: 'pipe',
    },
  ],
})
