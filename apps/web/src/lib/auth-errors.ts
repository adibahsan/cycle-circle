export type AuthErrorBody = {
  error?: string | { message?: string; code?: string; hasEmail?: boolean };
};

const CODE_TO_KEY: Record<string, string> = {
  OPERATOR_NOT_SUPPORTED: 'auth.operatorNotSupported',
  INVALID_PHONE: 'auth.phoneInvalid',
  INVALID_OTP: 'trial.err.invalidCode',
  CHALLENGE_EXPIRED: 'trial.err.invalidCode',
  CHALLENGE_NOT_FOUND: 'trial.err.invalidCode',
  ALREADY_VERIFIED: 'trial.err.invalidCode',
  RATE_LIMITED: 'trial.err.rateLimited',
  OTP_COOLDOWN: 'trial.err.cooldown',
  OTP_LOCKED: 'trial.err.codeLocked',
};

/**
 * Maps an auth/OTP error response to translated copy. Never returns the server's
 * `message`: gateway text is not user-facing, so unknown codes get the fallback.
 */
export function authErrorMessage(
  body: AuthErrorBody,
  fallbackKey: string,
  t: (key: string) => string,
): string {
  const err = body.error;
  if (typeof err !== 'object' || err === null) return t(fallbackKey);
  if (err.code === 'ALREADY_SUBSCRIBED') {
    return t(err.hasEmail ? 'auth.alreadySubscribedEmail' : 'auth.alreadySubscribedNoEmail');
  }
  const key = err.code ? CODE_TO_KEY[err.code] : undefined;
  return t(key ?? fallbackKey);
}
