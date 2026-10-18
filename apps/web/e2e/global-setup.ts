import type { FullConfig } from '@playwright/test'
import { saveLoginState } from './support/auth'
import { ensureFreshPersona, ensureModePersonas } from './support/ensure-persona'

/** Runs once per `pnpm e2e`: log in the personas; tests reuse the saved state. */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!
  await saveLoginState(baseURL, 'seed')
  await saveLoginState(baseURL, 'fresh') // creates the user on first dev-login
  await ensureFreshPersona()
  for (const p of ['pregnant', 'menopause', 'firstRun'] as const) await saveLoginState(baseURL, p)
  await ensureModePersonas()
}
