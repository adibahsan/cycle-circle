'use client';

import { memo, useContext } from 'react';
import { motion } from 'motion/react';
import { Check, type LucideIcon } from 'lucide-react';
import type { CardTint } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import { SymptomTintContext, TINT_CLASSES } from './tints';

interface SymptomChipProps {
  id: string;
  icon: LucideIcon;
  name: string;
  selected: boolean;
  onToggle: (id: string) => void;
  /** Defaults to the tint of the category card around the chip. */
  tint?: CardTint;
}

/** An `aria-pressed` toggle for one symptom: a rounded tile with a drawn icon in a tinted badge, label below. */
export const SymptomChip = memo(function SymptomChip({ id, icon: Icon, name, selected, onToggle, tint }: SymptomChipProps) {
  const contextTint = useContext(SymptomTintContext);
  const c = TINT_CLASSES[tint ?? contextTint];
  return (
    <motion.button
      type="button"
      onClick={() => onToggle(id)}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cn(
        'relative flex flex-col items-center justify-center gap-2 p-2.5 w-full h-full min-h-[88px] rounded-2xl border-2 bg-[var(--color-bg-card)]',
        'transition-[border-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        c.ring,
        selected ? c.border : 'border-transparent shadow-soft',
      )}
      aria-pressed={selected}
      aria-label={name}
    >
      <span
        aria-hidden="true"
        className={cn('w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200', selected ? c.solid : cn(c.surface, c.ink))}
      >
        <Icon size={20} strokeWidth={2} aria-hidden="true" />
      </span>
      <span
        className={cn(
          'text-xs font-semibold text-center leading-snug break-words [overflow-wrap:anywhere] max-w-full',
          selected ? c.ink : 'text-[var(--color-text-primary)]',
        )}
      >
        {name}
      </span>
      {selected && (
        <span aria-hidden="true" className={cn('absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center', c.solid)}>
          <Check size={12} strokeWidth={3} aria-hidden="true" />
        </span>
      )}
    </motion.button>
  );
});
