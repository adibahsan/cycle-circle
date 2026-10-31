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

function parallelProjects(): Project[] {
  return [...pair('web', URLS.web), ...pair('admin', URLS.admin), ...pair('cross-app', URLS.web)]
}

/**
 * Desktop-only: cron/health/webhooks-bdapps are viewport-independent and must not race
 * parallel plan/user/broadcast specs (see README → Serial cron). Runs after every selected
 * parallel project; `dependencies` is filled in by `withCronDependencies`.
 */
function cronProject(): Project {
  return {
    name: 'cron',
    testDir: './tests/web',
    testMatch: CRON_SERIAL_SPECS,
    fullyParallel: false,
    workers: 1,
    use: { ...desktop, baseURL: URLS.web },
  }
}

function allProjects(): Project[] {
  return [...parallelProjects(), bengaliProject(), cronProject()]
}

/** Point `cron` at the parallel projects that are actually selected, so a desktop-only run never names a missing phone project. */
function withCronDependencies(selected: Project[]): Project[] {
  const parallel = new Set(parallelProjects().map((p) => p.name))
  const deps = selected.map((p) => p.name).filter((n): n is string => !!n && parallel.has(n))
  return selected.map((p) => (p.name === 'cron' ? { ...p, dependencies: deps } : p))
}

function projectNames(projects: Project[]): string {
  return projects.map((p) => p.name).filter(Boolean).join(', ')
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

function selectProjects(projects: Project[]): Project[] {
  const raw = process.env.CI_PROJECTS?.trim()
  let selected: Project[]
  if (raw) {
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
    const only = parts[0]
    if (parts.length === 1 && only && (only === 'desktop' || only === 'full' || only === 'all')) {
      selected = selectBySuite(projects, only)
    } else {
      selected = projects.filter((p) => p.name !== undefined && parts.includes(p.name))
    }
  } else {
    // `||` (not `??`): treat empty string as unset so CI misconfig falls back to all.
    selected = selectBySuite(projects, process.env.E2E_SUITE || 'all')
  }
  if (selected.length === 0) {
    throw new Error(
      `No Playwright projects selected (E2E_SUITE=${JSON.stringify(process.env.E2E_SUITE)}, CI_PROJECTS=${JSON.stringify(process.env.CI_PROJECTS)}). Valid names: ${projectNames(projects)}`,
    )
  }
  return selected
}

const reuse = process.env.E2E_REUSE_SERVERS === '1'
const serverLogs = process.env.E2E_SERVER_LOGS === '1' ? 'pipe' : 'ignore'
const ci = Boolean(process.env.CI)

const ALL_PROJECTS = allProjects()
// Fail fast if the PR desktop suite would be empty (misconfigured FULL_ONLY / naming).
if (selectBySuite(ALL_PROJECTS, 'desktop').length === 0) {
  throw new Error(
    `E2E_SUITE=desktop would select zero projects. Valid names: ${projectNames(ALL_PROJECTS)}`,
  )
}

export default defineConfig({
  globalSetup: './global-setup.ts',
  fullyParallel: true,
  // CI worker count lives here (single source). Serial projects must override with
  // `workers: 1` and `fullyParallel: false` on that project (see README).
  workers: ci ? 4 : undefined,
  retries: 0,
  forbidOnly: ci,
  reporter: ci
    ? [['list'], ['html', { open: 'never', outputFolder: `./playwright-report/slot-${SLOT}` }]]
    : [['list']],
  outputDir: `./.results/slot-${SLOT}`,
  // A GitHub runner is ~3x slower than a dev Mac (first CI run: 14.6 min vs 5.3 min); multi-step admin
  // flows (search debounce, broadcast send + fake poll) need the headroom there.
  timeout: ci ? 90_000 : 60_000,
  expect: { timeout: 10_000 },
  use: {
    timezoneId: 'Asia/Dhaka',
    locale: 'en-US',
    // Always retain traces on failure so CI can upload them without a second run.
    trace: 'retain-on-failure',
  },
  projects: withCronDependencies(selectProjects(ALL_PROJECTS)),
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
