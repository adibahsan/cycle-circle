import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { findFreePort } from './ports'

export interface DevServer { baseURL: string; stop: () => Promise<void> }

/** Start `next dev` on a free port in apps/web and wait until it answers. */
export async function startDevServer(timeoutMs = 180_000): Promise<DevServer> {
  const port = await findFreePort()
  const baseURL = `http://localhost:${port}`
  const child: ChildProcess = spawn('pnpm', ['exec', 'next', 'dev', '--port', String(port)], {
    cwd: path.resolve(__dirname, '../..'),
    stdio: 'ignore',
    detached: true,
  })
  const stop = async () => {
    try { process.kill(-child.pid!, 'SIGTERM') } catch {}
  }
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${baseURL}/api/auth/status`)
      if (r.status < 500) return { baseURL, stop }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000))
  }
  await stop()
  throw new Error(`dev server did not start on ${baseURL} within ${timeoutMs}ms`)
}
