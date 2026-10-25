/**
 * Stateful fake BDApps for E2E. The apps reach it through BDAPPS_BASE_URL exactly as
 * they reach the real one; tests drive and inspect it through `/_control/*`.
 *
 * Extending it (#118 and later):
 *   - a new merchant endpoint = one entry in `merchantRoutes` (merchant-routes.ts);
 *   - every merchant call is recorded in `state.calls` automatically;
 *   - scripted failures are consumed per path before the route runs (`failures`);
 *   - BDApps-initiated traffic goes through `postToApp` (`POST /_control/webhook`).
 */
import http from 'node:http'
import { merchantRoutes } from './merchant-routes.ts'
import {
  type FakeConfig,
  type FakeState,
  type ScriptedFailure,
  createState,
  failureMatches,
  validateFailure,
  normalizePhone,
  subscriberView,
} from './state.ts'

export type { FakeConfig } from './state.ts'

export interface FakeBdapps {
  server: http.Server
  state: FakeState
  listen(port: number): Promise<void>
  close(): Promise<void>
}

function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let s = ''
    req.on('data', (c) => (s += c))
    req.on('end', () => {
      try {
        resolve(s ? JSON.parse(s) : {})
      } catch {
        resolve({})
      }
    })
  })
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

export function createFakeBdapps(config: FakeConfig): FakeBdapps {
  const state = createState(config)

  /** POST a BDApps-initiated request (webhook) to the app, as BDApps would. */
  async function postToApp(path: string, body: unknown) {
    const res = await fetch(new URL(path, config.appUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    let json: unknown = text
    try {
      json = JSON.parse(text)
    } catch {}
    return { status: res.status, body: json }
  }

  /** Pending timeout-mode destroy timers, cleared on close so the process can exit. */
  const timers = new Set<NodeJS.Timeout>()

  function takeFailure(path: string, body: Record<string, unknown>): ScriptedFailure | undefined {
    const i = state.failures.findIndex((f) => f.path === path && failureMatches(state, f.match, body))
    if (i === -1) return undefined
    const f = state.failures[i]
    f.times -= 1
    if (f.times <= 0) state.failures.splice(i, 1)
    return f
  }

  async function handleMerchant(path: string, req: http.IncomingMessage, res: http.ServerResponse) {
    const body = await readJson(req)
    const call = { seq: state.calls.length + 1, at: new Date().toISOString(), path, body, httpStatus: 200, response: {} as Record<string, unknown> }
    state.calls.push(call)

    const failure = takeFailure(path, body)
    if (failure?.mode === 'timeout') {
      call.httpStatus = 0
      call.response = { timeout: true }
      // Never answer; the app's fetch gives up (or the socket is destroyed after the delay).
      const timer = setTimeout(() => {
        timers.delete(timer)
        req.socket.destroy()
      }, failure.delayMs ?? 30_000)
      timers.add(timer)
      return
    }
    if (failure?.mode === 'http') {
      call.httpStatus = failure.httpStatus ?? 503
      call.response = { error: 'scripted http failure' }
      return send(res, call.httpStatus, call.response)
    }
    if (failure?.mode === 'error') {
      call.response = { statusCode: failure.statusCode ?? 'E1601', statusDetail: failure.statusDetail ?? 'Scripted failure', version: '1.0' }
      return send(res, 200, call.response)
    }

    // Health endpoint for the app's BDApps health check (GET, no credentials required)
    if (path === '/health' && req.method === 'GET') {
      return send(res, 200, { status: 'ok' })
    }

    const route = merchantRoutes[path]
    if (!route) {
      call.httpStatus = 404
      call.response = { error: 'not implemented in fake BDApps' }
      return send(res, 404, call.response)
    }
    if (body.applicationId !== config.appId || body.password !== config.password) {
      call.response = { statusCode: 'E1313', statusDetail: 'Authentication failed.', version: '1.0' }
      return send(res, 200, call.response)
    }
    call.response = route(body, state)
    return send(res, 200, call.response)
  }

  async function handleControl(path: string, url: URL, req: http.IncomingMessage, res: http.ServerResponse) {
    const method = req.method ?? 'GET'
    if (path === '/_control/health') return send(res, 200, { ok: true })
    if (path === '/_control/reset' && method === 'POST') {
      state.reset()
      return send(res, 200, { ok: true })
    }
    if (path === '/_control/otp' && method === 'GET') {
      const phone = normalizePhone(url.searchParams.get('phone') ?? '')
      const otp = phone ? state.otpsByPhone.get(phone)?.at(-1) : undefined
      return otp ? send(res, 200, otp) : send(res, 404, { error: `no OTP for ${phone}` })
    }
    if (path === '/_control/calls' && method === 'GET') {
      const p = url.searchParams.get('path')
      const since = Number(url.searchParams.get('sinceSeq') ?? 0)
      return send(res, 200, state.calls.filter((c) => (!p || c.path === p) && c.seq > since))
    }
    if (path.startsWith('/_control/subscribers/') && method === 'GET') {
      const phone = normalizePhone(decodeURIComponent(path.slice('/_control/subscribers/'.length)))
      const view = phone ? subscriberView(state, phone) : undefined
      return view ? send(res, 200, view) : send(res, 404, { error: `no subscriber ${phone}` })
    }
    if (path === '/_control/caas/balance' && method === 'GET') {
      const phone = normalizePhone(url.searchParams.get('phone') ?? '')
      if (!phone) return send(res, 400, { error: 'need phone' })
      const balance = state.caasBalances.get(phone)
      return balance ? send(res, 200, balance) : send(res, 404, { error: `no CaaS balance for ${phone}` })
    }
    if (path === '/_control/caas/debits' && method === 'GET') {
      const phone = url.searchParams.get('phone') ? normalizePhone(url.searchParams.get('phone')!) : undefined
      const debits = phone ? state.caasDebits.filter((d) => d.phone === phone) : state.caasDebits
      return send(res, 200, debits)
    }
    if (path === '/_control/failures' && method === 'POST') {
      const f = (await readJson(req)) as unknown as ScriptedFailure
      const invalid = validateFailure(f as unknown as Record<string, unknown>)
      if (invalid) return send(res, 400, { error: invalid })
      state.failures.push({ ...f, times: f.times ?? 1 })
      return send(res, 200, { ok: true, queued: state.failures.length })
    }
    if (path === '/_control/webhook' && method === 'POST') {
      const { path: appPath, body } = (await readJson(req)) as { path?: string; body?: unknown }
      if (!appPath) return send(res, 400, { error: 'need path' })
      return send(res, 200, await postToApp(appPath, body))
    }
    return send(res, 404, { error: `unknown control route ${method} ${path}` })
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://fake')
    const path = url.pathname.replace(/\/+$/, '') || '/'
    const handle = path.startsWith('/_control/') ? handleControl(path, url, req, res) : handleMerchant(path, req, res)
    handle.catch((e: unknown) => send(res, 500, { error: String(e) }))
  })

  return {
    server,
    state,
    listen: (port) => new Promise((resolve) => server.listen(port, () => resolve())),
    close: () => new Promise((resolve) => {
      for (const t of timers) clearTimeout(t)
      timers.clear()
      server.closeAllConnections()
      server.close(() => resolve())
    }),
  }
}
