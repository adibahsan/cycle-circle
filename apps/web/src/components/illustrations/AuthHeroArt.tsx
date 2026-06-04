'use client'

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Blob } from './Blob'
import { FloralAccent } from './FloralAccent'

interface AuthHeroArtProps {
  className?: string
  animated?: boolean
}

// 7 sparkle circles: [cx%, cy%, size, delayClass]
const SPARKLES: Array<{ x: string; y: string; r: number; delay: string; color: string }> = [
  { x: '15%', y: '20%', r: 5, delay: '',               color: 'var(--color-primary)' },
  { x: '80%', y: '12%', r: 4, delay: 'anim-delay-200', color: 'var(--color-secondary)' },
  { x: '88%', y: '55%', r: 6, delay: 'anim-delay-100', color: 'var(--color-accent)' },
  { x: '70%', y: '82%', r: 4, delay: 'anim-delay-300', color: 'var(--color-fertile)' },
  { x: '22%', y: '78%', r: 5, delay: 'anim-delay-500', color: 'var(--color-primary)' },
  { x: '50%', y: '10%', r: 3, delay: 'anim-delay-200', color: 'var(--color-secondary)' },
  { x: '10%', y: '50%', r: 4, delay: 'anim-delay-300', color: 'var(--color-accent)' },
]

/**
 * AuthHeroArt — branding-panel composition: layered blobs, sparkle circles,
 * and a centered FloralAccent. Meant for the decorative half of an auth split-screen.
 */
export function AuthHeroArt({ className, animated = true }: AuthHeroArtProps) {
  return (
    <div
      aria-hidden="true"
      className={twMerge(clsx('relative w-full h-full overflow-hidden', className))}
    >
      {/* Large rose blob — center-left anchor */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Blob tone="rose" animated={animated} size="75%" />
      </div>

      {/* Smaller lavender blob — top-right */}
      <div className="absolute -top-8 -right-8">
        <Blob tone="lavender" animated={animated} size="45%" />
      </div>

      {/* Smaller coral blob — bottom-left */}
      <div className="absolute -bottom-8 -left-8">
        <Blob tone="coral" animated={animated} size="38%" />
      </div>

      {/* Sparkle circles */}
      {SPARKLES.map((s, i) => (
        <span
          key={i}
          className={clsx(animated ? ['animate-twinkle', s.delay] : undefined)}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: s.r * 2,
            height: s.r * 2,
            borderRadius: '50%',
            backgroundColor: s.color,
            opacity: 0.65,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}

      {/* Centered FloralAccent */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <FloralAccent animated={animated} size={96} entrance={animated} />
      </div>
    </div>
  )
}
