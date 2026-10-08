'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getTrialStatus, getTrialMsLeft } from '@vesta/shared/utils/trial';
import { useHasMounted } from '@/components/motion/useHasMounted';

// ─── Constants ────────────────────────────────────────────────────────────────

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

// ─── Types ────────────────────────────────────────────────────────────────────

type TrialUser = {
  authMethod?: string | null;
  subscriptionStatus?: string | null;
  emailTrialExpiresAt?: string | null;
};

type Step = 'phone' | 'code' | 'success';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHMS(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

const ERROR_CODE_MAP: Record<string, string> = {
  PHONE_TAKEN: 'trial.err.phoneTaken',
  OTP_COOLDOWN: 'trial.err.cooldown',
  RATE_LIMITED: 'trial.err.rateLimited',
  INVALID_OTP: 'trial.err.invalidCode',
  CHALLENGE_EXPIRED: 'trial.err.invalidCode',
  CHALLENGE_NOT_FOUND: 'trial.err.invalidCode',
  ALREADY_VERIFIED: 'trial.err.invalidCode',
  INVALID_PHONE: 'trial.err.invalidPhone',
};

function mapErrorCode(code: string | undefined): string {
  if (code && ERROR_CODE_MAP[code]) return ERROR_CODE_MAP[code];
  return 'trial.err.generic';
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TrialCountdownPillProps {
  trialUser: TrialUser | null;
  onPhoneAdded: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TrialCountdownPill({ trialUser, onPhoneAdded }: TrialCountdownPillProps) {
  const { t } = useTranslation();
  const hasMounted = useHasMounted();
  const prefersReduced = useReducedMotion();
  const prm = hasMounted && prefersReduced;

  // ── Live countdown ──────────────────────────────────────────────────────────
  const [msLeft, setMsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!trialUser) return;
    const initial = getTrialMsLeft(trialUser);
    setMsLeft(initial);
    if (initial === null || initial <= 0) return;

    const id = setInterval(() => {
      const remaining = getTrialMsLeft(trialUser);
      setMsLeft(remaining);
      if (remaining === null || remaining <= 0) clearInterval(id);
    }, 1000);

    return () => clearInterval(id);
  }, [trialUser]);

  // ── Dialog state ───────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('phone');

  // phone step
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [sending, setSending] = useState(false);
  const [referenceNo, setReferenceNo] = useState('');

  // code step
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [codeError, setCodeError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Resend countdown ticks while on the code step
  useEffect(() => {
    if (step !== 'code' || countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [step, countdown]);

  // Focus first OTP box when the code step mounts
  useEffect(() => {
    if (step === 'code') {
      requestAnimationFrame(() => {
        inputRefs.current[0]?.focus();
      });
    }
  }, [step]);

  // ── Dialog open / close ────────────────────────────────────────────────────
  const handleOpen = () => {
    setStep('phone');
    setPhone('');
    setPhoneError('');
    setDigits(Array(OTP_LENGTH).fill(''));
    setCodeError('');
    setCountdown(RESEND_SECONDS);
    setReferenceNo('');
    setOpen(true);
  };

  const handleClose = () => setOpen(false);

  // ── Step: phone ────────────────────────────────────────────────────────────
  const handleSendCode = async () => {
    const stripped = phone.replace(/\D/g, '');
    if (stripped.length !== 11 || !stripped.startsWith('01')) {
      setPhoneError(t('trial.err.invalidPhone'));
      return;
    }
    setSending(true);
    setPhoneError('');
    try {
      const res = await fetch('/api/user/phone/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: stripped }),
      });
      const body = await res.json().catch(() => ({})) as {
        referenceNo?: string;
        error?: { message?: string; code?: string } | string;
      };
      if (!res.ok) {
        const err = typeof body.error === 'object' ? body.error : undefined;
        setPhoneError(t(mapErrorCode(err?.code)));
        return;
      }
      setReferenceNo(body.referenceNo ?? '');
      setDigits(Array(OTP_LENGTH).fill(''));
      setCodeError('');
      setCountdown(RESEND_SECONDS);
      setStep('code');
    } catch {
      setPhoneError(t('trial.err.generic'));
    } finally {
      setSending(false);
    }
  };

  // ── Step: code — digit management ─────────────────────────────────────────
  const updateDigit = useCallback(
    (index: number, value: string) => {
      setCodeError('');
      const cleaned = value.replace(/\D/g, '');
      if (!cleaned) return;

      const newDigits = [...digits];
      if (cleaned.length > 1) {
        // paste of multiple digits
        const chars = cleaned.slice(0, OTP_LENGTH - index).split('');
        chars.forEach((ch, i) => {
          if (index + i < OTP_LENGTH) newDigits[index + i] = ch;
        });
        setDigits(newDigits);
        const nextFocus = Math.min(index + chars.length, OTP_LENGTH - 1);
        inputRefs.current[nextFocus]?.focus();
        return;
      }

      newDigits[index] = cleaned[0];
      setDigits(newDigits);
      if (index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    },
    [digits],
  );

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newDigits = [...digits];
      if (newDigits[index]) {
        newDigits[index] = '';
        setDigits(newDigits);
      } else if (index > 0) {
        newDigits[index - 1] = '';
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  // ── Step: code — verify ───────────────────────────────────────────────────
  const handleVerify = async () => {
    const code = digits.join('');
    if (code.length < OTP_LENGTH) {
      setCodeError(t('auth.otpAllDigits', { count: OTP_LENGTH }));
      return;
    }
    setVerifying(true);
    setCodeError('');
    try {
      const res = await fetch('/api/user/phone/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceNo, otp: code }),
      });
      const body = await res.json().catch(() => ({})) as {
        error?: { message?: string; code?: string } | string;
      };
      if (!res.ok) {
        const err = typeof body.error === 'object' ? body.error : undefined;
        setCodeError(t(mapErrorCode(err?.code)));
        return;
      }
      setStep('success');
      // brief success flash before closing
      await new Promise<void>((resolve) => setTimeout(resolve, 1800));
      onPhoneAdded();
      setOpen(false);
    } catch {
      setCodeError(t('trial.err.generic'));
    } finally {
      setVerifying(false);
    }
  };

  // ── Step: code — resend ───────────────────────────────────────────────────
  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    setDigits(Array(OTP_LENGTH).fill(''));
    setCodeError('');
    try {
      const stripped = phone.replace(/\D/g, '');
      const res = await fetch('/api/user/phone/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: stripped }),
      });
      if (res.ok) {
        const body = await res.json().catch(() => ({})) as { referenceNo?: string };
        if (body.referenceNo) setReferenceNo(body.referenceNo);
      }
    } catch {
      /* still reset UI even if resend fails */
    }
    setResending(false);
    setCountdown(RESEND_SECONDS);
    requestAnimationFrame(() => inputRefs.current[0]?.focus());
  };

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!trialUser || getTrialStatus(trialUser) !== 'active') return null;
  // Suppress until first tick (avoids SSR mismatch)
  if (msLeft === null) return null;

  const timeLabel = formatHMS(msLeft);
  const ariaLabel = `${t('trial.countdownLabel')} ${timeLabel} — ${t('trial.addNumberCta')}`;
  const allFilled = digits.filter(Boolean).length === OTP_LENGTH;

  return (
    <>
      {/* ── Pill button ── */}
      <button
        type="button"
        onClick={handleOpen}
        aria-label={ariaLabel}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[color-mix(in_srgb,var(--color-accent)_16%,var(--color-bg-card))] text-[var(--color-text-primary)] border border-[color-mix(in_srgb,var(--color-accent)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_26%,var(--color-bg-card))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
      >
        {/* Hourglass icon — inline SVG so no extra import needed */}
        <svg
          viewBox="0 0 24 24"
          width="13"
          height="13"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 00-.586-1.414L12 12l-4.414 4.414A2 2 0 007 17.828V22M7 2v4.172a2 2 0 00.586 1.414L12 12l4.414-4.414A2 2 0 0017 6.172V2" />
        </svg>
        <span className="[font-variant-numeric:tabular-nums]">{timeLabel}</span>
        <span className="hidden sm:inline">{t('trial.addNumberCta')}</span>
      </button>

      {/* ── Dialog ── */}
      <Modal
        open={open}
        onClose={handleClose}
        titleId="trial-dialog-title"
        descId="trial-dialog-desc"
      >
        <div className="px-6 pb-6 pt-2 space-y-5">
          {/* Header */}
          <div className="space-y-1 pt-3">
            <h2
              id="trial-dialog-title"
              className="text-lg font-bold text-[var(--color-text-primary)]"
            >
              {step === 'code'
                ? t('trial.enterCodeTitle')
                : step === 'success'
                  ? t('trial.success')
                  : t('trial.dialogTitle')}
            </h2>
            {step === 'phone' && (
              <p
                id="trial-dialog-desc"
                className="text-sm text-[var(--color-text-muted)] leading-relaxed"
              >
                {t('trial.dialogBody')}
              </p>
            )}
            {step === 'code' && (
              <p
                id="trial-dialog-desc"
                className="text-sm text-[var(--color-text-muted)] leading-relaxed"
              >
                {t('trial.enterCodeBody', { phone })}
              </p>
            )}
          </div>

          {/* ── Step: phone ── */}
          {step === 'phone' && (
            <div className="space-y-4">
              <Input
                id="trial-phone"
                label={t('trial.phoneLabel')}
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                name="phone"
                placeholder={t('trial.phonePlaceholder')}
                spellCheck={false}
                value={phone}
                onChange={(e) => {
                  setPhoneError('');
                  setPhone(e.target.value.replace(/\D/g, '').slice(0, 11));
                }}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') void handleSendCode();
                }}
                error={phoneError}
              />

              {process.env.NEXT_PUBLIC_DEV_MODE === 'true' && (
                <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] rounded-lg px-3 py-2">
                  {t('trial.devHint')}
                </p>
              )}

              <Button fullWidth onClick={() => void handleSendCode()} disabled={sending}>
                {sending ? t('trial.sending') : t('trial.sendCode')}
              </Button>
            </div>
          )}

          {/* ── Step: code ── */}
          {step === 'code' && (
            <div className="space-y-4">
              {/* 6-box OTP entry — mirrors verify-otp/page.tsx */}
              <div
                role="group"
                aria-label={t('trial.enterCodeTitle')}
                className="flex gap-2 justify-between"
              >
                {digits.map((digit, index) => (
                  <motion.div
                    key={index}
                    animate={
                      codeError
                        ? {
                            x: [0, -4, 4, -4, 4, 0],
                            transition: { duration: 0.3 },
                          }
                        : { scale: focusedIndex === index ? 1.05 : 1 }
                    }
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className="flex-1"
                  >
                    <input
                      ref={(el) => {
                        inputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      name="otp"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={digit}
                      onChange={(e) => updateDigit(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      onFocus={(e) => {
                        e.target.select();
                        setFocusedIndex(index);
                      }}
                      onBlur={() => setFocusedIndex(null)}
                      aria-label={`Digit ${index + 1}`}
                      className={[
                        'w-full aspect-square text-center text-lg font-bold rounded-xl border-2',
                        'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30',
                        'transition-colors duration-200',
                        digit
                          ? 'border-[var(--color-primary)] bg-[var(--color-bg-card)]'
                          : 'border-[var(--color-border)]',
                        codeError ? 'border-[var(--color-error)]' : '',
                        'focus:border-[var(--color-primary)]',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    />
                  </motion.div>
                ))}
              </div>

              {/* Code error */}
              <AnimatePresence>
                {codeError && (
                  <motion.p
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-sm text-[var(--color-error)] flex items-center gap-1"
                  >
                    <span aria-hidden="true">⚠</span> {codeError}
                  </motion.p>
                )}
              </AnimatePresence>

              <Button
                fullWidth
                onClick={() => void handleVerify()}
                disabled={verifying || !allFilled}
              >
                {verifying ? t('trial.verifying') : t('trial.verify')}
              </Button>

              {/* Resend + change number */}
              <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void handleResend()}
                  disabled={countdown > 0 || resending}
                  className={[
                    'text-sm font-semibold transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded',
                    countdown > 0
                      ? 'text-[var(--color-text-muted)] cursor-default'
                      : 'text-[var(--color-primary)] hover:underline underline-offset-2',
                  ].join(' ')}
                >
                  {resending
                    ? t('common.loading')
                    : countdown > 0
                      ? t('trial.resendIn', { seconds: countdown })
                      : t('trial.resend')}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStep('phone');
                    setCodeError('');
                    setDigits(Array(OTP_LENGTH).fill(''));
                  }}
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded"
                >
                  {t('trial.changeNumber')}
                </button>
              </div>
            </div>
          )}

          {/* ── Step: success ── */}
          {step === 'success' && (
            <div
              aria-live="polite"
              className="flex flex-col items-center gap-4 py-6"
            >
              <motion.div
                initial={prm ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={
                  prm
                    ? { duration: 0.15 }
                    : { type: 'spring', stiffness: 260, damping: 18 }
                }
                className="w-16 h-16 rounded-full bg-[var(--color-action)] flex items-center justify-center shadow-glow"
              >
                <CheckCircle2 size={32} className="text-[var(--color-on-action)]" aria-hidden="true" />
              </motion.div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)] text-center">
                {t('trial.success')}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
