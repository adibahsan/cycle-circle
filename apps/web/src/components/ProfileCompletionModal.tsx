'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Phone, User, CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { PopupLayer } from '@vesta/shared/utils/popup-core';
import { updateUserName } from '@/app/actions/user-actions';

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

function validateFullName(value: string) {
  if (value.trim().length === 0) return 'Full name is required';
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
  const [nameError, setNameError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFullName(e.target.value);
    if (nameError) setNameError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nErr = needName ? validateFullName(fullName) : '';
    if (nErr) { setNameError(nErr); return; }

    setSubmitting(true);
    setSubmitError('');
    try {
      if (needName) await updateUserName(fullName.trim());
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
      {needName ? (
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
      ) : (
        <Link
          href="/settings"
          onClick={onClose}
          className="flex-1 inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-base font-semibold bg-[var(--color-action)] text-[var(--color-on-action)] shadow-soft transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
        >
          {t('nav.settings')}
        </Link>
      )}
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
                    className="mt-1.5 text-sm text-[var(--color-error)] flex items-center gap-1.5"
                  >
                    <CircleAlert size={15} aria-hidden="true" className="shrink-0" />
                    {nameError}
                  </p>
                )}
              </div>
            )}

            {/* Server-level error */}
            {submitError && (
              <p
                role="alert"
                aria-live="polite"
                className="text-sm text-[var(--color-error)] flex items-center gap-1.5"
              >
                <CircleAlert size={15} aria-hidden="true" className="shrink-0" />
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
