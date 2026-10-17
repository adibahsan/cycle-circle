import { readFileSync } from 'fs'
import { resolve, join } from 'path'
import { tmpdir } from 'os'

process.env.TZ = 'UTC'

const envPath = resolve(__dirname, '../../.env.local')
try {
  const content = readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
} catch {
  // .env.local not found — rely on environment variables
}

// Server logs (ADR 0004): keep test runs out of ./logs and off stdout.
process.env.LOG_DIR ??= join(tmpdir(), 'vesta-test-logs')
process.env.LOG_STDOUT ??= 'false'
