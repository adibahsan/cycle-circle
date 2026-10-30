/** Start the fake BDApps from env (the Playwright config does this per slot). */
import { createFakeBdapps } from './server.ts'

const port = Number(process.env.FAKE_BDAPPS_PORT ?? 4300)
const fake = createFakeBdapps({
  appId: process.env.FAKE_BDAPPS_APP_ID ?? 'APP_E2E',
  password: process.env.FAKE_BDAPPS_PASSWORD ?? 'e2e-bdapps-password',
  appUrl: process.env.FAKE_BDAPPS_APP_URL ?? 'http://localhost:4100',
})
await fake.listen(port)
console.log(`[fake-bdapps] listening on http://localhost:${port}`)
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => void fake.close().then(() => process.exit(0)))
