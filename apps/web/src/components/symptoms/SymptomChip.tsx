'use client';

import { memo } from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

interface SymptomChipProps {
  id: string;
  icon: LucideIcon;
  name: string;
  selected: boolean;
  onToggle: (id: string) => void;
}

/** An `aria-pressed` toggle for one symptom: drawn icon in a tinted badge, label below. */
export const SymptomChip = memo(function SymptomChip({ id, icon: Icon, name, selected, onToggle }: SymptomChipProps) {
  return (
    <motion.button
      type="button"
      onClick={() => onToggle(id)}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="flex flex-col items-center justify-center gap-2 p-2.5 rounded-2xl border transition-colors duration-200 w-full h-full min-h-[88px] relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
      style={{
        background: selected ? 'color-mix(in srgb, var(--goal-accent) 14%, transparent)' : 'var(--color-bg-card)',
        borderColor: selected ? 'var(--goal-accent)' : 'var(--color-border)',
      }}
      aria-pressed={selected}
      aria-label={name}
    >
      <span
        aria-hidden="true"
        className="w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-200"
        style={{
          background: selected
            ? 'color-mix(in srgb, var(--goal-accent) 22%, transparent)'
            : 'var(--color-bg-secondary)',
          color: selected ? 'var(--goal-accent)' : 'var(--color-text-secondary)',
        }}
      >
        <Icon size={18} strokeWidth={2} aria-hidden="true" />
      </span>
      <span
        className="text-xs font-semibold text-center leading-snug break-words [overflow-wrap:anywhere] max-w-full"
        style={{ color: selected ? 'var(--goal-accent)' : 'var(--color-text-secondary)' }}
      >
        {name}
      </span>
      {selected && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: 'var(--goal-accent)' }}
        >
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
            <path d="M1.5 4l2 2 3-3" stroke="var(--color-on-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </motion.button>
  );
});
