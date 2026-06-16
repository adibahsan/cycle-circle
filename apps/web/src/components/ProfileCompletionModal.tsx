'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Phone, User, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { completeProfile } from '@/app/actions/user-actions';

interface ProfileCompletionModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful profile save, before the modal auto-closes. */
  onCompleted?: () => void;
}

function validatePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return 'Phone number is required';
  if (digits.length !== 11) return 'Phone number must be 11 digits';
  if (!digits.startsWith('01')) return 'Phone number must start with 01';
  return '';
}

function validateFullName(value: string) {
  if (value.trim().length === 0) return 'Full name is required';
  return '';
}

export function ProfileCompletionModal({ open, onClose, onCompleted }: ProfileCompletionModalProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  // Focus first input when modal opens
  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => {
        firstFocusableRef.current?.focus();
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 11);
    setPhone(raw);
    if (phoneError) setPhoneError('');
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFullName(e.target.value);
    if (nameError) setNameError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nErr = validateFullName(fullName);
    const pErr = validatePhone(phone);
    if (nErr || pErr) {
      setNameError(nErr);
      setPhoneError(pErr);
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      await completeProfile({ fullName: fullName.trim(), phone });
      setSuccess(true);
      onCompleted?.();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch {
      setSubmitError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      aria-modal="true"
      role="dialog"
      aria-labelledby="profile-completion-title"
      aria-describedby="profile-completion-desc"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        ref={dialogRef}
        className="relative z-10 w-full sm:max-w-md mx-4 sm:mx-auto rounded-t-3xl sm:rounded-3xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-xl overscroll-contain"
        style={{ overscrollBehavior: 'contain' }}
      >
        {/* Handle bar (mobile) */}
        <div className="flex justify-center pt-3 sm:hidden" aria-hidden="true">
          <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-2">
          <div>
            <h2
              id="profile-completion-title"
              className="text-lg font-bold text-[var(--color-text-primary)]"
            >
              {t('profile.completeTitle')}
            </h2>
            <p
              id="profile-completion-desc"
              className="mt-1 text-sm text-[var(--color-text-muted)] leading-relaxed"
            >
              {t('profile.completeDesc')}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Dismiss"
            className="ml-3 mt-0.5 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/50 shrink-0"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Success state */}
        {success ? (
          <div
            className="flex flex-col items-center gap-3 px-6 pt-6 pb-8"
            aria-live="polite"
          >
            <CheckCircle
              size={48}
              className="text-emerald-500"
              aria-hidden="true"
            />
            <p className="text-base font-semibold text-[var(--color-text-primary)]">
              {t('profile.completeSuccess')}
            </p>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} noValidate className="px-6 pt-3 pb-6 space-y-4">
            {/* Full Name */}
            <div>
              <label
                htmlFor="completion-fullname"
                className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
              >
                {t('profile.fullName')}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                  <User size={16} aria-hidden="true" />
                </span>
                <input
                  ref={firstFocusableRef}
                  id="completion-fullname"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  spellCheck={false}
                  placeholder={t('profile.fullNamePlaceholder')}
                  value={fullName}
                  onChange={handleNameChange}
                  maxLength={200}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:border-[var(--color-primary)] transition-colors duration-200 text-base ${
                    nameError
                      ? 'border-red-400 focus-visible:ring-red-300'
                      : 'border-[var(--color-border)]'
                  }`}
                  aria-describedby={nameError ? 'completion-name-error' : undefined}
                />
              </div>
              {nameError && (
                <p
                  id="completion-name-error"
                  role="alert"
                  aria-live="polite"
                  className="mt-1.5 text-sm text-red-500 flex items-center gap-1"
                >
                  <span aria-hidden="true">⚠</span>
                  {nameError}
                </p>
              )}
            </div>

            {/* Phone Number */}
            <div>
              <label
                htmlFor="completion-phone"
                className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
              >
                {t('auth.phone')}
              </label>
              <div className="relative">
                {/* Country prefix */}
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)] select-none pointer-events-none">
                  🇧🇩 +88
                </span>
                <input
                  id="completion-phone"
                  type="tel"
                  inputMode="numeric"
                  name="phone"
                  autoComplete="tel"
                  spellCheck={false}
                  placeholder="01XXXXXXXXX…"
                  value={phone}
                  onChange={handlePhoneChange}
                  maxLength={11}
                  className={`w-full pl-20 pr-10 py-3 rounded-xl border bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:border-[var(--color-primary)] transition-colors duration-200 text-base tracking-widest font-medium ${
                    phoneError
                      ? 'border-red-400 focus-visible:ring-red-300'
                      : 'border-[var(--color-border)]'
                  }`}
                  aria-describedby={phoneError ? 'completion-phone-error' : undefined}
                />
                {phone.length === 11 && !phoneError && (
                  <span
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500"
                    aria-hidden="true"
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <circle cx="9" cy="9" r="9" fill="currentColor" fillOpacity="0.15" />
                      <path
                        d="M5 9l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                )}
              </div>
              {phoneError && (
                <p
                  id="completion-phone-error"
                  role="alert"
                  aria-live="polite"
                  className="mt-1.5 text-sm text-red-500 flex items-center gap-1"
                >
                  <span aria-hidden="true">⚠</span>
                  {phoneError}
                </p>
              )}
            </div>

            {/* Server-level error */}
            {submitError && (
              <p
                role="alert"
                aria-live="polite"
                className="text-sm text-red-500 flex items-center gap-1"
              >
                <span aria-hidden="true">⚠</span>
                {submitError}
              </p>
            )}

            {/* Trial info banner */}
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-[var(--color-primary)]/8 border border-[var(--color-primary)]/20">
              <Phone
                size={15}
                className="text-[var(--color-primary)] mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                {t(
                  'profile.trialNote',
                  'Your 24-hour trial is active. Add a phone number to keep full access after it ends.'
                )}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={onClose}
                className="flex-1 rounded-xl"
              >
                {t('common.later')}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={submitting}
                className="flex-1 rounded-xl"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    {t('common.saving')}
                  </span>
                ) : (
                  t('profile.completeAction')
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
