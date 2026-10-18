import { cn } from '@/lib/cn';
import { TINT_CLASSES, type CardTint } from './tints';

export { CARD_TINTS, type CardTint } from './tints';
/** `panel`: 28px white panel with the neutral panel shadow. A tint: 28px pastel surface, flat. */
export type CardTone = 'panel' | CardTint;

const PANEL = 'rounded-panel bg-[var(--color-bg-card)] border border-transparent shadow-panel';
const toneClasses = (tone: CardTone) => (tone === 'panel' ? PANEL : `rounded-panel ${TINT_CLASSES[tone].surface}`);

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
          ? toneClasses(tone)
          : 'rounded-lg bg-[var(--color-bg-card)] border border-[var(--color-border)] dark:border-transparent shadow-soft',
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
