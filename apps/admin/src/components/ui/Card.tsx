import Link from 'next/link';
import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  /** Lift/glow on hover. Visual only — pass `href` to make the card navigable. */
  hover?: boolean;
  /** Renders the card as a link (keyboard focusable) instead of a plain div. */
  href?: string;
  'aria-label'?: string;
}

export function Card({ children, className, padding = 'md', hover, href, 'aria-label': ariaLabel }: CardProps) {
  const classes = clsx(
    'rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-soft',
    {
      'p-3': padding === 'sm',
      'p-5': padding === 'md',
      'p-7': padding === 'lg',
      'glass-hover hover:shadow-glow hover:-translate-y-0.5 transition-shadow transition-transform duration-300':
        hover || href,
      'block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]': href,
    },
    className
  );

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <div aria-label={ariaLabel} className={classes}>
      {children}
    </div>
  );
}
