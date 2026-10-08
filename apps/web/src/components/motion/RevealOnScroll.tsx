import type { CSSProperties, ReactNode } from 'react';
import './reveal.css';

interface RevealOnScrollProps {
  children: ReactNode;
  className?: string;
  /** Upward drift distance in px (CSS-only enhancement; content is visible without it). */
  y?: number;
}

export function RevealOnScroll({ children, className, y = 24 }: RevealOnScrollProps) {
  return (
    <div
      className={['reveal-on-scroll', className].filter(Boolean).join(' ')}
      style={{ '--reveal-y': `${y}px` } as CSSProperties}
    >
      {children}
    </div>
  );
}
