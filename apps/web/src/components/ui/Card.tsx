import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  hover?: boolean;
  style?: React.CSSProperties;
}

export function Card({ children, className, padding = 'md', hover, style }: CardProps) {
  return (
    <div
      style={style}
      className={twMerge(clsx(
        'rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-soft',
        {
          'p-3': padding === 'sm',
          'p-5': padding === 'md',
          'p-7': padding === 'lg',
          'hover:-translate-y-0.5 hover:border-[var(--color-border-strong)]/40 transition-[transform,border-color] duration-300 cursor-pointer': hover,
        },
        className
      ))}
    >
      {children}
    </div>
  );
}
