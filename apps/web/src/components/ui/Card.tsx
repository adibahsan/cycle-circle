import { cn } from '@/lib/cn';

/** The six pastel tints from globals.css (`--color-tint-*` / `--color-accent-*`). */
export const CARD_TINTS = ['peach', 'pink', 'mint', 'lavender', 'sky', 'sage'] as const;
export type CardTint = (typeof CARD_TINTS)[number];
/** `panel`: 28px white panel with the neutral panel shadow. A tint: 28px pastel surface, flat. */
export type CardTone = 'panel' | CardTint;

// Full literal class strings so Tailwind can see them.
const TONE_CLASSES: Record<CardTone, string> = {
  panel: 'rounded-panel bg-[var(--color-bg-card)] border border-transparent dark:border-[var(--color-border)] shadow-panel',
  peach: 'rounded-panel bg-tint-peach',
  pink: 'rounded-panel bg-tint-pink',
  mint: 'rounded-panel bg-tint-mint',
  lavender: 'rounded-panel bg-tint-lavender',
  sky: 'rounded-panel bg-tint-sky',
  sage: 'rounded-panel bg-tint-sage',
};

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  /** Omit for the standard bordered card. */
  tone?: CardTone;
  hover?: boolean;
  style?: React.CSSProperties;
}

export function Card({ children, className, padding = 'md', tone, hover, style }: CardProps) {
  return (
    <div
      style={style}
      className={cn(
        tone
          ? TONE_CLASSES[tone]
          : 'rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-soft',
        {
          'p-3': padding === 'sm',
          'p-5': padding === 'md',
          'p-7': padding === 'lg',
          'hover:-translate-y-0.5 hover:border-[var(--color-border-strong)]/40 transition-[transform,border-color] duration-300 cursor-pointer': hover,
        },
        className
      )}
    >
      {children}
    </div>
  );
}
