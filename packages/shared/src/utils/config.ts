/** When true, UI uses fixtures and skips all API calls. Default: false. */
export const useDummyData = process.env.NEXT_PUBLIC_USE_DUMMY_DATA === 'true'

/**
 * When true, login skips OTP and uses POST /api/auth/dev-login (real DB).
 * Must match server DEV_MODE=true. Ignored if useDummyData is true.
 */
export const devMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true'

/** Seed user phone for dev login placeholder. */
export const DEV_DEFAULT_PHONE = '01712345678'

export type DataMode = 'dummy' | 'real'

export function currentDataMode(): DataMode {
  return useDummyData ? 'dummy' : 'real'
}
