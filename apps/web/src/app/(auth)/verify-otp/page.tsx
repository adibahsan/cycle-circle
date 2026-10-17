'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, RefreshCw, CheckCircle2, CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import '@vesta/shared/utils/i18n';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const FADE_UP = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.4, ease: EASE },
  }),
};

export default function VerifyOtpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [endsAt, setEndsAt] = useState<number>(() => Date.now() + RESEND_SECONDS * 1000);
  const [resending, setResending] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // phone and referenceNo come from the query (set by the login page) with sessionStorage as fallback.
  // referenceNo lives in state so a resend (which issues a new challenge) replaces the stale one.
  const phoneFromQuery = searchParams.get('phone');
  const referenceNoFromQuery = searchParams.get('referenceNo') ?? '';
  const [referenceNo, setReferenceNo] = useState(referenceNoFromQuery);
  const [phone, setPhone] = useState(phoneFromQuery ?? '');

  useEffect(() => {
    let ref = referenceNoFromQuery;
    let ph = phoneFromQuery ?? '';
    try {
      if (!ref) ref = sessionStorage.getItem('vesta-otp-ref') ?? '';
      if (!ph) ph = sessionStorage.getItem('vesta-otp-phone') ?? '';
    } catch { /* storage unavailable */ }
    if (!ref) {
      router.replace('/login');
      return;
    }
    setReferenceNo(ref);
    setPhone(ph);
  }, [referenceNoFromQuery, phoneFromQuery, router]);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown derived from a deadline so background-tab timer throttling cannot make it drift.
  useEffect(() => {
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [endsAt]);
  const countdown = secondsLeft;

  function errorMessage(body: { error?: string | { message?: string; code?: string } }, fallbackKey: string) {
    const err = body.error;
    const code = typeof err === 'object' ? err?.code : undefined;
    const known: Record<string, string> = {
      INVALID_OTP: 'trial.err.invalidCode',
      CHALLENGE_EXPIRED: 'trial.err.invalidCode',
      CHALLENGE_NOT_FOUND: 'trial.err.invalidCode',
      ALREADY_VERIFIED: 'trial.err.invalidCode',
      RATE_LIMITED: 'trial.err.rateLimited',
      OTP_COOLDOWN: 'trial.err.cooldown',
    };
    if (code && known[code]) return t(known[code]);
    return t(fallbackKey);
  }

  // Focus first box on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const updateDigit = useCallback((index: number, value: string) => {
    setError('');
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) return;

    const newDigits = [...digits];

    // Handle paste of multiple digits
    if (cleaned.length > 1) {
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
    if (index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [digits]);

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

  // Auto-submit once per completed code (typed, pasted or SMS-autofilled). Editing a
  // digit after a failed attempt produces a new code, which submits again.
  const formRef = useRef<HTMLFormElement>(null);
  const lastAutoCode = useRef('');
  useEffect(() => {
    const code = digits.join('');
    if (code.length === OTP_LENGTH && code !== lastAutoCode.current) {
      lastAutoCode.current = code;
      formRef.current?.requestSubmit();
    }
  }, [digits]);

  async function handleVerify(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading || success) return;
    const code = digits.join('');
    if (code.length < OTP_LENGTH) {
      setError(t('auth.otpAllDigits', { count: OTP_LENGTH }));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceNo, otp: code }),
      });
      const body = await res.json().catch(() => ({})) as { error?: string | { message?: string; code?: string }; user?: { profileCompleted?: boolean } };
      if (!res.ok) {
        setError(errorMessage(body, 'auth.verificationFailed'));
        return;
      }
      setSuccess(true);
      await new Promise((res) => setTimeout(res, 700));
      router.replace(body.user?.profileCompleted ? '/dashboard' : '/onboarding');
    } catch {
      setError(t('auth.verificationFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0 || resending) return;
    setResending(true);
    setError('');
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const body = await res.json().catch(() => ({})) as { referenceNo?: string; error?: string | { message?: string; code?: string } };
      if (!res.ok || !body.referenceNo) {
        setError(errorMessage(body, 'auth.resendFailed'));
        return;
      }
      setReferenceNo(body.referenceNo);
      try { sessionStorage.setItem('vesta-otp-ref', body.referenceNo); } catch { /* ignore */ }
      setDigits(Array(OTP_LENGTH).fill(''));
      setEndsAt(Date.now() + RESEND_SECONDS * 1000);
      inputRefs.current[0]?.focus();
    } catch {
      setError(t('auth.resendFailed'));
    } finally {
      setResending(false);
    }
  }

  const filled = digits.filter(Boolean).length;
  const allFilled = filled === OTP_LENGTH;

  return (
    <div className="flex flex-col min-h-[calc(100dvh-4rem)] relative">
      {/* Back button */}
      <motion.button
        custom={0}
        variants={FADE_UP}
        initial="hidden"
        animate="show"
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] font-medium mb-6 hover:text-[var(--color-primary)] transition-colors self-start focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        {t('common.back')}
      </motion.button>

      <form ref={formRef} noValidate onSubmit={handleVerify} className="rounded-3xl surface-wash border border-[var(--color-border)] shadow-soft p-6">
      {/* Header */}
      <motion.div
        custom={1}
        variants={FADE_UP}
        initial="hidden"
        animate="show"
        className="mb-7"
      >
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-soft bg-[var(--color-primary)]">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect x="4" y="8" width="20" height="15" rx="3" stroke="var(--color-on-accent)" strokeWidth="2" />
            <path d="M4 12l10 7 10-7" stroke="var(--color-on-accent)" strokeWidth="2" strokeLinecap="round" />
            <circle cx="21" cy="7" r="4" fill="var(--color-on-accent)" fillOpacity="0.9" />
            <path d="M19.5 7l1 1 2-2" stroke="var(--color-primary)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">
          {t('auth.otp')}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
          {t('auth.codeSentTo', { count: OTP_LENGTH })}{' '}
          <span className="font-semibold text-[var(--color-text-secondary)]">
            +88 {phone}
          </span>
        </p>
      </motion.div>

      {/* OTP digit boxes */}
      <motion.div
        custom={2}
        variants={FADE_UP}
        initial="hidden"
        animate="show"
        className="mb-3"
      >
        <div className="flex gap-2.5 justify-between">
          {digits.map((digit, index) => (
            <motion.div
              key={index}
              animate={
                error
                  ? { x: [0, -5, 5, -5, 5, 0], scale: 1, transition: { duration: 0.35 } }
                  : { scale: focusedIndex === index ? 1.05 : 1 }
              }
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="flex-1"
            >
              <input
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                name="otp"
                autoComplete="one-time-code"
                maxLength={6}
                value={digit}
                onChange={(e) => updateDigit(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onFocus={(e) => { e.target.select(); setFocusedIndex(index); }}
                onBlur={() => setFocusedIndex(null)}
                className={`w-full aspect-square text-center text-xl font-bold rounded-xl border-2 bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus-visible:outline-none transition-colors duration-200 ${
                  digit
                    ? 'border-[var(--color-primary)] bg-[var(--color-bg-card)]'
                    : 'border-[var(--color-border)]'
                } ${error ? 'border-[var(--color-error)]' : ''} focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/25`}
                aria-label={t('auth.otpDigit', { n: index + 1 })}
              />
            </motion.div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[var(--color-primary)]"
            animate={{ width: `${(filled / OTP_LENGTH) * 100}%` }}
            transition={{ duration: 0.2 }}
          />
        </div>
      </motion.div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            aria-live="polite"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm text-[var(--color-error)] mb-3 flex items-center gap-1.5"
          >
            <CircleAlert size={15} aria-hidden="true" className="shrink-0" /> {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Verify button */}
      <motion.div custom={3} variants={FADE_UP} initial="hidden" animate="show" className="mb-5">
        <Button
          fullWidth
          size="lg"
          type="submit"
          disabled={loading || success || !allFilled}
          className="text-base font-bold"
        >
          <AnimatePresence mode="wait" initial={false}>
            {success ? (
              <motion.span
                key="success"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-2"
              >
                <CheckCircle2 aria-hidden="true" size={20} />
                {t('auth.verified')}
              </motion.span>
            ) : loading ? (
              <motion.span
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2"
              >
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                {t('common.loading')}
              </motion.span>
            ) : (
              <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {t('auth.verifyOtp')}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </motion.div>

      {/* Resend */}
      <motion.div
        custom={4}
        variants={FADE_UP}
        initial="hidden"
        animate="show"
        className="flex flex-col items-center gap-1"
      >
        <p className="text-sm text-[var(--color-text-muted)]">{t('auth.didNotReceive')}</p>
        <button
          type="button"
          onClick={handleResend}
          disabled={countdown > 0 || resending}
          className={`flex items-center gap-1.5 text-sm font-semibold transition-colors ${
            countdown > 0
              ? 'text-[var(--color-text-muted)] cursor-default'
              : 'text-[var(--color-primary)] hover:underline underline-offset-2'
          }`}
        >
          {resending ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              {t('common.loading')}
            </>
          ) : countdown > 0 ? (
            <span className="inline-flex items-center gap-1">
              {t('auth.resendIn', { seconds: countdown })}
            </span>
          ) : (
            <>
              <RefreshCw size={14} aria-hidden="true" />
              {t('auth.resendOtp')}
            </>
          )}
        </button>
      </motion.div>

      {/* Trust note */}
      <motion.p
        custom={5}
        variants={FADE_UP}
        initial="hidden"
        animate="show"
        className="mt-auto pt-6 text-center text-xs text-[var(--color-text-muted)]"
      >
        {t('auth.codeExpiry')}
      </motion.p>

      {/* Success overlay — full-screen scale+fade checkmark */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-bg-primary)]/90 backdrop-blur-sm z-20 rounded-inherit"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.05 }}
              className="w-24 h-24 rounded-full flex items-center justify-center shadow-[0_8px_40px_color-mix(in_srgb,var(--color-primary)_40%,transparent)] bg-[var(--color-primary)]"
            >
              <CheckCircle2 size={44} className="text-[var(--color-on-accent)]" strokeWidth={2} aria-hidden="true" />
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.35 }}
              className="mt-5 text-lg font-bold text-[var(--color-text-primary)]"
            >
              {t('auth.verified')}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
      </form>
    </div>
  );
}
