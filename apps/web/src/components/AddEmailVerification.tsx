'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OtpCodeField } from '@/components/auth/OtpCodeField'
import { emailErrorKey } from '@/lib/email-verify-errors'

const OTP_LENGTH = 6
const RESEND_SECONDS = 60
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const BTN_PRIMARY =
  'min-h-11 px-3 py-2 rounded-lg text-xs font-semibold text-[var(--color-on-accent)] bg-[var(--goal-accent)] disabled:opacity-50 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]'
const BTN_GHOST =
  'min-h-11 px-2 py-2 rounded-lg text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]'

interface AddEmailVerificationProps {
  /** Called once the server has verified the code and saved the email. */
  onVerified: (email: string) => void
  onCancel: () => void
  /** Prefix for element ids, so two instances never collide. */
  idPrefix?: string
}

async function postJson(url: string, payload: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = (await res.json().catch(() => ({}))) as {
    email?: string
    error?: { code?: string } | string
  }
  const code = typeof body.error === 'object' ? body.error?.code : undefined
  return { ok: res.ok, body, code }
}

/** Inline "add email" flow: enter address, receive a 6-digit code, type it to save the email. */
export function AddEmailVerification({ onVerified, onCancel, idPrefix = 'settings' }: AddEmailVerificationProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [countdown, setCountdown] = useState(RESEND_SECONDS)

  useEffect(() => {
    if (step !== 'code' || countdown <= 0) return
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [step, countdown])

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (busy) return
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setError(t('settings.invalidEmail'))
      return
    }
    setBusy(true)
    setError('')
    try {
      const r = await postJson('/api/user/email/request', { email: trimmed })
      if (!r.ok) {
        setError(t(emailErrorKey(r.code)))
        return
      }
      setDigits(Array(OTP_LENGTH).fill(''))
      setCountdown(RESEND_SECONDS)
      setStep('code')
    } catch {
      setError(t('trial.err.generic'))
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    if (busy || countdown > 0) return
    setBusy(true)
    setError('')
    try {
      const r = await postJson('/api/user/email/request', { email: email.trim() })
      if (!r.ok) {
        setError(t(emailErrorKey(r.code)))
        return
      }
      setDigits(Array(OTP_LENGTH).fill(''))
      setCountdown(RESEND_SECONDS)
    } catch {
      setError(t('trial.err.generic'))
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    const code = digits.join('')
    if (busy) return
    if (code.length < OTP_LENGTH) {
      setError(t('auth.otpAllDigits', { count: OTP_LENGTH }))
      return
    }
    setBusy(true)
    setError('')
    try {
      const r = await postJson('/api/user/email/verify', { code })
      if (!r.ok) {
        setError(t(emailErrorKey(r.code)))
        return
      }
      onVerified(r.body.email ?? email.trim())
    } catch {
      setError(t('trial.err.generic'))
    } finally {
      setBusy(false)
    }
  }

  const errorRegion = (
    <p aria-live="polite" role={error ? 'alert' : undefined} className="text-xs text-[var(--color-error)] mt-1 empty:hidden">
      {error}
    </p>
  )

  if (step === 'email') {
    return (
      <form noValidate onSubmit={sendCode}>
        <div className="flex items-center gap-2">
          <label htmlFor={`${idPrefix}-contact-email`} className="sr-only">{t('settings.email')}</label>
          <input
            id={`${idPrefix}-contact-email`}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            placeholder={t('settings.emailInputPlaceholder')}
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (error) setError('') }}
            aria-invalid={error ? true : undefined}
            className="flex-1 min-w-0 min-h-11 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-xs text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
            spellCheck={false}
          />
          <button type="submit" disabled={!email.trim() || busy} aria-busy={busy} className={BTN_PRIMARY}>
            {busy ? '…' : t('trial.sendCode')}
          </button>
          <button type="button" onClick={onCancel} className={BTN_GHOST}>{t('common.cancel')}</button>
        </div>
        {errorRegion}
      </form>
    )
  }

  return (
    <div className="space-y-3">
      <p aria-live="polite" className="text-xs text-[var(--color-text-secondary)]">
        {t('settings.emailCodeSent', { email: email.trim() })}
      </p>
      <div role="group" aria-label={t('trial.enterCodeTitle')}>
        <OtpCodeField digits={digits} onChange={(d) => { setDigits(d); setError('') }} error={!!error} autoFocus />
      </div>
      {errorRegion}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => void verify()}
          disabled={busy || digits.some((d) => !d)}
          aria-busy={busy}
          className={BTN_PRIMARY}
        >
          {busy ? t('trial.verifying') : t('trial.verify')}
        </button>
        <button type="button" onClick={() => void resend()} disabled={busy || countdown > 0} className={`${BTN_GHOST} [font-variant-numeric:tabular-nums]`}>
          {countdown > 0 ? t('trial.resendIn', { seconds: countdown }) : t('trial.resend')}
        </button>
        <button type="button" onClick={onCancel} className={BTN_GHOST}>{t('common.cancel')}</button>
      </div>
    </div>
  )
}
