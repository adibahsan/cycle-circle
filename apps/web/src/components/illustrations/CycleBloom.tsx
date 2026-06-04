'use client'

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { motion } from 'motion/react'
import { staggerContainer, staggerItem } from '@/lib/motion'
import { useMotionSafe } from '@/lib/motion'
import { getPhaseColor } from '@vesta/shared/utils/cycle-utils'
import type { CyclePhase } from '@vesta/shared/types'

interface CycleBloomProps {
  className?: string
  animated?: boolean
  size?: number | string
  phase?: CyclePhase
}

// 8 petals, 45° apart
const PETAL_ANGLES = Array.from({ length: 8 }, (_, i) => i * 45)

/**
 * CycleBloom — 8 petals that bloom open in a staggered radial reveal,
 * then gently breathe idle. Phase prop drives petal fill colour.
 */
export function CycleBloom({ className, animated = true, size = 160, phase }: CycleBloomProps) {
  const { reduced, variants } = useMotionSafe()
  const showMotion = animated && !reduced

  const petalFill = phase ? getPhaseColor(phase) : 'var(--color-primary)'

  // Wrapper breathes when animated
  const wrapperClass = twMerge(
    clsx('overflow-visible', animated ? 'animate-breathe' : undefined, className)
  )

  if (showMotion) {
    return (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <motion.svg
        viewBox="0 0 160 160"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable={"false" as any}
        className={wrapperClass}
        variants={variants(staggerContainer)}
        initial="hidden"
        animate="visible"
      >
        {PETAL_ANGLES.map((angle) => (
          <motion.ellipse
            key={angle}
            cx={80}
            cy={80}
            rx={11}
            ry={30}
            fill={petalFill}
            opacity={0.82}
            transform={`rotate(${angle} 80 80) translate(0 -30)`}
            variants={variants(staggerItem)}
          />
        ))}

        {/* Center circle */}
        <motion.circle
          cx={80}
          cy={80}
          r={12}
          fill={petalFill}
          variants={variants(staggerItem)}
        />
      </motion.svg>
    )
  }

  // Static / reduced-motion fallback
  return (
    <svg
      viewBox="0 0 160 160"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...({ focusable: 'false' } as React.SVGAttributes<SVGSVGElement>)}
      className={wrapperClass}
    >
      {PETAL_ANGLES.map((angle) => (
        <ellipse
          key={angle}
          cx={80}
          cy={80}
          rx={11}
          ry={30}
          fill={petalFill}
          opacity={0.82}
          transform={`rotate(${angle} 80 80) translate(0 -30)`}
        />
      ))}
      <circle cx={80} cy={80} r={12} fill={petalFill} />
    </svg>
  )
}
