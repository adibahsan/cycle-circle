/**
 * E2E suite against production builds of web + admin and the fake BDApps.
 * Run it through `pnpm e2e` (scripts/run.ts builds and resets the DB first); see README.md.
 *
 * Project selection in CI (no workflow edit when projects are added):
 * - `E2E_SUITE=desktop` — every project whose name does not end with `-phone` and is not
 *   in the full-only set (PR job). New `*-desktop` / serial projects (e.g. #132 cron) are
 *   included automatically.
 * - `E2E_SUITE=full` — all projects including `*-phone` and `web-bengali` (nightly / `e2e-full`).
 * - `CI_PROJECTS=a,b` — explicit project name list (overrides the suite).
 * - `CI_PROJECTS=desktop|full|all` — same as `E2E_SUITE`.
 */
import path from 'node:path'
import { defineConfig, devices, type Project } from '@playwright/test'
import { ENV, E2E_DIR, REPO_DIR, SLOT, URLS } from './support/slot.ts'

const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } }
const phone = devices['Pixel 7']

function pair(name: 'web' | 'admin' | 'cross-app', baseURL: string): Project[] {
  return [
    { name: `${name}-desktop`, testDir: `./tests/${name}`, use: { ...desktop, baseURL } },
    { name: `${name}-phone`, testDir: `./tests/${name}`, use: { ...phone, baseURL } },
  ]
}

/**
 * Bengali locale pass — hook for #133. Empty `tests/bengali/` until that ticket adds specs
 * (or tags existing flows with `@bengali` and points `testMatch` / grep here). Included only
 * when `E2E_SUITE=full`. A project with zero files is fine while other projects have tests.
 */
function bengaliProject(): Project {
  return {
    name: 'web-bengali',
    testDir: './tests/bengali',
    testMatch: /.*\.spec\.ts/,
    use: { ...desktop, baseURL: URLS.web, locale: 'bn-BD' },
  }
}

/** Projects that run only on nightly / `e2e-full` (not the PR desktop job). */
const FULL_ONLY = new Set(['web-bengali'])

function allProjects(): Project[] {
  return [...pair('web', URLS.web), ...pair('admin', URLS.admin), ...pair('cross-app', URLS.web), bengaliProject()]
}

function selectProjects(projects: Project[]): Project[] {
  const raw = process.env.CI_PROJECTS?.trim()
  if (raw) {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
    const only = parts[0]
    if (parts.length === 1 && only && (only === 'desktop' || only === 'full' || only === 'all')) {
      return selectBySuite(projects, only)
    }
    return projects.filter((p) => p.name !== undefined && parts.includes(p.name))
  }
  return selectBySuite(projects, process.env.E2E_SUITE ?? 'all')
}

function selectBySuite(projects: Project[], suite: string): Project[] {
  if (suite === 'full' || suite === 'all') return projects
  if (suite === 'desktop') {
    return projects.filter((p) => {
      const name = p.name ?? ''
      return !name.endsWith('-phone') && !FULL_ONLY.has(name)
    })
  }
  throw new Error(`E2E_SUITE/CI_PROJECTS must be desktop|full|all or a project list, got "${suite}"`)
}

const reuse = process.env.E2E_REUSE_SERVERS === '1'
const serverLogs = process.env.E2E_SERVER_LOGS === '1' ? 'pipe' : 'ignore'
const ci = Boolean(process.env.CI)

export default defineConfig({
  globalSetup: './global-setup.ts',
  fullyParallel: true,
  workers: ci ? 4 : undefined,
  retries: 0,
  forbidOnly: ci,
  reporter: ci
    ? [['list'], ['html', { open: 'never', outputFolder: `./playwright-report/slot-${SLOT}` }]]
    : [['list']],
  outputDir: `./.results/slot-${SLOT}`,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    timezoneId: 'Asia/Dhaka',
    locale: 'en-US',
    // Always retain traces on failure so CI can upload them without a second run.
    trace: 'retain-on-failure',
  },
  projects: selectProjects(allProjects()),
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
