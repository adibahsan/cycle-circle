import type { FullConfig } from '@playwright/test'
import { saveLoginState } from './support/auth'

/** Runs once per `pnpm e2e`: log in the seed user, tests reuse the saved state. */
export default async function globalSetup(config: FullConfig) {
  await saveLoginState(config.projects[0].use.baseURL!, 'seed')
}
