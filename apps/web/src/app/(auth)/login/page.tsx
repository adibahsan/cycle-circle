'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Phone, Shield, ChevronRight, CircleAlert, CircleCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { devMode, DEV_DEFAULT_PHONE } from '@vesta/shared/utils/config';
import '@vesta/shared/utils/i18n';

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

  const [phone, setPhone] = useState(devMode ? DEV_DEFAULT_PHONE : '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function validatePhone(value: string) {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return t('auth.phoneRequired');
    if (digits.length !== 11) return t('auth.phoneInvalid');
    if (!digits.startsWith('01')) return t('auth.phoneMustStart');
    return '';
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 11);
    setPhone(raw);
    if (error) setError('');
  }

  async function handleSendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading) return;
    const validationError = validatePhone(phone);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const body = await res.json().catch(() => ({})) as { referenceNo?: string; error?: string | { message: string } };
      if (!res.ok) {
        const msg = typeof body.error === 'object' ? body.error?.message : body.error;
        setError(msg ?? t('auth.sendOtpFailed'));
        return;
      }
      const { referenceNo } = body;
      router.push(`/verify-otp?referenceNo=${encodeURIComponent(referenceNo ?? '')}&phone=${encodeURIComponent(phone)}`);
    } catch {
      setError(t('auth.sendOtpFailed'));
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
        <div className="mb-4">
          <BrandLogo size={64} alt="" className="w-16 h-16" />
        </div>

        <h1 className="text-3xl font-extrabold mb-1 text-[var(--color-text-primary)]">
          Cycle Circle
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] text-center leading-relaxed px-4">
          {t('auth.loginHeadline')}
          <br />
          <span className="text-[var(--color-text-secondary)]">{t('app.tagline')}</span>
        </p>
      </motion.div>

      {/* ── Card ── */}
      <motion.form
        noValidate
        onSubmit={handleSendOtp}
        custom={1}
        variants={FADE_UP}
        initial="hidden"
        animate="show"
        className="rounded-3xl surface-wash border border-[var(--color-border)] shadow-soft p-6 mx-0"
      >
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">
          {t('auth.login')}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mb-5">
          {devMode ? t('auth.devModeHint') : t('auth.phoneHint')}
        </p>

        {/* Phone input */}
        <div className="mb-5">
          <label htmlFor="phone-input" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t('auth.phone')}
          </label>
          <div className="relative">
            {/* Country prefix */}
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)] select-none">
              +88
            </span>
            <input
              id="phone-input"
              aria-describedby={error ? 'phone-error login-notice' : 'login-notice'}
              aria-invalid={error ? true : undefined}
              type="tel"
              inputMode="numeric"
              name="phone"
              autoComplete="tel"
              spellCheck={false}
              placeholder={t('auth.phonePlaceholder')}
              value={phone}
              onChange={handlePhoneChange}
              maxLength={11}
              className={`w-full pl-14 pr-10 py-3.5 rounded-xl border bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:border-[var(--color-primary)] transition-colors duration-200 text-base tracking-widest font-medium ${
                error ? 'border-[var(--color-error)] focus-visible:ring-[var(--color-error)]/30' : 'border-[var(--color-border)]'
              }`}
            />
            {phone.length === 11 && !error && (
              <CircleCheck size={18} aria-hidden="true" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-primary)]" />
            )}
          </div>
          <p id="phone-error" role="alert" aria-live="polite" className="empty:hidden mt-1.5 text-sm text-[var(--color-error)] flex items-center gap-1.5">
            {error && <><CircleAlert size={15} aria-hidden="true" className="shrink-0" />{error}</>}
          </p>
          <p id="login-notice" className="mt-2 text-xs text-[var(--color-text-muted)] leading-relaxed">
            {t('auth.loginNotice')}
          </p>
        </div>

        <Button
          type="submit"
          fullWidth
          size="lg"
          disabled={loading}
          aria-busy={loading}
          className="text-base font-bold tracking-wide"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              {t('auth.sending')}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Phone size={18} aria-hidden="true" />
              {devMode ? `${t('auth.sendOtp')} ${t('auth.devSuffix')}` : t('auth.sendOtp')}
            </span>
          )}
        </Button>
      </motion.form>

      {/* ── Email fallback ── */}
      <motion.div
        custom={2}
        variants={FADE_UP}
        initial="hidden"
        animate="show"
        className="mt-4 text-center"
      >
        <Link
          href="/email-login"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-secondary)] font-semibold hover:underline underline-offset-2 transition-colors"
        >
          {t('auth.emailFallback')}
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
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
          <Shield size={14} className="text-[var(--color-primary)]" aria-hidden="true" />
          <span className="text-xs text-[var(--color-text-muted)]">
            {t('onboarding.privacy')}
          </span>
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)] text-center leading-relaxed px-6">
          {t('auth.agreePrefix')}{' '}
          <Link href="/privacy" className="text-[var(--color-secondary)] font-medium hover:underline underline-offset-2">{t('auth.privacyPolicy')}</Link>{' '}
          {t('auth.and')}{' '}
          <Link href="/terms" className="text-[var(--color-secondary)] font-medium hover:underline underline-offset-2">{t('auth.termsOfService')}</Link>
        </p>
      </motion.div>
    </div>
  );
}
