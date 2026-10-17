import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createMock } from './server.mjs'

const listen = (s) => new Promise((r) => s.listen(0, '127.0.0.1', () => r(s.address().port)))
let mock, base, hookServer, hookUrl
const hooks = []

before(async () => {
  hookServer = http.createServer((req, res) => {
    let b = ''
    req.on('data', (c) => (b += c))
    req.on('end', () => {
      hooks.push(JSON.parse(b))
      res.end('{}')
    })
  })
  hookUrl = `http://127.0.0.1:${await listen(hookServer)}/hook`
  mock = createMock({ appId: 'APP_T', password: 'pw', fixedOtp: '123456', webhookUrl: hookUrl, quiet: true })
  base = `http://127.0.0.1:${await listen(mock.server)}`
})
after(() => {
  mock.server.close()
  hookServer.close()
})

const post = async (path, body = {}) => {
  const r = await fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ applicationId: 'APP_T', password: 'pw', ...body }),
  })
  return { status: r.status, body: await r.json().catch(() => null) }
}
const N = 'tel:8801711111111'

test('auth failure returns E1313', async () => {
  const r = await post('/subscription/getStatus', { subscriberId: N, password: 'bad' })
  assert.equal(r.status, 200)
  assert.equal(r.body.statusCode, 'E1313')
})

test('unknown number is E1951', async () => {
  const r = await post('/subscription/getStatus', { subscriberId: N })
  assert.equal(r.body.statusCode, 'E1951')
})

test('otp request -> verify -> REGISTERED', async () => {
  const req = await post('/subscription/otp/request', { subscriberId: N })
  assert.equal(req.body.statusCode, 'S1000')
  assert.ok(req.body.referenceNo)
  const bad = await post('/subscription/otp/verify', { referenceNo: req.body.referenceNo, otp: 'nope' })
  assert.equal(bad.body.statusCode, 'E1850')
  const v = await post('/subscription/otp/verify', { referenceNo: req.body.referenceNo, otp: '123456' })
  assert.equal(v.body.statusCode, 'S1000')
  assert.equal(v.body.subscriptionStatus, 'REGISTERED')
  assert.equal(v.body.subscriberId, N)
  const s = await post('/subscription/getStatus', { subscriberId: N })
  assert.equal(s.body.subscriptionStatus, 'REGISTERED')
  const q = await post('/subscription/query-base')
  assert.equal(q.body.baseSize, '1')
})

test('unknown reference is E1854', async () => {
  const r = await post('/subscription/otp/verify', { referenceNo: '999', otp: '123456' })
  assert.equal(r.body.statusCode, 'E1854')
})

test('sms: registered, unregistered, tel:all', async () => {
  const a = await post('/sms/send', { message: 'hi', destinationAddresses: [N] })
  assert.equal(a.body.statusCode, 'S1000')
  assert.equal(a.body.destinationResponses[0].statusCode, 'S1000')
  const b = await post('/sms/send', { message: 'hi', destinationAddresses: ['tel:8801799999999'] })
  assert.equal(b.body.statusCode, 'S1000')
  assert.equal(b.body.destinationResponses[0].statusCode, 'E1951')
  const c = await post('/sms/send', { message: 'hi', destinationAddresses: ['tel:all'] })
  assert.equal(c.body.destinationResponses.length, 1)
  assert.equal(c.body.destinationResponses[0].statusCode, 'S1000')
})

test('caas is 404 by default, other paths 404', async () => {
  assert.equal((await post('/caas/get/balance')).status, 404)
  assert.equal((await post('/caas/direct/debit')).status, 404)
  assert.equal((await post('/nope')).status, 404)
})

test('control unsubscribe posts webhook, then getStatus/send action 0 -> E1951', async () => {
  const r = await fetch(`${base}/_mock/subscribers/8801711111111/unsubscribe`, { method: 'POST' })
  const j = await r.json()
  assert.equal(j.status, 'UNREGISTERED')
  assert.equal(hooks.length, 1)
  assert.equal(hooks[0].subscriberId, N)
  assert.equal(hooks[0].status, 'UNREGISTERED')
  assert.equal(hooks[0].frequency, 'daily')
  assert.equal(hooks[0].applicationId, 'APP_T')
  assert.equal(hooks[0].version, '1.0')
  assert.match(hooks[0].timeStamp, /^\d{14}$/)
  assert.equal((await post('/subscription/getStatus', { subscriberId: N })).body.statusCode, 'E1951')
  assert.equal((await post('/subscription/send', { subscriberId: N, action: '0' })).body.statusCode, 'E1951')
})

test('subscribe via send then unsubscribe -> UNREGISTERED', async () => {
  const s = await post('/subscription/send', { subscriberId: N, action: '1' })
  assert.equal(s.body.subscriptionStatus, 'REGISTERED')
  const u = await post('/subscription/send', { subscriberId: N, action: '0' })
  assert.equal(u.body.subscriptionStatus, 'UNREGISTERED')
})

test('dashboard and state', async () => {
  const h = await fetch(base + '/')
  assert.match(await h.text(), /BDApps mock/)
  const st = await (await fetch(base + '/_mock/state')).json()
  assert.ok(st.subscribers[N])
})
