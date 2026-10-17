'use client';

import { CircleAlert, CircleCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PhoneFieldProps {
  id: string;
  /** 11-digit local number (`01XXXXXXXXX`); see toLocalPhone. */
  value: string;
  onChange: (local: string) => void;
  label: string;
  error?: string;
  /** Extra ids for aria-describedby (e.g. a consent notice under the field). */
  describedBy?: string;
  autoFocus?: boolean;
}

/** Bangladesh mobile number field shared by phone login and the add-phone / upgrade dialog. */
export function PhoneField({ id, value, onChange, label, error, describedBy, autoFocus }: PhoneFieldProps) {
  const { t } = useTranslation();
  const errorId = `${id}-error`;
  const described = [error ? errorId : null, describedBy].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)] select-none">
          +88
        </span>
        <input
          id={id}
          aria-describedby={described}
          aria-invalid={error ? true : undefined}
          type="tel"
          inputMode="numeric"
          name="phone"
          autoComplete="tel"
          spellCheck={false}
          autoFocus={autoFocus}
          placeholder={t('auth.phonePlaceholder')}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, '').slice(0, 11))}
          maxLength={11}
          className={`w-full pl-14 pr-10 py-3.5 rounded-xl border bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:border-[var(--color-primary)] transition-colors duration-200 text-base tracking-widest font-medium ${
            error ? 'border-[var(--color-error)] focus-visible:ring-[var(--color-error)]/30' : 'border-[var(--color-border)]'
          }`}
        />
        {value.length === 11 && !error && (
          <CircleCheck size={18} aria-hidden="true" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-primary)]" />
        )}
      </div>
      <p id={errorId} role="alert" aria-live="polite" className="empty:hidden mt-1.5 text-sm text-[var(--color-error)] flex items-center gap-1.5">
        {error && <><CircleAlert size={15} aria-hidden="true" className="shrink-0" />{error}</>}
      </p>
    </div>
  );
}
