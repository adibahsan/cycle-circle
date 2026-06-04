'use client'

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { motion } from 'motion/react'
import { popIn } from '@/lib/motion'
import { useMotionSafe } from '@/lib/motion'

interface FloralAccentProps {
  className?: string
  animated?: boolean
  size?: number | string
  /** Play the popIn entrance. Defaults to `animated`. */
  entrance?: boolean
}

const PETAL_DELAYS = ['', 'anim-delay-100', 'anim-delay-200', 'anim-delay-300', 'anim-delay-500', 'anim-delay-200']

// 6 petals at 0°, 60°, 120°, 180°, 240°, 300°
const PETAL_ANGLES = [0, 60, 120, 180, 240, 300]

/**
 * FloralAccent — 6 stroke-based rounded petals swaying around a center dot.
 * Stroke colour inherits from `currentColor`; tint via Tailwind's `text-*` on the parent.
 */
export function FloralAccent({ className, animated = true, size = 120, entrance }: FloralAccentProps) {
  const { reduced, variants } = useMotionSafe()
  const showMotion = animated && !reduced
  const showEntrance = (entrance ?? animated) && showMotion

  const WrapperEl = showEntrance ? motion.svg : 'svg'
  const wrapperProps = showEntrance
    ? {
        variants: variants(popIn),
        initial: 'hidden' as const,
        animate: 'visible' as const,
      }
    : {}

  return (
    // @ts-expect-error – motion.svg and plain svg share the same HTML attrs
    <WrapperEl
      viewBox="0 0 120 120"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...({ focusable: 'false' } as React.SVGAttributes<SVGSVGElement>)}
      className={twMerge(clsx('text-[var(--color-primary)] overflow-visible', className))}
      {...wrapperProps}
    >
      {/* Petals */}
      {PETAL_ANGLES.map((angle, i) => (
        <ellipse
          key={angle}
          cx={60}
          cy={60}
          rx={10}
          ry={22}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.75}
          transform={`rotate(${angle} 60 60) translate(0 -22)`}
          className={animated ? clsx('animate-sway', PETAL_DELAYS[i]) : undefined}
        />
      ))}

      {/* Center dot */}
      <circle cx={60} cy={60} r={6} fill="currentColor" opacity={0.9} />
    </WrapperEl>
  )
}
