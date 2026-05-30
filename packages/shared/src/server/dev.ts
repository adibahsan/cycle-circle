import { env } from '../utils/env'

/** Dev OTP codes enabled when DEV_MODE=true, regardless of environment. */
export function isDevModeEnabled(): boolean {
  return env.DEV_MODE
}
