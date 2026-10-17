// Zero-dependency local mock of the BDApps endpoints Cycle Circle uses.
// See README.md. Mirrors behaviour verified against the live API.
import http from 'node:http'
import { randomUUID, randomInt } from 'node:crypto'
import { pathToFileURL } from 'node:url'

const OTP_TTL_MS = 5 * 60 * 1000

function pad(n) {
  return String(n).padStart(2, '0')
}
function stamp(d = new Date()) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}
function tel(v) {
  const s = String(v ?? '').trim()
  return s.startsWith('tel:') ? s : `tel:${s.replace(/^\+/, '')}`
}

export function createMock(opts = {}) {
  const cfg = {
    appId: opts.appId ?? process.env.BDAPPS_APP_ID ?? 'APP_SIMULATOR',
    password: opts.password ?? process.env.BDAPPS_PASSWORD ?? 'simulator_password',
    fixedOtp: opts.fixedOtp ?? process.env.MOCK_OTP ?? '123456',
    webhookUrl:
      opts.webhookUrl ??
      process.env.WEBHOOK_URL ??
      'http://localhost:3000/api/webhooks/subscription/notify',
    caas: (opts.caas ?? process.env.MOCK_CAAS) === 'enabled',
    quiet: opts.quiet ?? false,
  }
  const state = { subscribers: new Map(), otps: new Map(), messages: [] }
  const log = (...a) => {
    if (!cfg.quiet) console.log('[bdapps-mock]', ...a)
  }

  const err = (statusCode, statusDetail) => ({ statusCode, statusDetail, version: '1.0' })
  const ok = (extra = {}) => ({
    statusCode: 'S1000',
    statusDetail: 'Request was successfully processed.',
    version: '1.0',
    ...extra,
  })
  const E1951 = () => err('E1951', 'Format of the address is invalid Or User Already UnRegistered')
  const isReg = (id) => state.subscribers.get(id)?.status === 'REGISTERED'

  function setStatus(id, status) {
    state.subscribers.set(id, { status, updatedAt: new Date().toISOString() })
  }

  async function notify(id, status) {
    const payload = {
      applicationId: cfg.appId,
      password: cfg.password,
      subscriberId: id,
      status,
      frequency: 'daily',
      timeStamp: stamp(),
      version: '1.0',
    }
    try {
      const r = await fetch(cfg.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      log(`webhook ${status} ${id} -> ${cfg.webhookUrl} (${r.status})`)
      return { delivered: true, httpStatus: r.status }
    } catch (e) {
      log(`webhook failed: ${e.message}`)
      return { delivered: false, error: String(e.message) }
    }
  }

  function smsSend(b) {
    const dests = Array.isArray(b.destinationAddresses) ? b.destinationAddresses.map(tel) : []
    const targets = dests.includes('tel:all') ? ['tel:all'] : dests
    const responses = targets.map((address) => {
      const delivered =
        address === 'tel:all'
          ? [...state.subscribers].filter(([, s]) => s.status === 'REGISTERED').map(([k]) => k)
          : isReg(address)
            ? [address]
            : []
      const good = address === 'tel:all' || delivered.length > 0
      const messageId = randomUUID()
      state.messages.push({
        type: 'sms',
        to: address,
        deliveredTo: delivered,
        message: b.message,
        messageId,
        ok: good,
        at: new Date().toISOString(),
      })
      return {
        address,
        messageId,
        statusCode: good ? 'S1000' : 'E1951',
        statusDetail: good
          ? 'Success'
          : 'Format of the address is invalid Or User Already UnRegistered',
        timeStamp: stamp(),
      }
    })
    return ok({ requestId: randomUUID(), destinationResponses: responses })
  }

  const api = {
    '/subscription/otp/request': (b) => {
      if (!b.subscriberId) return err('E1312', 'Request is missing required parameter subscriberId')
      const subscriberId = tel(b.subscriberId)
      const referenceNo = String(randomInt(1e12, 1e13))
      const otp = String(randomInt(0, 1e6)).padStart(6, '0')
      state.otps.set(referenceNo, {
        subscriberId,
        otp,
        expiresAt: Date.now() + OTP_TTL_MS,
        createdAt: new Date().toISOString(),
      })
      log(`OTP for ${subscriberId} = ${cfg.fixedOtp} (ref ${referenceNo})`)
      return ok({ referenceNo })
    },
    '/subscription/otp/verify': (b) => {
      const c = state.otps.get(String(b.referenceNo))
      if (!c || c.expiresAt < Date.now()) return err('E1854', 'Could not find OTP')
      const code = String(b.otp)
      if (code !== cfg.fixedOtp && code !== c.otp) return err('E1850', 'Invalid OTP')
      state.otps.delete(String(b.referenceNo))
      setStatus(c.subscriberId, 'REGISTERED')
      return ok({ subscriptionStatus: 'REGISTERED', subscriberId: c.subscriberId })
    },
    '/subscription/getStatus': (b) => {
      const id = tel(b.subscriberId)
      return isReg(id) ? ok({ subscriptionStatus: 'REGISTERED' }) : E1951()
    },
    '/subscription/send': (b) => {
      const id = tel(b.subscriberId)
      if (String(b.action) === '1') {
        setStatus(id, 'REGISTERED')
        return ok({ subscriptionStatus: 'REGISTERED' })
      }
      if (!isReg(id)) return E1951()
      setStatus(id, 'UNREGISTERED')
      return ok({ subscriptionStatus: 'UNREGISTERED' })
    },
    '/subscription/query-base': () => {
      const n = [...state.subscribers.values()].filter((s) => s.status === 'REGISTERED').length
      return ok({ baseSize: String(n) })
    },
    '/sms/send': smsSend,
    '/ussd/send': (b) => {
      const id = tel(b.destinationAddress ?? b.subscriberId ?? b.sourceAddress)
      const good = isReg(id)
      state.messages.push({ type: 'ussd', to: id, message: b.message, ok: good, at: new Date().toISOString() })
      return good ? ok({ requestId: randomUUID() }) : E1951()
    },
    '/caas/get/balance': () =>
      ok({ accountType: 'PREPAID', accountStatus: 'ACTIVE', chargeableBalance: '1000' }),
    '/caas/direct/debit': (b) =>
      ok({
        internalTrxId: randomUUID(),
        externalTrxId: b.externalTrxId ?? randomUUID(),
        timeStamp: stamp(),
      }),
  }

  const json = (res, code, body) => {
    res.writeHead(code, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  }
  const readBody = (req) =>
    new Promise((resolve) => {
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
  const notFound = (res) => {
    res.writeHead(404, { 'content-type': 'text/html' })
    res.end('<html><body><h1>404 Not Found</h1></body></html>')
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x')
    const path = url.pathname.replace(/\/+$/, '') || '/'

    if (path === '/' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/html' })
      return res.end(DASHBOARD)
    }
    if (path.startsWith('/_mock/')) {
      if (path === '/_mock/state' && req.method === 'GET') {
        return json(res, 200, {
          subscribers: Object.fromEntries(state.subscribers),
          otps: [...state.otps].map(([referenceNo, o]) => ({ referenceNo, ...o, code: cfg.fixedOtp })),
          messages: state.messages,
          caas: cfg.caas,
        })
      }
      if (path === '/_mock/reset' && req.method === 'POST') {
        state.subscribers.clear()
        state.otps.clear()
        state.messages.length = 0
        return json(res, 200, { reset: true })
      }
      const m = path.match(/^\/_mock\/subscribers\/([^/]+)\/(subscribe|unsubscribe)$/)
      if (m && req.method === 'POST') {
        const id = tel(decodeURIComponent(m[1]))
        const status = m[2] === 'subscribe' ? 'REGISTERED' : 'UNREGISTERED'
        setStatus(id, status)
        const webhook = await notify(id, status)
        return json(res, 200, { subscriberId: id, status, webhook })
      }
      return notFound(res)
    }

    const handler = api[path]
    const caasPath = path.startsWith('/caas/')
    if (req.method !== 'POST' || !handler || (caasPath && !cfg.caas)) return notFound(res)
    const body = await readBody(req)
    if (body.applicationId !== cfg.appId || body.password !== cfg.password) {
      return json(res, 200, err('E1313', 'Authentication failure. Invalid applicationId or password.'))
    }
    return json(res, 200, handler(body))
  })

  return { server, state, cfg }
}

const DASHBOARD = `<!doctype html><meta charset="utf-8"><title>BDApps mock</title>
<style>body{font:14px system-ui;margin:2rem;max-width:60rem}table{border-collapse:collapse;width:100%;margin-bottom:1.5rem}
td,th{border:1px solid #ccc;padding:.3rem .5rem;text-align:left}h2{margin:.5rem 0}button{margin-right:.3rem}</style>
<h1>BDApps mock</h1><p><button id=reset>Reset state</button></p>
<h2>Subscribers</h2><table id=subs></table><h2>OTPs</h2><table id=otps></table><h2>Messages</h2><table id=msgs></table>
<script>
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const act=async(id,a)=>{await fetch('/_mock/subscribers/'+encodeURIComponent(id)+'/'+a,{method:'POST'});load()};
document.getElementById('reset').onclick=async()=>{await fetch('/_mock/reset',{method:'POST'});load()};
async function load(){const s=await (await fetch('/_mock/state')).json();
subs.innerHTML='<tr><th>Number<th>Status<th>Actions</tr>'+Object.entries(s.subscribers).map(([id,v])=>'<tr><td>'+esc(id)+'<td>'+esc(v.status)+'<td><button data-i="'+esc(id)+'" data-a="unsubscribe">Unsubscribe</button><button data-i="'+esc(id)+'" data-a="subscribe">Subscribe</button></tr>').join('');
subs.onclick=e=>{const b=e.target.closest('button');if(b)act(b.dataset.i,b.dataset.a)};
otps.innerHTML='<tr><th>Number<th>Code<th>Ref</tr>'+s.otps.slice(-10).reverse().map(o=>'<tr><td>'+esc(o.subscriberId)+'<td>'+esc(o.code)+'<td>'+esc(o.referenceNo)+'</tr>').join('');
msgs.innerHTML='<tr><th>Time<th>Type<th>To<th>Message<th>OK</tr>'+s.messages.slice(-20).reverse().map(m=>'<tr><td>'+esc(m.at)+'<td>'+esc(m.type)+'<td>'+esc(m.to)+'<td>'+esc(m.message)+'<td>'+esc(m.ok)+'</tr>').join('')}
load();setInterval(load,3000);
</script>`

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const port = Number(process.env.PORT ?? 7003)
  const { server, cfg } = createMock()
  server.listen(port, () => {
    console.log(
      `[bdapps-mock] listening on http://localhost:${port} (app ${cfg.appId}, otp ${cfg.fixedOtp}, caas ${cfg.caas ? 'enabled' : 'disabled'})`,
    )
    console.log(`[bdapps-mock] webhook -> ${cfg.webhookUrl}`)
  })
}
