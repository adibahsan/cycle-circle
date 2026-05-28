import { env } from '../utils/env'

/** Dev-only auth bypass. Never enabled in production even if DEV_MODE=true. */
export function isDevModeEnabled(): boolean {
  return env.DEV_MODE && env.NODE_ENV !== 'production'
}
