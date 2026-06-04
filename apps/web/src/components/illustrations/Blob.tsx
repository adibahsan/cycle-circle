'use client'

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

type BlobTone = 'rose' | 'lavender' | 'coral' | 'teal'

interface BlobProps {
  className?: string
  animated?: boolean
  size?: number | string
  tone?: BlobTone
}

const toneVar: Record<BlobTone, string> = {
  rose: 'var(--color-primary)',
  lavender: 'var(--color-secondary)',
  coral: 'var(--color-accent)',
  teal: 'var(--color-fertile)',
}

/**
 * Blob — 2–3 layered organic blob paths drifting / floating at staggered speeds.
 * Purely decorative; aria-hidden, no focusable content.
 */
export function Blob({ className, animated = true, size = 200, tone = 'rose' }: BlobProps) {
  const color = toneVar[tone]

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...({ focusable: 'false' } as React.SVGAttributes<SVGSVGElement>)}
      className={twMerge(clsx('overflow-visible', className))}
    >
      {/* blob0 — largest, slowest drift */}
      <path
        d="M100 30 C140 20, 175 55, 170 100 C165 145, 130 175, 100 170 C70 165, 30 140, 25 100 C20 60, 60 40, 100 30Z"
        fill={color}
        style={{ opacity: 0.3 }}
        className={animated ? 'animate-drift' : undefined}
      />

      {/* blob1 — medium, floats */}
      <path
        d="M100 45 C128 38, 158 62, 155 95 C152 128, 126 155, 100 152 C74 149, 44 128, 42 95 C40 62, 72 52, 100 45Z"
        fill={color}
        style={{ opacity: 0.2 }}
        className={animated ? 'animate-float anim-delay-200' : undefined}
      />

      {/* blob2 — smallest, fastest shimmer */}
      <path
        d="M100 58 C120 53, 142 70, 140 95 C138 120, 118 140, 100 138 C82 136, 60 120, 58 95 C56 70, 80 63, 100 58Z"
        fill={color}
        style={{ opacity: 0.15 }}
        className={animated ? 'animate-drift anim-delay-500' : undefined}
      />
    </svg>
  )
}
