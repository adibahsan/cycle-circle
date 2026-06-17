'use client';

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function Button({ variant = 'primary', size = 'md', fullWidth, className, children, ...props }: ButtonProps) {
  return (
    <button
      className={twMerge(clsx(
        'inline-flex items-center justify-center font-semibold rounded-xl transition-[color,background-color,border-color,box-shadow,transform] duration-200 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]',
        {
          'bg-[var(--goal-accent)] text-white hover:opacity-90 shadow-soft': variant === 'primary',
          'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]': variant === 'secondary',
          'border-2 border-[var(--goal-accent)] text-[var(--goal-accent)] hover:bg-[var(--goal-accent)] hover:text-white': variant === 'outline',
          'text-[var(--color-text-secondary)] hover:text-[var(--goal-accent)] hover:bg-[var(--color-bg-secondary)]': variant === 'ghost',
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-5 py-2.5 text-base': size === 'md',
          'px-7 py-3.5 text-lg': size === 'lg',
          'w-full': fullWidth,
        },
        className
      ))}
      {...props}
    >
      {children}
    </button>
  );
}
