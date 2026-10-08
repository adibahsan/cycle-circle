import { clsx } from 'clsx';

interface BadgeProps {
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  children: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({ variant, children, size = 'md', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full',
        {
          // success — active, published, delivered
          'bg-[var(--color-success-bg)] text-[var(--color-success)]':
            variant === 'success',
          // warning — pending, scheduled, grace period
          'bg-[var(--color-warning-bg)] text-[var(--color-warning)]':
            variant === 'warning',
          // danger — suspended, failed, lapsed
          'bg-[var(--color-danger-bg)] text-[var(--color-danger)]':
            variant === 'danger',
          // info — draft, informational
          'bg-[var(--color-info-bg)] text-[var(--color-info)]':
            variant === 'info',
          // neutral — free, archived
          'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)]':
            variant === 'neutral',
          'px-2 py-0.5 text-xs': size === 'sm',
          'px-2.5 py-1 text-sm': size === 'md',
        },
        className
      )}
    >
      {children}
    </span>
  );
}
