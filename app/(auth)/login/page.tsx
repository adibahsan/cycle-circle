'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Phone, Shield, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import VestaLogo from '@/components/ui/VestaLogo';
import { auth, ApiClientError } from '@/lib/api';
import '@/lib/i18n';

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const FADE_UP = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.42, ease: EASE },
  }),
};

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function validatePhone(value: string) {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return 'Phone number is required';
    if (digits.length !== 11) return 'Enter a valid 11-digit Bangladesh number';
    if (!digits.startsWith('01')) return 'Number must start with 01';
    return '';
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 11);
    setPhone(raw);
    if (error) setError('');
  }

  async function handleSendOtp() {
    const validationError = validatePhone(phone);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const { referenceNo } = await auth.requestOtp(phone);
      sessionStorage.setItem('vesta-otp-phone', phone);
      sessionStorage.setItem('vesta-otp-ref', referenceNo);
      router.push('/verify-otp');
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to send OTP. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-4rem)]">
      {/* ── Logo / hero section ── */}
      <motion.div
        custom={0}
        variants={FADE_UP}
        initial="hidden"
        animate="show"
        className="flex flex-col items-center pt-8 pb-6"
      >
        {/* Logo mark — floating bob animation */}
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="mb-4"
        >
          <VestaLogo size={56} animate={true} />
        </motion.div>

        <h1
          className="text-3xl font-bold bg-clip-text text-transparent mb-1"
          style={{ backgroundImage: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)' }}
        >
          Vesta
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] text-center leading-relaxed px-4">
          আপনার স্বাস্থ্য, আপনার নিয়ন্ত্রণে
          <br />
          <span className="text-[var(--color-text-secondary)]">Your cycle, your way</span>
        </p>
      </motion.div>

      {/* ── Card ── */}
      <motion.div
        custom={1}
        variants={FADE_UP}
        initial="hidden"
        animate="show"
        className="rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-soft p-6 mx-0"
      >
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">
          {t('auth.login')}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-5">
          Enter your phone number to receive a one-time code
        </p>

        {/* Phone input */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t('auth.phone')}
          </label>
          <div className="relative">
            {/* Country prefix */}
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)] select-none">
              🇧🇩 +88
            </span>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="01XXXXXXXXX"
              value={phone}
              onChange={handlePhoneChange}
              maxLength={11}
              className={`w-full pl-20 pr-4 py-3.5 rounded-xl border bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200 text-base tracking-widest font-medium ${
                error ? 'border-red-400 focus:ring-red-300' : 'border-[var(--color-border)]'
              }`}
            />
            {phone.length === 11 && !error && (
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="9" fill="currentColor" fillOpacity="0.15"/><path d="M5 9l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
            )}
          </div>
          {error && <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1"><span>⚠</span>{error}</p>}
        </div>

        <Button
          fullWidth
          size="lg"
          onClick={handleSendOtp}
          disabled={loading}
          className="rounded-2xl text-base font-bold tracking-wide"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Sending…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Phone size={18} />
              {t('auth.sendOtp')}
            </span>
          )}
        </Button>
      </motion.div>

      {/* ── Email fallback ── */}
      <motion.div
        custom={2}
        variants={FADE_UP}
        initial="hidden"
        animate="show"
        className="mt-4 text-center"
      >
        <button
          onClick={() => router.push('/email-login')}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-secondary)] font-semibold hover:underline underline-offset-2 transition-colors"
        >
          {t('auth.emailFallback')}
          <ChevronRight size={14} />
        </button>
      </motion.div>

      {/* ── Trust footer ── */}
      <motion.div
        custom={3}
        variants={FADE_UP}
        initial="hidden"
        animate="show"
        className="mt-auto pt-8 pb-2 flex flex-col items-center gap-2"
      >
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
          <Shield size={14} className="text-[var(--color-primary)]" />
          <span className="text-xs text-[var(--color-text-muted)]">
            Your data is encrypted &amp; private
          </span>
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)] text-center leading-relaxed px-6">
          By continuing you agree to Vesta&apos;s{' '}
          <span className="text-[var(--color-secondary)] font-medium">Privacy Policy</span>{' '}
          &amp;{' '}
          <span className="text-[var(--color-secondary)] font-medium">Terms of Service</span>
        </p>
      </motion.div>
    </div>
  );
}
