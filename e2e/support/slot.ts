/**
 * One place that turns `E2E_SLOT` into ports, URLs, the database and the env each
 * process gets. Slot N lets N+1 worktrees run the suite at once on one machine:
 * every port and the database name are offset; Mailpit is shared.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const E2E_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const REPO_DIR = path.resolve(E2E_DIR, '..')

function readSlot(): number {
  const raw = process.env.E2E_SLOT ?? '0'
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0 || n > 99) throw new Error(`E2E_SLOT must be an integer 0-99, got "${raw}"`)
  return n
}

export const SLOT = readSlot()

export const PORTS = {
  web: 4100 + SLOT,
  admin: 4200 + SLOT,
  fakeBdapps: 4300 + SLOT,
}

// `localhost`, not 127.0.0.1: the auth cookie is Secure in production, and browsers
// only accept Secure cookies over plain http on localhost.
export const URLS = {
  web: `http://localhost:${PORTS.web}`,
  admin: `http://localhost:${PORTS.admin}`,
  fakeBdapps: `http://localhost:${PORTS.fakeBdapps}`,
  mailpit: process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025',
}

export const DB_NAME = SLOT === 0 ? 'vesta_e2e' : `vesta_e2e_${SLOT}`

/** Read KEY=value lines from a dotenv file (no expansion); empty object if it doesn't exist. */
function readDotenv(file: string): Record<string, string> {
  if (!fs.existsSync(file)) return {}
  const out: Record<string, string> = {}
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return out
}

/**
 * The E2E database URL: the local dev Postgres server (from `E2E_DATABASE_URL`, else
 * packages/shared/.env.local), with the database swapped for this slot's `vesta_e2e*`.
 */
function databaseUrl(): string {
  const base =
    process.env.E2E_DATABASE_URL ??
    readDotenv(path.join(REPO_DIR, 'packages/shared/.env.local')).DATABASE_URL ??
    'postgresql://vesta_user:vesta_dev@localhost:5431/vesta_dev'
  const url = new URL(base)
  url.pathname = `/${DB_NAME}`
  return url.toString()
}

export const DATABASE_URL = databaseUrl()

/** Refuse to touch anything that isn't an E2E database. */
export function assertE2eDatabase(url: string = DATABASE_URL): void {
  const name = new URL(url).pathname.slice(1)
  if (!/^vesta_e2e(_\d+)?$/.test(name)) throw new Error(`Refusing to use non-E2E database "${name}"`)
}

/** Shared test credentials. Fixed values: they only ever meet the fake BDApps and a local DB. */
export const SECRETS = {
  bdappsAppId: 'APP_E2E',
  bdappsPassword: 'e2e-bdapps-password',
  cronSecret: 'e2e-cron-secret-0123456789abcdef',
  webJwt: 'local-dev-e2e-web-jwt-secret-0123456789abcdef',
  adminJwt: 'local-dev-e2e-admin-jwt-secret-0123456789abcdef',
  adminEmail: 'admin@vesta.health',
  adminPassword: 'admin123',
}

const LOG_ROOT = path.join(E2E_DIR, '.logs', `slot-${SLOT}`)
const UPLOAD_DIR = path.join(E2E_DIR, '.uploads', `slot-${SLOT}`)

/**
 * Env shared by build and start of both apps. Every key the apps read is set
 * explicitly (empty string = off), so nothing leaks in from the apps' .env.local.
 */
function appEnv(app: 'web' | 'admin'): Record<string, string> {
  return {
    NODE_ENV: 'production',
    APP_ENV: 'local',
    DEV_MODE: 'false',
    NEXT_PUBLIC_DEV_MODE: 'false',
    NEXT_PUBLIC_USE_DUMMY_DATA: 'false',
    NEXT_TELEMETRY_DISABLED: '1',
    DATABASE_URL,
    DIRECT_URL: DATABASE_URL,
    // No Redis: rate limits and the JWT blacklist live in each app process, so slots never share state.
    REDIS_URL: '',
    BDAPPS_APP_ID: SECRETS.bdappsAppId,
    BDAPPS_PASSWORD: SECRETS.bdappsPassword,
    BDAPPS_BASE_URL: URLS.fakeBdapps,
    BDAPPS_SIMULATOR_BASE_URL: '',
    BDAPPS_SIMULATOR_UI_URL: '',
    BDAPPS_SIMULATOR_CALLBACK_BASE_URL: '',
    ENABLE_BDAPPS_SIMULATOR_CHECKER: 'false',
    // Empty = accept webhooks from any source (the fake BDApps posts from localhost).
    BDAPPS_WEBHOOK_IPS: '',
    JWT_SECRET: app === 'web' ? SECRETS.webJwt : SECRETS.adminJwt,
    AUTH_COOKIE_NAME: app === 'web' ? 'vesta_token' : 'vesta_admin_token',
    APP_URL: URLS.web,
    CRON_SECRET: SECRETS.cronSecret,
    // No Resend key: email goes to Mailpit over SMTP.
    RESEND_API_KEY: '',
    RESEND_WEBHOOK_SECRET: '',
    MAILPIT_SMTP_URL: process.env.E2E_MAILPIT_SMTP_URL ?? 'smtp://localhost:1025',
    MAILPIT_UI_URL: URLS.mailpit,
    LOG_DIR: path.join(LOG_ROOT, app),
    UPLOAD_DIR,
  }
}

export const ENV = {
  web: appEnv('web'),
  admin: appEnv('admin'),
  fakeBdapps: {
    FAKE_BDAPPS_PORT: String(PORTS.fakeBdapps),
    FAKE_BDAPPS_APP_ID: SECRETS.bdappsAppId,
    FAKE_BDAPPS_PASSWORD: SECRETS.bdappsPassword,
    FAKE_BDAPPS_APP_URL: URLS.web,
  },
  /** For `prisma migrate reset` + seed. NODE_ENV left unset so the seed adds its demo user. */
  db: { DATABASE_URL, DIRECT_URL: DATABASE_URL, ADMIN_EMAIL: SECRETS.adminEmail, ADMIN_PASSWORD: SECRETS.adminPassword },
}

export const AUTH_DIR = path.join(E2E_DIR, '.auth', `slot-${SLOT}`)
