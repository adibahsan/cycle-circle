'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Mail, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function EmailLoginPage() {
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
    if (error) setError('');
  }

  async function handleSendMagicLink() {
    if (!email.trim()) {
      setError(t('auth.emailRequired'));
      return;
    }
    if (!isValidEmail(email)) {
      setError(t('auth.emailInvalid'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/magic-link/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? t('auth.sendMagicLinkFailed'));
        return;
      }
      setSent(true);
    } catch {
      setError(t('auth.sendMagicLinkFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-[calc(100dvh-4rem)]">
      {/* Back */}
      <motion.div
        custom={0}
        variants={FADE_UP}
        initial="hidden"
        animate="show"
        className="self-start"
      >
        <Link
          href="/login"
          className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] font-medium mb-6 hover:text-[var(--color-primary)] transition-colors"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {t('auth.backToPhoneLogin')}
        </Link>
      </motion.div>

      <AnimatePresence mode="wait" initial={false}>
        {!sent ? (
          /* ── Send form ── */
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Header */}
            <motion.div custom={1} variants={FADE_UP} initial="hidden" animate="show" className="mb-7">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-soft"
                style={{ background: 'linear-gradient(135deg, var(--color-secondary) 0%, var(--color-primary) 100%)' }}
              >
                <Mail size={28} color="white" strokeWidth={1.8} />
              </div>
              <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">
                Email Login
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                We&apos;ll email you a magic link — no password needed.
              </p>
            </motion.div>

            {/* Trial notice */}
            <motion.div
              custom={2}
              variants={FADE_UP}
              initial="hidden"
              animate="show"
              className="mb-5 px-4 py-3 rounded-2xl border flex items-start gap-3"
              style={{
                background: 'linear-gradient(135deg, rgba(155,127,212,0.08) 0%, rgba(232,71,108,0.06) 100%)',
                borderColor: 'var(--color-secondary)',
                borderStyle: 'dashed',
              }}
            >
              <Clock size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-secondary)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-0.5">
                  24-hour trial window
                </p>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  Email login is available as a 24-hour trial. For full access, verify your phone
                  number.
                </p>
              </div>
            </motion.div>

            {/* Input */}
            <motion.div custom={3} variants={FADE_UP} initial="hidden" animate="show" className="mb-5">
              <Input
                id="email"
                label={t('auth.emailFallback').replace('Login with Email instead', 'Email address')}
                type="email"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={handleEmailChange}
                error={error}
                autoComplete="email"
                inputMode="email"
              />
            </motion.div>

            {/* CTA */}
            <motion.div custom={4} variants={FADE_UP} initial="hidden" animate="show">
              <Button
                fullWidth
                size="lg"
                onClick={handleSendMagicLink}
                disabled={loading}
                className="rounded-2xl text-base font-bold mb-4"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Sending…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles size={18} aria-hidden="true" />
                    {t('auth.sendMagicLink')}
                  </span>
                )}
              </Button>
            </motion.div>
          </motion.div>
        ) : (
          /* ── Success state ── */
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center text-center py-8"
          >
            {/* Animated envelope */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative mb-6"
            >
              <div
                className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-glow"
                style={{ background: 'linear-gradient(135deg, var(--color-secondary) 0%, var(--color-primary) 100%)' }}
              >
                <Mail size={44} color="white" strokeWidth={1.5} />
              </div>
              {/* Sparkles orbiting */}
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
              We sent a magic link to
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32, duration: 0.4 }}
              className="text-sm font-semibold text-[var(--color-text-primary)] mb-6 px-4"
            >
              {email}
            </motion.p>

            {/* Info card */}
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
                  'Check your inbox (and spam folder)',
                  'The link is valid for 15 minutes',
                  '24-hour trial access after first login',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)]">
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
              onClick={() => { setSent(false); setEmail(''); }}
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors w-full text-center focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500"
            >
              Use a different email
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer link */}
      {!sent && (
        <motion.div
          custom={5}
          variants={FADE_UP}
          initial="hidden"
          animate="show"
          className="mt-auto pt-6 text-center"
        >
          <p className="text-sm text-[var(--color-text-muted)]">
            Have a phone number?{' '}
            <Link
              href="/login"
              className="text-[var(--color-primary)] font-semibold hover:underline underline-offset-2"
            >
              Login with OTP
            </Link>
          </p>
        </motion.div>
      )}
    </div>
  );
}
