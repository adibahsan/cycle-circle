import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  hover?: boolean;
}

export function Card({ children, className, padding = 'md', hover }: CardProps) {
  return (
    <div
      className={twMerge(clsx(
        'rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-soft',
        {
          'p-3': padding === 'sm',
          'p-5': padding === 'md',
          'p-7': padding === 'lg',
          'glass-hover hover:shadow-glow hover:-translate-y-0.5 transition-shadow transition-transform duration-300 cursor-pointer': hover,
        },
        className
      ))}
    >
      {children}
    </div>
  );
}
