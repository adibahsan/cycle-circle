/**
 * Handbook screenshot capture. Not part of the E2E suite: playwright.config.ts never loads
 * ./handbook, and this config never loads ./tests. Run it with `pnpm handbook:capture` from the
 * repo root (builds both apps, resets the slot DB with the seed, then captures); see
 * docs/handbook/README.md for the contract.
 *
 * - `handbook-phone`:  handbook/screens/user/*.shots.ts   User screens at phone size.
 * - `handbook-admin`:  handbook/screens/admin/*.shots.ts  Admin screens at desktop size (ticket #245 fills it).
 * One `*.shots.ts` file per chapter, so tickets never edit the same file.
 */
import { defineConfig, devices } from '@playwright/test'
import { SLOT, URLS } from './support/slot.ts'
import { webServers } from './support/servers.ts'

const phone = { ...devices['Pixel 7'], deviceScaleFactor: 2 }
const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 }

export default defineConfig({
  globalSetup: './global-setup.ts',
  testMatch: /.*\.shots\.ts/,
  fullyParallel: true,
  workers: 3,
  retries: 0,
  reporter: [['list']],
  outputDir: `./.results/handbook-slot-${SLOT}`,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: { timezoneId: 'Asia/Dhaka', locale: 'en-US', trace: 'off' },
  projects: [
    { name: 'handbook-phone', testDir: './handbook/screens/user', use: { ...phone, baseURL: URLS.web } },
    { name: 'handbook-admin', testDir: './handbook/screens/admin', use: { ...desktop, baseURL: URLS.admin } },
  ],
  webServer: webServers(),
})
