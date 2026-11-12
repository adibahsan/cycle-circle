'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { CheckCircle2, CircleAlert, Phone } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { PhoneField } from '@/components/auth/PhoneField';
import { OtpCodeField } from '@/components/auth/OtpCodeField';
import { toLocalPhone } from '@/lib/phone';
import { useHasMounted } from '@/components/motion/useHasMounted';
import { useProPriceVars } from '@/components/ProPriceProvider';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;

type Step = 'phone' | 'code' | 'success';

const ERROR_CODE_MAP: Record<string, string> = {
  PHONE_TAKEN: 'trial.err.phoneTaken',
  ALREADY_SUBSCRIBED: 'trial.err.alreadySubscribed',
  OTP_COOLDOWN: 'trial.err.cooldown',
  RATE_LIMITED: 'trial.err.rateLimited',
  INVALID_OTP: 'trial.err.invalidCode',
  CHALLENGE_EXPIRED: 'trial.err.invalidCode',
  CHALLENGE_NOT_FOUND: 'trial.err.invalidCode',
  ALREADY_VERIFIED: 'trial.err.invalidCode',
  INVALID_PHONE: 'trial.err.invalidPhone',
  OPERATOR_NOT_SUPPORTED: 'auth.operatorNotSupported',
};

function mapErrorCode(code: string | undefined): string {
  if (code && ERROR_CODE_MAP[code]) return ERROR_CODE_MAP[code];
  return 'trial.err.generic';
}

interface AddPhoneDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after the success flash with the status returned by the verify route (e.g. 'PRO'). */
  onVerified: (status: string | undefined) => void;
  initialPhone?: string | null;
  /** `upgrade`: a Free user subscribing from the Subscription page; `keep-account`: an email-trial user. */
  purpose?: 'keep-account' | 'upgrade';
}

export function AddPhoneDialog({ open, onClose, onVerified, initialPhone, purpose = 'keep-account' }: AddPhoneDialogProps) {
  const { t } = useTranslation();
  const proPrice = useProPriceVars();
  const hasMounted = useHasMounted();
  const prefersReduced = useReducedMotion();
  const prm = hasMounted && prefersReduced;

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

  // Tracks whether the dialog is still open/mounted so async work never fires callbacks after close.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
    return () => {
      openRef.current = false;
    };
  }, [open]);

  // Resend countdown ticks while on the code step
  useEffect(() => {
    if (step !== 'code' || countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [step, countdown]);

  // Reset to a fresh phone step every time the dialog opens
  useEffect(() => {
    if (!open) return;
    setStep('phone');
    setPhone(toLocalPhone(initialPhone));
    setPhoneError('');
    setDigits(Array(OTP_LENGTH).fill(''));
    setCodeError('');
    setCountdown(RESEND_SECONDS);
    setReferenceNo('');
  }, [open, initialPhone]);


  // Step: phone
  const handleSendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (sending) return;
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
        subscriptionStatus?: string;
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
      if (!openRef.current) return;
      onVerified(body.subscriptionStatus);
      onClose();
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
    setCodeError('');
    try {
      const stripped = phone.replace(/\D/g, '');
      const res = await fetch('/api/user/phone/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: stripped }),
      });
      const body = await res.json().catch(() => ({})) as {
        referenceNo?: string;
        error?: { message?: string; code?: string } | string;
      };
      if (!res.ok || !body.referenceNo) {
        const err = typeof body.error === 'object' ? body.error : undefined;
        setCodeError(t(mapErrorCode(err?.code)));
        return;
      }
      setReferenceNo(body.referenceNo);
      setDigits(Array(OTP_LENGTH).fill(''));
      setCountdown(RESEND_SECONDS);
    } catch {
      setCodeError(t('trial.err.generic'));
    } finally {
      setResending(false);
    }
  };

  const allFilled = digits.filter(Boolean).length === OTP_LENGTH;

  // Auto-submit once per completed code, like the verify page.
  const verifyRef = useRef(handleVerify);
  verifyRef.current = handleVerify;
  const lastAutoCode = useRef('');
  useEffect(() => {
    const code = digits.join('');
    if (step === 'code' && code.length === OTP_LENGTH && code !== lastAutoCode.current) {
      lastAutoCode.current = code;
      void verifyRef.current();
    }
  }, [digits, step]);

  return (
  <Modal
    open={open}
    onClose={onClose}
    titleId="trial-dialog-title"
    descId="trial-dialog-desc"
  >
    <div className="px-6 pb-6 pt-2 space-y-5">
      {/* One persistent live region, status text only: mounted from the start so step
          changes are announced (a region that mounts with its content often isn't). */}
      <p aria-live="polite" className="sr-only">
        {step === 'code' ? t('trial.enterCodeBody', { phone }) : step === 'success' ? t('trial.success') : ''}
      </p>
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
              : t(purpose === 'upgrade' ? 'trial.upgradeTitle' : 'trial.dialogTitle')}
        </h2>
        {step === 'phone' && (
          <p
            id="trial-dialog-desc"
            className="text-sm text-[var(--color-text-muted)] leading-relaxed"
          >
            {t(purpose === 'upgrade' ? 'trial.upgradeBody' : 'trial.dialogBody')}
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

      {/* ── Step: phone (same field and button as the login page) ── */}
      {step === 'phone' && (
        <form noValidate onSubmit={handleSendCode} className="space-y-4">
          <div>
            <PhoneField
              id="trial-phone"
              label={t('trial.phoneLabel')}
              value={phone}
              onChange={(v) => { setPhone(v); setPhoneError(''); }}
              error={phoneError}
              describedBy="trial-phone-notice"
            />
            <p id="trial-phone-notice" className="mt-2 text-xs text-[var(--color-text-muted)] leading-relaxed">
              <Trans i18nKey={proPrice ? 'auth.loginNotice' : 'auth.loginNoticeNoPrice'} values={proPrice ?? undefined} components={{ strong: <strong className="font-semibold text-[var(--color-text-secondary)]" /> }} />
            </p>
            {purpose === 'upgrade' && proPrice && (
              <p id="trial-price-notice" className="mt-2 text-xs font-medium text-[var(--color-text-secondary)] leading-relaxed">
                {t('subscription.confirmDeduction', proPrice)}
              </p>
            )}
          </div>

          {process.env.NEXT_PUBLIC_DEV_MODE === 'true' && (
            <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] rounded-lg px-3 py-2">
              {t('trial.devHint')}
            </p>
          )}

          <Button type="submit" fullWidth size="lg" disabled={sending} aria-busy={sending} className="text-base font-bold tracking-wide">
            <Phone size={18} aria-hidden="true" />
            {sending ? t('trial.sending') : t('trial.sendCode')}
          </Button>
        </form>
      )}

      {/* ── Step: code ── */}
      {step === 'code' && (
        <div className="space-y-4">
          <div role="group" aria-label={t('trial.enterCodeTitle')}>
            <OtpCodeField digits={digits} onChange={(d) => { setDigits(d); setCodeError(''); }} error={!!codeError} autoFocus />
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
                <CircleAlert size={15} aria-hidden="true" className="shrink-0" /> {codeError}
              </motion.p>
            )}
          </AnimatePresence>

          <Button
            fullWidth
            size="lg"
            className="text-base font-bold tracking-wide"
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
        <div className="flex flex-col items-center gap-4 py-6">
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
  );
}
