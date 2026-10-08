'use client';

import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center font-semibold rounded-full transition-colors duration-200 active:scale-[0.97] cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]',
        {
          'bg-[var(--color-action)] text-[var(--color-on-action)] hover:opacity-90 shadow-soft':
            variant === 'primary',
          'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]':
            variant === 'secondary',
          'border-2 border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-[var(--color-on-action)]':
            variant === 'outline',
          'text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg-secondary)]':
            variant === 'ghost',
          'bg-[var(--color-error)] text-[var(--color-on-action)] hover:opacity-90 shadow-soft':
            variant === 'danger',
          'px-3 py-1.5 text-sm gap-1.5': size === 'sm',
          'px-5 py-2.5 text-base gap-2': size === 'md',
          'px-7 py-3.5 text-lg gap-2.5': size === 'lg',
          'w-full': fullWidth,
          'opacity-60 cursor-not-allowed active:scale-100': disabled || loading,
        },
        className
      )}
      {...props}
    >
      {loading && (
        <svg
          className={clsx('animate-spin shrink-0', {
            'h-3.5 w-3.5': size === 'sm',
            'h-4 w-4': size === 'md',
            'h-5 w-5': size === 'lg',
          })}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
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
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
