'use client';

import { forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, className, id, ...props }, ref) {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]',
            'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:border-[var(--color-primary)]',
            'transition-colors transition-shadow duration-200',
            error && 'border-[var(--color-error)] focus-visible:ring-[var(--color-error)]/30',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-[var(--color-error)]" role="alert">{error}</p>}
      </div>
    );
  }
);
