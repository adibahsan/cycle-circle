/**
 * The three processes every Playwright run needs: fake BDApps plus production builds of web and admin.
 * Shared by playwright.config.ts (the E2E suite) and playwright.handbook.config.ts (screenshot capture).
 */
import path from 'node:path'
import type { PlaywrightTestConfig } from '@playwright/test'
import { ENV, E2E_DIR, REPO_DIR, URLS } from './slot.ts'

export function webServers(): NonNullable<PlaywrightTestConfig['webServer']> {
  const reuse = process.env.E2E_REUSE_SERVERS === '1'
  const serverLogs = process.env.E2E_SERVER_LOGS === '1' ? 'pipe' : 'ignore'
  return [
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
  ]
}
