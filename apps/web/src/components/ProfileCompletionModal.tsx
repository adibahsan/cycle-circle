'use client';

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Phone, User, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { PopupLayer } from '@vesta/shared/utils/popup-core';
import { completeProfile, updateContactInfo, updateUserName } from '@/app/actions/user-actions';

interface ProfileCompletionModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful profile save, before the modal auto-closes. */
  onCompleted?: () => void;
  /** Current completion percentage (0–100). When provided, renders a progress chip under the modal title. */
  percent?: number;
  /** Completion items from the profile checker. Used to determine which fields are missing. */
  items?: { key: string; done: boolean }[];
  /** 'prompt' when the arbiter opened it, 'popup' when the user did. */
  layer?: PopupLayer;
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

function validateEmail(value: string) {
  const v = value.trim();
  if (v.length === 0) return 'Email is required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email';
  return '';
}

export function ProfileCompletionModal({ open, onClose, onCompleted, percent, items, layer = 'popup' }: ProfileCompletionModalProps) {
  const { t } = useTranslation();
  const firstFocusableRef = useRef<HTMLInputElement>(null);

  const CONTACT_KEYS = ['fullName', 'phone', 'email'];
  const missing = (items && items.length)
    ? items.filter(i => !i.done && CONTACT_KEYS.includes(i.key)).map(i => i.key)
    : ['fullName', 'phone']; // back-compat fallback when items not provided
  const needName = missing.includes('fullName');
  const needPhone = missing.includes('phone');
  const needEmail = missing.includes('email');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 11);
    setPhone(raw);
    if (phoneError) setPhoneError('');
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFullName(e.target.value);
    if (nameError) setNameError('');
  }

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
    if (emailError) setEmailError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nErr = needName ? validateFullName(fullName) : '';
    const pErr = needPhone ? validatePhone(phone) : '';
    const eErr = needEmail ? validateEmail(email) : '';
    if (nErr || pErr || eErr) { setNameError(nErr); setPhoneError(pErr); setEmailError(eErr); return; }

    setSubmitting(true);
    setSubmitError('');
    try {
      if (needName && needPhone) {
        const r1 = await completeProfile({ fullName: fullName.trim(), phone });
        if (!r1.ok) {
          if (r1.code === 'PHONE_TAKEN') setPhoneError(t('settings.phoneInUse'));
          else if (r1.code === 'INVALID_PHONE') setPhoneError(t('settings.phoneAddFailed'));
          else setSubmitError(t('settings.emailAddFailed'));
          return;
        }
        if (needEmail) {
          const r2 = await updateContactInfo({ email: email.trim() });
          if (!r2.ok) {
            setEmailError(r2.code === 'EMAIL_TAKEN' ? t('settings.emailInUse') : t('settings.emailAddFailed'));
            return;
          }
        }
      } else {
        if (needName) await updateUserName(fullName.trim());
        const contact: { phone?: string; email?: string } = {};
        if (needPhone) contact.phone = phone;
        if (needEmail) contact.email = email.trim();
        if (Object.keys(contact).length) {
          const r = await updateContactInfo(contact);
          if (!r.ok) {
            if (r.code === 'PHONE_TAKEN') setPhoneError(t('settings.phoneInUse'));
            else if (r.code === 'EMAIL_TAKEN') setEmailError(t('settings.emailInUse'));
            else if (r.code === 'INVALID_PHONE') setPhoneError(t('settings.phoneAddFailed'));
            else setSubmitError(t('settings.emailAddFailed'));
            return;
          }
        }
      }
      onCompleted?.();
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('vesta:profile-updated'));
      onClose();
    } catch {
      setSubmitError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const header = (
    <div className="px-6 pt-5 pb-2 pr-14">
      <h2 id="profile-completion-title" className="text-lg font-bold text-[var(--color-text-primary)]">
        {t('profile.completeTitle')}
      </h2>
      {typeof percent === 'number' && (
        <span
          aria-label={t('profileCompletion.percentComplete', { percent })}
          className="inline-block mt-1.5 mb-0.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums"
          style={{
            background: 'color-mix(in srgb, var(--goal-accent) 12%, transparent)',
            color: 'var(--goal-accent)',
          }}
        >
          {t('profileCompletion.percentComplete', { percent })}
        </span>
      )}
      <p id="profile-completion-desc" className="mt-1 text-sm text-[var(--color-text-muted)] leading-relaxed">
        {needPhone ? t('profile.completeDesc') : needEmail ? t('profile.completeDescEmail') : t('profile.completeDesc')}
      </p>
    </div>
  );

  const footer = missing.length === 0 ? null : (
    <div className="flex flex-col-reverse sm:flex-row gap-3 px-6 pt-3 pb-5">
      <Button type="button" variant="ghost" size="md" onClick={onClose} className="flex-1 rounded-xl">
        {t('common.later')}
      </Button>
      <Button type="submit" form="profile-completion-form" variant="primary" size="md" disabled={submitting} className="flex-1 rounded-xl">
        {submitting ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            {t('common.saving')}
          </span>
        ) : (
          t('profile.completeAction')
        )}
      </Button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      layer={layer}
      titleId="profile-completion-title"
      descId="profile-completion-desc"
      header={header}
      footer={footer}
      initialFocusRef={firstFocusableRef}
    >
      {missing.length === 0 ? (
        <div className="flex flex-col items-center gap-4 px-6 pt-4 pb-8">
          <p className="text-sm text-[var(--color-text-muted)] text-center">
            You&apos;re all set on contact info.
          </p>
          <Button type="button" variant="ghost" size="md" onClick={onClose} className="rounded-xl">
            {t('common.later')}
          </Button>
        </div>
      ) : (
        <div className="px-6 pt-3 pb-4">
          <form id="profile-completion-form" onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Full Name */}
            {needName && (
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
                    ref={missing[0] === 'fullName' ? firstFocusableRef : undefined}
                    id="completion-fullname"
                    name="fullName"
                    type="text"
                    autoComplete="name"
                    spellCheck={false}
                    placeholder={t('profile.fullNamePlaceholder')}
                    value={fullName}
                    onChange={handleNameChange}
                    maxLength={200}
                    className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]/30 focus-visible:border-[var(--goal-accent)] transition-colors duration-200 text-base ${
                      nameError
                        ? 'border-[var(--color-error)] focus-visible:ring-[var(--color-error)]/30'
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
                    className="mt-1.5 text-sm text-[var(--color-error)] flex items-center gap-1"
                  >
                    <span aria-hidden="true">⚠</span>
                    {nameError}
                  </p>
                )}
              </div>
            )}

            {/* Phone Number */}
            {needPhone && (
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
                    ref={missing[0] === 'phone' ? firstFocusableRef : undefined}
                    id="completion-phone"
                    type="tel"
                    inputMode="numeric"
                    name="phone"
                    autoComplete="tel"
                    spellCheck={false}
                    placeholder={t('auth.phonePlaceholder')}
                    value={phone}
                    onChange={handlePhoneChange}
                    maxLength={11}
                    className={`w-full pl-20 pr-10 py-3 rounded-xl border bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]/30 focus-visible:border-[var(--goal-accent)] transition-colors duration-200 text-base tracking-widest font-medium ${
                      phoneError
                        ? 'border-[var(--color-error)] focus-visible:ring-[var(--color-error)]/30'
                        : 'border-[var(--color-border)]'
                    }`}
                    aria-describedby={phoneError ? 'completion-phone-error' : undefined}
                  />
                  {phone.length === 11 && !phoneError && (
                    <span
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--goal-accent)]"
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
                    className="mt-1.5 text-sm text-[var(--color-error)] flex items-center gap-1"
                  >
                    <span aria-hidden="true">⚠</span>
                    {phoneError}
                  </p>
                )}
              </div>
            )}

            {/* Email */}
            {needEmail && (
              <div>
                <label
                  htmlFor="completion-email"
                  className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
                >
                  {t('settings.email')}
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
                    <Mail size={16} aria-hidden="true" />
                  </span>
                  <input
                    ref={missing[0] === 'email' ? firstFocusableRef : undefined}
                    id="completion-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    spellCheck={false}
                    inputMode="email"
                    placeholder={t('settings.emailInputPlaceholder')}
                    value={email}
                    onChange={handleEmailChange}
                    className={`w-full pl-10 pr-4 py-3 rounded-xl border bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]/30 focus-visible:border-[var(--goal-accent)] transition-colors duration-200 text-base ${
                      emailError
                        ? 'border-[var(--color-error)] focus-visible:ring-[var(--color-error)]/30'
                        : 'border-[var(--color-border)]'
                    }`}
                    aria-describedby={emailError ? 'completion-email-error' : undefined}
                  />
                </div>
                {emailError && (
                  <p
                    id="completion-email-error"
                    role="alert"
                    aria-live="polite"
                    className="mt-1.5 text-sm text-[var(--color-error)] flex items-center gap-1"
                  >
                    <span aria-hidden="true">⚠</span>
                    {emailError}
                  </p>
                )}
              </div>
            )}

            {/* Server-level error */}
            {submitError && (
              <p
                role="alert"
                aria-live="polite"
                className="text-sm text-[var(--color-error)] flex items-center gap-1"
              >
                <span aria-hidden="true">⚠</span>
                {submitError}
              </p>
            )}

            {/* Trial info banner — only when phone is missing */}
            {needPhone && (
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl surface-peach border border-[var(--goal-accent)]/20">
                <Phone
                  size={15}
                  className="text-[var(--goal-accent)] mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  {t('profile.trialNote')}
                </p>
              </div>
            )}

</form>
        </div>
      )}
    </Modal>
  );
}
