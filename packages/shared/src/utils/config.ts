/**
 * When true, login skips OTP and uses POST /api/auth/dev-login (real DB).
 * Must match server DEV_MODE=true.
 */
export const devMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true'

/** Seed user phone for dev login placeholder. */
export const DEV_DEFAULT_PHONE = '01712345678'
