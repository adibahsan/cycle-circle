/** Maps /api/user/email/{request,verify} error codes to i18n keys. Server messages are never rendered. */
const EMAIL_ERROR_KEYS: Record<string, string> = {
  INVALID_EMAIL: 'settings.invalidEmail',
  EMAIL_TAKEN: 'settings.emailTaken',
  OTP_COOLDOWN: 'trial.err.cooldown',
  RATE_LIMITED: 'trial.err.rateLimited',
  INVALID_OTP: 'trial.err.invalidCode',
  CHALLENGE_EXPIRED: 'trial.err.invalidCode',
  CHALLENGE_NOT_FOUND: 'trial.err.invalidCode',
  OTP_LOCKED: 'trial.err.codeLocked',
}

export function emailErrorKey(code: string | undefined | null): string {
  return (code && Object.hasOwn(EMAIL_ERROR_KEYS, code) && EMAIL_ERROR_KEYS[code]) || 'trial.err.generic'
}
