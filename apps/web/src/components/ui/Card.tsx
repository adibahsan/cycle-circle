import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getPhaseColor } from '@vesta/shared/utils/cycle-utils';
import type { CyclePhase } from '@vesta/shared/types';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
  hover?: boolean;
  phase?: CyclePhase;
  style?: React.CSSProperties;
}

export function Card({ children, className, padding = 'md', hover, phase, style }: CardProps) {
  const phaseStyle: React.CSSProperties = phase
    ? { ['--phase-color' as string]: getPhaseColor(phase) }
    : {};

  return (
    <div
      style={{ ...phaseStyle, ...style }}
      className={twMerge(clsx(
        'rounded-2xl bg-[var(--color-bg-card)] border shadow-soft',
        phase ? 'border-phase bg-phase-tint' : 'border-[var(--color-border)]',
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
