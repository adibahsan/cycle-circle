'use client';

import { createContext } from 'react';
import type { CardTint } from '@/components/ui/Card';

/** Literal class strings per pastel tint, so Tailwind can see them. */
export interface TintClasses {
  /** Pastel surface. */
  surface: string;
  /** Accent ink (passes 4.5:1 on the surface and on the card). */
  ink: string;
  /** Solid accent fill with tint-coloured text: count pills and selected badges. */
  solid: string;
  border: string;
  ring: string;
}

export const TINT_CLASSES: Record<CardTint, TintClasses> = {
  peach: { surface: 'bg-tint-peach', ink: 'text-accent-peach', solid: 'bg-accent-peach text-tint-peach', border: 'border-accent-peach', ring: 'focus-visible:ring-accent-peach' },
  pink: { surface: 'bg-tint-pink', ink: 'text-accent-pink', solid: 'bg-accent-pink text-tint-pink', border: 'border-accent-pink', ring: 'focus-visible:ring-accent-pink' },
  mint: { surface: 'bg-tint-mint', ink: 'text-accent-mint', solid: 'bg-accent-mint text-tint-mint', border: 'border-accent-mint', ring: 'focus-visible:ring-accent-mint' },
  lavender: { surface: 'bg-tint-lavender', ink: 'text-accent-lavender', solid: 'bg-accent-lavender text-tint-lavender', border: 'border-accent-lavender', ring: 'focus-visible:ring-accent-lavender' },
  sky: { surface: 'bg-tint-sky', ink: 'text-accent-sky', solid: 'bg-accent-sky text-tint-sky', border: 'border-accent-sky', ring: 'focus-visible:ring-accent-sky' },
  sage: { surface: 'bg-tint-sage', ink: 'text-accent-sage', solid: 'bg-accent-sage text-tint-sage', border: 'border-accent-sage', ring: 'focus-visible:ring-accent-sage' },
};

/** The tint of the category card a chip sits on; chips outside a category card use pink. */
export const SymptomTintContext = createContext<CardTint>('pink');
