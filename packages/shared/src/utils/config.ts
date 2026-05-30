/**
 * When true, OTP flow uses hardcoded dev codes instead of BDApps SMS.
 * Must match server DEV_MODE=true.
 */
export const devMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true'

/** Seed user phone for dev login placeholder. */
export const DEV_DEFAULT_PHONE = '01712345678'

/** OTP codes accepted in dev mode (never used in production). */
export const DEV_OTP_CODES: readonly string[] = ['420420', '840840']
