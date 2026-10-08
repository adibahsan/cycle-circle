/** `pnpm e2e`: pick a free port, then run Playwright against a dev server on it. */
import { spawn } from 'node:child_process'
import { findFreePort } from './support/ports'

async function main() {
  const port = await findFreePort()
  console.log(`[e2e] using port ${port}`)
  const child = spawn('pnpm', ['exec', 'playwright', 'test', ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, E2E_PORT: String(port) },
  })
  child.on('exit', (code) => process.exit(code ?? 1))
}
void main()
