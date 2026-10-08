import { request } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { PERSONAS, type PersonaName } from './personas'

export const AUTH_DIR = path.resolve(__dirname, '../.auth')
export const statePath = (p: PersonaName) => path.join(AUTH_DIR, `${p}.json`)

/**
 * One POST to /api/auth/dev-login (DEV_MODE only): no OTP, so no OTP rate limit.
 * Writes a Playwright storageState file and returns its path.
 */
export async function saveLoginState(baseURL: string, persona: PersonaName): Promise<string> {
  const ctx = await request.newContext({ baseURL })
  const res = await ctx.post('/api/auth/dev-login', { data: { phone: PERSONAS[persona].phone } })
  if (!res.ok()) {
    throw new Error(`dev-login failed (${res.status()}): ${await res.text()}. Is DEV_MODE=true in apps/web/.env.local?`)
  }
  fs.mkdirSync(AUTH_DIR, { recursive: true })
  const file = statePath(persona)
  await ctx.storageState({ path: file })
  await ctx.dispose()
  return file
}
