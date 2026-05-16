'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAppStore } from '@/lib/store';
import '@/lib/i18n';

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
  const { t } = useTranslation();
  const login = useAppStore((s) => s.login);

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);
  const [phone, setPhone] = useState('');

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Read phone from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('vesta-otp-phone');
    setPhone(stored ?? '01XXXXXXXXX');
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

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

  async function handleVerify() {
    const code = digits.join('');
    if (code.length < OTP_LENGTH) {
      setError(`Please enter all ${OTP_LENGTH} digits`);
      return;
    }

    setLoading(true);
    // Simulated verification — accept any 6-digit code
    await new Promise((res) => setTimeout(res, 1400));

    setSuccess(true);
    await new Promise((res) => setTimeout(res, 700));

    login('otp');
    router.replace('/onboarding');
  }

  async function handleResend() {
    if (countdown > 0) return;
    setResending(true);
    setDigits(Array(OTP_LENGTH).fill(''));
    setError('');
    await new Promise((res) => setTimeout(res, 900));
    setResending(false);
    setCountdown(RESEND_SECONDS);
    inputRefs.current[0]?.focus();
  }

  const filled = digits.filter(Boolean).length;
  const allFilled = filled === OTP_LENGTH;

  return (
    <div className="flex flex-col min-h-[calc(100dvh-4rem)]">
      {/* Back button */}
      <motion.button
        custom={0}
        variants={FADE_UP}
        initial="hidden"
        animate="show"
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] font-medium mb-6 hover:text-[var(--color-primary)] transition-colors self-start"
      >
        <ArrowLeft size={16} />
        {t('common.back')}
      </motion.button>

      {/* Header */}
      <motion.div
        custom={1}
        variants={FADE_UP}
        initial="hidden"
        animate="show"
        className="mb-7"
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-soft"
          style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)' }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <rect x="4" y="8" width="20" height="15" rx="3" stroke="white" strokeWidth="2" />
            <path d="M4 12l10 7 10-7" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <circle cx="21" cy="7" r="4" fill="white" fillOpacity="0.9" />
            <path d="M19.5 7l1 1 2-2" stroke="var(--color-primary)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">
          {t('auth.otp')}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
          We sent a {OTP_LENGTH}-digit code to{' '}
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
                  ? { x: [0, -5, 5, -5, 5, 0], transition: { duration: 0.35 } }
                  : {}
              }
              className="flex-1"
            >
              <input
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={digit}
                onChange={(e) => updateDigit(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onFocus={(e) => e.target.select()}
                className={`w-full aspect-square text-center text-xl font-bold rounded-xl border-2 bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus:outline-none transition-all duration-200 ${
                  digit
                    ? 'border-[var(--color-primary)] bg-[var(--color-bg-card)]'
                    : 'border-[var(--color-border)]'
                } ${error ? 'border-red-400' : ''} focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/25`}
                aria-label={`Digit ${index + 1}`}
              />
            </motion.div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))' }}
            animate={{ width: `${(filled / OTP_LENGTH) * 100}%` }}
            transition={{ duration: 0.2 }}
          />
        </div>
      </motion.div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm text-red-500 mb-3 flex items-center gap-1"
          >
            <span>⚠</span> {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Verify button */}
      <motion.div custom={3} variants={FADE_UP} initial="hidden" animate="show" className="mb-5">
        <Button
          fullWidth
          size="lg"
          onClick={handleVerify}
          disabled={loading || success || !allFilled}
          className="rounded-2xl text-base font-bold"
        >
          <AnimatePresence mode="wait" initial={false}>
            {success ? (
              <motion.span
                key="success"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-2"
              >
                <CheckCircle2 size={20} />
                Verified!
              </motion.span>
            ) : loading ? (
              <motion.span
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2"
              >
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Verifying…
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
        <p className="text-sm text-[var(--color-text-muted)]">Didn&apos;t receive the code?</p>
        <button
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
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Resending…
            </>
          ) : countdown > 0 ? (
            t('auth.resendIn', { seconds: countdown })
          ) : (
            <>
              <RefreshCw size={14} />
              Resend OTP
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
        This code expires in 10 minutes. Never share your OTP with anyone.
      </motion.p>
    </div>
  );
}
