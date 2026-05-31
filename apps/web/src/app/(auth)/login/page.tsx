'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import {
  BadgeCheck,
  ChevronRight,
  CircleAlert,
  Clock,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  Send,
  Shield,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { devMode, DEV_DEFAULT_PHONE } from '@vesta/shared/utils/config';
import '@vesta/shared/utils/i18n';

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const CHECK_COOLDOWN_SECONDS = 30;

const FADE_UP = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.42, ease: EASE },
  }),
};

type LoginTab = 'otp' | 'subscription' | 'email';
type SubscriptionStatus = 'idle' | 'checking' | 'registered' | 'unregistered' | 'requesting';

function sanitizePhone(value: string) {
  return value.replace(/\D/g, '').slice(0, 11);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

function PhoneField({
  id,
  label,
  value,
  error,
  onChange,
  placeholder,
  showSuccess,
}: {
  id: string;
  label: string;
  value: string;
  error: string;
  placeholder: string;
  showSuccess?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
      >
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)] select-none">
          🇧🇩 +88
        </span>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          name={id}
          autoComplete="tel"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(sanitizePhone(e.target.value))}
          maxLength={11}
          aria-invalid={Boolean(error)}
          className={`w-full pl-20 pr-4 py-3.5 rounded-xl border bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-colors duration-200 text-base tracking-widest font-medium ${
            error ? 'border-red-400 focus:ring-red-300' : 'border-[var(--color-border)]'
          }`}
        />
        {showSuccess && !error && value.length === 11 && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500">
            <BadgeCheck size={18} aria-hidden="true" />
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<LoginTab>('otp');

  const [otpPhone, setOtpPhone] = useState(devMode ? DEV_DEFAULT_PHONE : '');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  const [subscriptionPhone, setSubscriptionPhone] = useState(devMode ? DEV_DEFAULT_PHONE : '');
  const [subscriptionError, setSubscriptionError] = useState('');
  const [subscriptionMessage, setSubscriptionMessage] = useState('');
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('idle');
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  function validatePhone(value: string) {
    if (value.length === 0) return t('auth.phoneRequired');
    if (value.length !== 11) return t('auth.phoneInvalid');
    if (!value.startsWith('01')) return t('auth.phoneMustStart');
    return '';
  }

  function armCheckCooldown() {
    setCooldownUntil(Date.now() + CHECK_COOLDOWN_SECONDS * 1000);
    setNow(Date.now());
  }

  useEffect(() => {
    if (!cooldownUntil) return undefined;

    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  useEffect(() => {
    if (cooldownUntil && now >= cooldownUntil) {
      setCooldownUntil(null);
    }
  }, [cooldownUntil, now]);

  function handleOtpPhoneChange(value: string) {
    setOtpPhone(value);
    if (otpError) setOtpError('');
  }

  function handleSubscriptionPhoneChange(value: string) {
    setSubscriptionPhone(value);
    if (subscriptionError) setSubscriptionError('');
    if (subscriptionMessage) setSubscriptionMessage('');
    if (subscriptionStatus !== 'idle') setSubscriptionStatus('idle');
  }

  function handleTabKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const order: LoginTab[] = ['otp', 'subscription', 'email'];
    const index = order.indexOf(activeTab);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setActiveTab(order[(index + 1) % order.length]);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setActiveTab(order[(index - 1 + order.length) % order.length]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveTab(order[0]);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveTab(order[order.length - 1]);
    }
  }

  async function handleSendOtp() {
    const validationError = validatePhone(otpPhone);
    if (validationError) {
      setOtpError(validationError);
      return;
    }

    setOtpLoading(true);

    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: otpPhone }),
      });
      const body = await res.json().catch(() => ({})) as { referenceNo?: string; error?: string | { message: string } };
      if (!res.ok) {
        const msg = typeof body.error === 'object' ? body.error?.message : body.error;
        setOtpError(msg ?? t('auth.sendOtpFailed'));
        return;
      }
      const { referenceNo } = body;
      router.push(`/verify-otp?referenceNo=${encodeURIComponent(referenceNo ?? '')}&phone=${encodeURIComponent(otpPhone)}`);
    } catch {
      setOtpError(t('auth.sendOtpFailed'));
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleSubscriptionCheck() {
    const validationError = validatePhone(subscriptionPhone);
    if (validationError) {
      setSubscriptionError(validationError);
      return;
    }

    const previousStatus = subscriptionStatus;
    setSubscriptionLoading(true);
    setSubscriptionStatus('checking');
    setSubscriptionError('');
    setSubscriptionMessage('');

    try {
      const res = await fetch('/api/auth/subscription/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: subscriptionPhone }),
      });
      const body = await res.json().catch(() => ({})) as {
        subscriptionStatus?: 'REGISTERED' | 'UNREGISTERED';
        user?: { profileCompleted?: boolean };
        error?: string | { message?: string };
      };
      if (!res.ok) {
        setSubscriptionStatus(previousStatus === 'unregistered' ? 'unregistered' : 'idle');
        setSubscriptionError(getErrorMessage(body.error, t('auth.subscriptionCheckFailed')));
        return;
      }

      if (body.subscriptionStatus === 'REGISTERED') {
        setSubscriptionStatus('registered');
        setSubscriptionMessage(t('auth.subscriptionRedirecting'));
        window.setTimeout(() => {
          router.replace(body.user?.profileCompleted ? '/dashboard' : '/onboarding');
        }, 650);
        return;
      }

      setSubscriptionStatus('unregistered');
      setSubscriptionMessage(t('auth.subscriptionUnregistered'));
    } catch {
      setSubscriptionStatus(previousStatus === 'unregistered' ? 'unregistered' : 'idle');
      setSubscriptionError(t('auth.subscriptionCheckFailed'));
    } finally {
      armCheckCooldown();
      setSubscriptionLoading(false);
    }
  }

  async function handleSubscriptionRequest() {
    const validationError = validatePhone(subscriptionPhone);
    if (validationError) {
      setSubscriptionError(validationError);
      return;
    }

    const previousStatus = subscriptionStatus;
    setSubscriptionLoading(true);
    setSubscriptionStatus('requesting');
    setSubscriptionError('');
    setSubscriptionMessage('');

    try {
      const res = await fetch('/api/auth/subscription/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: subscriptionPhone }),
      });
      const body = await res.json().catch(() => ({})) as {
        subscriptionStatus?: 'REGISTERED' | 'UNREGISTERED';
        user?: { profileCompleted?: boolean };
        error?: string | { message?: string };
      };
      if (!res.ok) {
        setSubscriptionStatus(previousStatus === 'unregistered' ? 'unregistered' : 'idle');
        setSubscriptionError(getErrorMessage(body.error, t('auth.subscriptionRequestFailed')));
        return;
      }

      if (body.subscriptionStatus === 'REGISTERED') {
        setSubscriptionStatus('registered');
        setSubscriptionMessage(t('auth.subscriptionRedirecting'));
        window.setTimeout(() => {
          router.replace(body.user?.profileCompleted ? '/dashboard' : '/onboarding');
        }, 650);
        return;
      }

      setSubscriptionStatus('unregistered');
      setSubscriptionMessage(t('auth.subscriptionRequested'));
    } catch {
      setSubscriptionStatus(previousStatus === 'unregistered' ? 'unregistered' : 'idle');
      setSubscriptionError(t('auth.subscriptionRequestFailed'));
    } finally {
      setSubscriptionLoading(false);
    }
  }

  async function handleSendMagicLink() {
    if (!email.trim()) {
      setEmailError(t('auth.emailRequired'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError(t('auth.emailInvalid'));
      return;
    }

    setEmailLoading(true);
    try {
      const res = await fetch('/api/auth/magic-link/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        setEmailError(body.error ?? t('auth.sendMagicLinkFailed'));
        return;
      }
      setEmailSent(true);
    } catch {
      setEmailError(t('auth.sendMagicLinkFailed'));
    } finally {
      setEmailLoading(false);
    }
  }

  const checkCooldownRemaining = cooldownUntil ? Math.max(0, Math.ceil((cooldownUntil - now) / 1000)) : 0;
  const canCheckSubscription = !subscriptionLoading && checkCooldownRemaining === 0;
  const canRequestSubscription = !subscriptionLoading;

  const tabs: Array<{ id: LoginTab; label: string }> = [
    { id: 'otp', label: t('auth.otpTab') },
    { id: 'subscription', label: t('auth.subscriptionTab') },
    { id: 'email', label: t('auth.emailTab') },
  ];

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
        <motion.div
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="mb-4"
        >
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center shadow-soft">
            <span className="text-white text-2xl font-bold">V</span>
          </div>
        </motion.div>

        <h1 className="text-3xl font-bold mb-1 text-[var(--color-primary)]">
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
        <div className="relative">
          <div
            role="tablist"
            aria-label={t('auth.chooseLoginMethod')}
            onKeyDown={handleTabKeyDown}
            className="relative flex gap-1 rounded-2xl p-1 mb-5"
            style={{ background: 'var(--color-bg-secondary)' }}
          >
            <motion.div
              className="absolute top-1 bottom-1 rounded-xl"
              style={{ background: 'var(--color-bg-card)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              animate={{
                left: `calc(${tabs.findIndex((tab) => tab.id === activeTab)} * 33.333% + 4px)`,
                width: 'calc(33.333% - 8px)',
              }}
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
            />

            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`login-tab-${tab.id}`}
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  aria-controls={`login-panel-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className="relative z-10 flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                  style={{
                    color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {activeTab === 'otp' && (
              <motion.section
                key="otp"
                role="tabpanel"
                id="login-panel-otp"
                aria-labelledby="login-tab-otp"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.28, ease: EASE }}
              >
                <div className="mb-7">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-soft bg-[var(--color-primary)]">
                    <Phone size={28} color="white" strokeWidth={1.8} aria-hidden="true" />
                  </div>
                  <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">
                    {t('auth.loginWithOtp')}
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    {devMode
                      ? 'Dev mode: OTP verification with test codes'
                      : t('auth.otpLoginCopy')}
                  </p>
                </div>

                <div className="mb-5">
                  <PhoneField
                    id="otp-phone"
                    label={t('auth.phone')}
                    value={otpPhone}
                    error={otpError}
                    onChange={handleOtpPhoneChange}
                    placeholder="01XXXXXXXXX…"
                    showSuccess
                  />
                </div>

                <Button
                  fullWidth
                  size="lg"
                  onClick={handleSendOtp}
                  disabled={otpLoading}
                  className="rounded-2xl text-base font-bold tracking-wide"
                >
                  {otpLoading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      {t('auth.sending')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Phone size={18} aria-hidden="true" />
                      {devMode ? `${t('auth.sendOtp')} (dev)` : t('auth.sendOtp')}
                    </span>
                  )}
                </Button>
              </motion.section>
            )}

            {activeTab === 'subscription' && (
              <motion.section
                key="subscription"
                role="tabpanel"
                id="login-panel-subscription"
                aria-labelledby="login-tab-subscription"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.28, ease: EASE }}
              >
                <div className="mb-5">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-soft bg-[var(--color-primary)]">
                    <Shield size={28} color="white" strokeWidth={1.8} aria-hidden="true" />
                  </div>
                  <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">
                    {t('auth.loginWithSubscription')}
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                    {t('auth.subscriptionLoginCopy')}
                  </p>
                </div>

                <div className="mb-5">
                  <PhoneField
                    id="subscription-phone"
                    label={t('auth.phone')}
                    value={subscriptionPhone}
                    error={subscriptionError}
                    onChange={handleSubscriptionPhoneChange}
                    placeholder="01XXXXXXXXX…"
                    showSuccess={subscriptionStatus === 'registered' || subscriptionStatus === 'unregistered'}
                  />
                </div>

                <div
                  className="mb-5 rounded-2xl border p-4"
                  style={{ background: 'var(--color-bg-secondary)' }}
                  aria-live="polite"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {subscriptionStatus === 'registered' ? (
                        <BadgeCheck size={18} className="text-emerald-500" aria-hidden="true" />
                      ) : subscriptionStatus === 'unregistered' ? (
                        <CircleAlert size={18} className="text-amber-500" aria-hidden="true" />
                      ) : subscriptionStatus === 'checking' || subscriptionStatus === 'requesting' ? (
                        <Loader2 size={18} className="text-[var(--color-primary)] animate-spin" aria-hidden="true" />
                      ) : (
                        <Clock size={18} className="text-[var(--color-text-muted)]" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {subscriptionStatus === 'registered'
                          ? t('auth.subscriptionRegistered')
                          : subscriptionStatus === 'unregistered'
                            ? t('auth.subscriptionUnregistered')
                            : subscriptionStatus === 'checking'
                              ? t('auth.subscriptionChecking')
                              : subscriptionStatus === 'requesting'
                                ? t('auth.requestingSubscription')
                              : t('auth.subscriptionStatusPrompt')}
                      </p>
                      <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                        {subscriptionMessage || t('auth.subscriptionStatusHint')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    fullWidth
                    size="lg"
                    variant="secondary"
                    onClick={handleSubscriptionCheck}
                    disabled={!canCheckSubscription}
                    className="rounded-2xl text-base font-bold"
                  >
                    {subscriptionLoading && subscriptionStatus === 'checking' ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        {t('auth.subscriptionChecking')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <RefreshCw size={18} aria-hidden="true" />
                        {checkCooldownRemaining > 0
                          ? t('auth.checkAgainIn', { seconds: checkCooldownRemaining })
                          : t('auth.checkSubscriptionStatus')}
                      </span>
                    )}
                  </Button>

                  {(subscriptionStatus === 'unregistered' || subscriptionStatus === 'requesting') && (
                    <Button
                      fullWidth
                      size="lg"
                      onClick={handleSubscriptionRequest}
                      disabled={!canRequestSubscription}
                      className="rounded-2xl text-base font-bold"
                    >
                      {subscriptionLoading && subscriptionStatus === 'requesting' ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                          {t('auth.requestingSubscription')}
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Send size={18} aria-hidden="true" />
                          {t('auth.requestSubscription')}
                        </span>
                      )}
                    </Button>
                  )}
                </div>

                {checkCooldownRemaining > 0 && (
                  <p className="mt-3 text-sm text-[var(--color-text-muted)]" aria-live="polite">
                    {t('auth.subscriptionCheckCooldown', { seconds: checkCooldownRemaining })}
                  </p>
                )}
              </motion.section>
            )}

            {activeTab === 'email' && (
              <motion.section
                key="email"
                role="tabpanel"
                id="login-panel-email"
                aria-labelledby="login-tab-email"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.28, ease: EASE }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {!emailSent ? (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.28, ease: EASE }}
                    >
                      <div className="mb-7">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-soft bg-[var(--color-primary)]">
                          <Mail size={28} color="white" strokeWidth={1.8} aria-hidden="true" />
                        </div>
                        <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">
                          {t('auth.emailLoginTitle')}
                        </h2>
                        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                          {t('auth.emailLoginSubtitle')}
                        </p>
                      </div>

                      <div className="mb-5 px-4 py-3 rounded-2xl border flex items-start gap-3"
                        style={{
                          background: 'linear-gradient(135deg, rgba(155,127,212,0.08) 0%, rgba(232,71,108,0.06) 100%)',
                          borderColor: 'var(--color-secondary)',
                          borderStyle: 'dashed',
                        }}
                      >
                        <Clock size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-secondary)]" aria-hidden="true" />
                        <div>
                          <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-0.5">
                            {t('auth.emailTrialWindowTitle')}
                          </p>
                          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                            {t('auth.emailTrialWindowBody')}
                          </p>
                        </div>
                      </div>

                      <div className="mb-5">
                        <Input
                          id="email"
                          label={t('auth.emailAddress')}
                          type="email"
                          placeholder={t('auth.emailPlaceholder')}
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (emailError) setEmailError('');
                          }}
                          error={emailError}
                          autoComplete="email"
                          inputMode="email"
                          name="email"
                          spellCheck={false}
                        />
                      </div>

                      <Button
                        fullWidth
                        size="lg"
                        onClick={handleSendMagicLink}
                        disabled={emailLoading}
                        className="rounded-2xl text-base font-bold mb-4"
                      >
                        {emailLoading ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                            {t('auth.sending')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Sparkles size={18} aria-hidden="true" />
                            {t('auth.sendMagicLink')}
                          </span>
                        )}
                      </Button>

                      <div className="text-center">
                        <Link
                          href="/email-login"
                          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-secondary)] font-semibold hover:underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 rounded-sm"
                        >
                          {t('auth.openDedicatedEmailLogin')}
                          <ChevronRight size={14} aria-hidden="true" />
                        </Link>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.45, ease: EASE }}
                      className="flex flex-col items-center text-center py-8"
                    >
                      <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1, duration: 0.5, ease: EASE }}
                        className="relative mb-6"
                      >
                        <div className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-glow bg-[var(--color-primary)]">
                          <Mail size={44} color="white" strokeWidth={1.5} aria-hidden="true" />
                        </div>
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.3 + i * 0.1, type: 'spring', stiffness: 260, damping: 14 }}
                            className="absolute text-base"
                            style={{
                              top: i === 0 ? '-6px' : i === 1 ? '8px' : 'auto',
                              bottom: i === 2 ? '-4px' : 'auto',
                              left: i === 1 ? '-12px' : 'auto',
                              right: i === 0 ? '-8px' : i === 2 ? '2px' : 'auto',
                            }}
                          >
                            ✨
                          </motion.span>
                        ))}
                      </motion.div>

                      <motion.h2
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.4 }}
                        className="text-2xl font-bold text-[var(--color-text-primary)] mb-2"
                      >
                        {t('auth.magicLinkSent')}
                      </motion.h2>

                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.28, duration: 0.4 }}
                        className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-1 px-4"
                      >
                        {t('auth.magicLinkInboxCopy')}
                      </motion.p>
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.32, duration: 0.4 }}
                        className="text-sm font-semibold text-[var(--color-text-primary)] mb-6 px-4"
                      >
                        {email}
                      </motion.p>

                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.38, duration: 0.4 }}
                        className="w-full rounded-2xl p-4 text-left mb-6 border"
                        style={{
                          background: 'rgba(155,127,212,0.06)',
                          borderColor: 'var(--color-border)',
                        }}
                      >
                        <ul className="space-y-2.5">
                          {[
                            t('auth.checkInboxAndSpam'),
                            t('auth.linkValidFor'),
                            t('auth.trialAccessAfterFirstLogin'),
                          ].map((item, i) => (
                            <li key={item} className="flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)]">
                              <span
                                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                                style={{ background: 'var(--color-secondary)' }}
                              >
                                {i + 1}
                              </span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </motion.div>

                      <button
                        type="button"
                        onClick={() => {
                          setEmailSent(false);
                          setEmail('');
                        }}
                        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors w-full text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 rounded-sm"
                      >
                        {t('auth.useDifferentEmail')}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
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
          By continuing you agree to Vesta&apos;s{' '}
          <Link href="/privacy" className="text-[var(--color-secondary)] font-medium hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 rounded-sm">Privacy Policy</Link>{' '}
          &amp;{' '}
          <Link href="/terms" className="text-[var(--color-secondary)] font-medium hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 rounded-sm">Terms of Service</Link>
        </p>
      </motion.div>
    </div>
  );
}
