/** The six pastel tints from globals.css (`--color-tint-*` surfaces, `--color-accent-*` ink). */
export const CARD_TINTS = ['peach', 'pink', 'mint', 'lavender', 'sky', 'sage'] as const;
export type CardTint = (typeof CARD_TINTS)[number];

/** Literal class strings per tint, so Tailwind can see them. The one tint → class map. */
export interface TintClasses {
  /** Pastel surface. */
  surface: string;
  /** Accent ink (passes 4.5:1 on the surface and on the card). */
  ink: string;
  /** Icon badge on a neutral page: pastel surface with accent ink. */
  badge: string;
  /** Solid accent fill with tint-coloured text: count pills and selected badges. */
  solid: string;
  border: string;
  ring: string;
}

export const TINT_CLASSES: Record<CardTint, TintClasses> = {
  peach: { surface: 'bg-tint-peach', ink: 'text-accent-peach', badge: 'bg-tint-peach text-accent-peach', solid: 'bg-accent-peach text-tint-peach', border: 'border-accent-peach', ring: 'focus-visible:ring-accent-peach' },
  pink: { surface: 'bg-tint-pink', ink: 'text-accent-pink', badge: 'bg-tint-pink text-accent-pink', solid: 'bg-accent-pink text-tint-pink', border: 'border-accent-pink', ring: 'focus-visible:ring-accent-pink' },
  mint: { surface: 'bg-tint-mint', ink: 'text-accent-mint', badge: 'bg-tint-mint text-accent-mint', solid: 'bg-accent-mint text-tint-mint', border: 'border-accent-mint', ring: 'focus-visible:ring-accent-mint' },
  lavender: { surface: 'bg-tint-lavender', ink: 'text-accent-lavender', badge: 'bg-tint-lavender text-accent-lavender', solid: 'bg-accent-lavender text-tint-lavender', border: 'border-accent-lavender', ring: 'focus-visible:ring-accent-lavender' },
  sky: { surface: 'bg-tint-sky', ink: 'text-accent-sky', badge: 'bg-tint-sky text-accent-sky', solid: 'bg-accent-sky text-tint-sky', border: 'border-accent-sky', ring: 'focus-visible:ring-accent-sky' },
  sage: { surface: 'bg-tint-sage', ink: 'text-accent-sage', badge: 'bg-tint-sage text-accent-sage', solid: 'bg-accent-sage text-tint-sage', border: 'border-accent-sage', ring: 'focus-visible:ring-accent-sage' },
};
