/**
 * @file motion.ts
 * Centralised animation presets for the Vesta web app.
 *
 * All surfaces should reach for these presets so the app animates consistently.
 * The `useMotionSafe` hook handles `prefers-reduced-motion` in one place.
 *
 * @example
 * // Staggered list
 * <motion.ul variants={staggerContainer} initial="hidden" animate="visible">
 *   {items.map(i => (
 *     <motion.li key={i.id} variants={staggerItem}>{i.label}</motion.li>
 *   ))}
 * </motion.ul>
 *
 * @example
 * // Reduced-motion-aware card
 * const { variants, props } = useMotionSafe()
 * <motion.div variants={variants(fadeInUp)} {...props(cardHover)} />
 *
 * @example
 * // Success pop
 * <motion.div variants={variants(popIn)} initial="hidden" animate="visible" />
 */

import { useReducedMotion } from 'motion/react'
import type { Variants, Transition } from 'motion/react'

// ─── Transition Presets ───────────────────────────────────────────────────────

/**
 * Gentle spring transition matching the existing dashboard feel.
 * Use for interactive elements where a physical, snappy response is desired
 * (card hover, modal entry, cycle-day number).
 */
export const springSoft: Transition = {
  type: 'spring',
  stiffness: 220,
  damping: 24,
}

/**
 * Ease-based transition using the design system cubic-bezier.
 * Prefer for page-level entrances and content reveals where a spring
 * would feel too bouncy.
 */
export const easeSoft: Transition = {
  duration: 0.45,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
}

// ─── Variant Presets ─────────────────────────────────────────────────────────

/**
 * Fade + rise entrance for standalone sections, hero cards, and modals.
 * Pairs well with `initial="hidden" animate="visible"`.
 */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: easeSoft,
  },
}

/**
 * Parent container that staggers its direct `staggerItem` children.
 * Apply `initial="hidden" animate="visible"` to this element.
 */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
}

/**
 * Individual child item used inside a `staggerContainer`.
 * Uses `springSoft` so each card/row pops in with a physical feel.
 */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springSoft,
  },
}

/**
 * Motion props for card hover/tap liveliness.
 * Spread directly onto a `<motion.div>` — glow is handled in CSS via `.shadow-glow`.
 *
 * @example
 * <motion.div {...cardHover}>…</motion.div>
 */
export const cardHover = {
  whileHover: { y: -4 },
  whileTap: { scale: 0.98 },
  transition: springSoft,
} as const

/**
 * Pop-in variant for success/celebration moments and the cycle-day number.
 * Scales from 60 % opacity-0 → full size, driven by `springSoft`.
 */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: springSoft,
  },
}

// ─── useMotionSafe Hook ───────────────────────────────────────────────────────

/**
 * Return type for `useMotionSafe`.
 */
export interface MotionSafeHelpers {
  /** `true` when the user has requested reduced motion. */
  reduced: boolean

  /**
   * Wraps a `Variants` object.
   * Returns `undefined` when reduced motion is active so that
   * `<motion.div variants={variants(fadeInUp)} />` silently no-ops.
   */
  variants: (v: Variants) => Variants | undefined

  /**
   * Wraps arbitrary motion props (e.g. `cardHover`, `whileHover`, `animate`).
   * Returns an empty object `{}` when reduced motion is active, effectively
   * disabling all motion on the element without conditional JSX.
   *
   * @example
   * <motion.div {...props(cardHover)} />
   */
  props: <T extends object>(p: T) => T | Record<string, never>
}

/**
 * Hook that reads `prefers-reduced-motion` and returns ergonomic helpers
 * for opting out of animations centrally.
 *
 * Must be called from a client component (the hook uses React internals).
 *
 * @example
 * const { reduced, variants, props } = useMotionSafe()
 * // reduced  → boolean flag for custom logic
 * // variants → pass a Variants object; returns undefined when motion is off
 * // props    → pass motion prop objects; returns {} when motion is off
 */
export function useMotionSafe(): MotionSafeHelpers {
  const reduced = useReducedMotion() ?? false

  return {
    reduced,
    variants: (v: Variants) => (reduced ? undefined : v),
    props: <T extends object>(p: T): T | Record<string, never> =>
      reduced ? {} : p,
  }
}
