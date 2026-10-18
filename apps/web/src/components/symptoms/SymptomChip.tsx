'use client';

import { memo, useContext } from 'react';
import { motion } from 'motion/react';
import { Check, type LucideIcon } from 'lucide-react';
import type { CardTint } from '@/components/ui/tints';
import { cn } from '@/lib/cn';
import { SymptomTintContext } from './tints';
import { TINT_CLASSES } from '@/components/ui/tints';

interface SymptomChipProps {
  id: string;
  icon: LucideIcon;
  name: string;
  selected: boolean;
  onToggle: (id: string) => void;
  /** Defaults to the tint of the category card around the chip. */
  tint?: CardTint;
  /** `tile`: icon above the label. `adaptive`: a tile up to 2xl, a compact row (icon beside label) from 2xl, where every category shows at once. */
  layout?: 'tile' | 'adaptive';
}

/** An `aria-pressed` toggle for one symptom: a rounded tile with a drawn icon in a tinted badge, label below. */
export const SymptomChip = memo(function SymptomChip({ id, icon: Icon, name, selected, onToggle, tint, layout = 'tile' }: SymptomChipProps) {
  const contextTint = useContext(SymptomTintContext);
  const c = TINT_CLASSES[tint ?? contextTint];
  const row = layout === 'adaptive';
  return (
    <motion.button
      type="button"
      onClick={() => onToggle(id)}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cn(
        'relative flex flex-col items-center justify-center gap-1 p-1.5 w-full h-full min-h-[72px] rounded-2xl border-2 bg-[var(--color-bg-card)]',
        row
          ? 'md:gap-2 md:p-2.5 md:min-h-[88px] 2xl:flex-row 2xl:justify-start 2xl:gap-2.5 2xl:min-h-14 2xl:py-1.5 2xl:pl-2 2xl:pr-7 2xl:rounded-xl'
          : 'md:gap-2 md:p-2.5 md:min-h-[88px]',
        'transition-[border-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        c.ring,
        selected ? c.border : 'border-transparent shadow-soft',
      )}
      aria-pressed={selected}
      aria-label={name}
    >
      <span
        aria-hidden="true"
        className={cn(
          'w-8 h-8 shrink-0 rounded-full flex items-center justify-center transition-colors duration-200',
          row ? 'md:w-10 md:h-10 2xl:w-9 2xl:h-9' : 'md:w-10 md:h-10',
          selected ? c.solid : cn(c.surface, c.ink),
        )}
      >
        <Icon size={20} strokeWidth={2} aria-hidden="true" />
      </span>
      <span
        className={cn(
          'text-xs font-semibold text-center leading-snug break-words [overflow-wrap:anywhere] max-w-full line-clamp-2',
          row && '2xl:text-left 2xl:text-[13px]',
          selected ? c.ink : 'text-[var(--color-text-primary)]',
        )}
      >
        {name}
      </span>
      {selected && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center',
            row && '2xl:top-1/2 2xl:-translate-y-1/2 2xl:right-1.5',
            c.solid,
          )}
        >
          <Check size={12} strokeWidth={3} aria-hidden="true" />
        </span>
      )}
    </motion.button>
  );
});
