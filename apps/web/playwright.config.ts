import { defineConfig } from '@playwright/test'
import { statePath } from './e2e/support/auth'

// `pnpm e2e` (e2e/run.ts) picks a free port and exports E2E_PORT.
const port = Number(process.env.E2E_PORT ?? 3100)
const baseURL = `http://localhost:${port}`

export default defineConfig({
  testDir: './e2e/tests',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  outputDir: './e2e/.results',
  use: { baseURL, storageState: statePath('seed'), trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', use: { viewport: { width: 1366, height: 900 } } }],
  webServer: {
    command: `pnpm exec next dev --port ${port}`,
    url: `${baseURL}/api/auth/status`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
