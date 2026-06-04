'use client'

import React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { CycleBloom } from './CycleBloom'
import { FloralAccent } from './FloralAccent'
import { Blob } from './Blob'

type IllustrationVariant = 'profiles' | 'logs' | 'articles' | 'feedback' | 'generic'

interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
  illustration?: IllustrationVariant
  animated?: boolean
  className?: string
}

function IllustrationArt({
  variant,
  animated,
}: {
  variant: IllustrationVariant
  animated: boolean
}) {
  switch (variant) {
    case 'profiles':
      return <CycleBloom phase="follicular" animated={animated} size={120} />
    case 'logs':
      return <FloralAccent animated={animated} size={120} />
    case 'articles':
      return (
        <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
          <Blob tone="lavender" animated={animated} size={120} />
          <FloralAccent
            animated={animated}
            size={56}
            className="absolute inset-0 m-auto"
          />
        </div>
      )
    case 'feedback':
      return <Blob tone="coral" animated={animated} size={120} />
    case 'generic':
    default:
      return <Blob tone="rose" animated={animated} size={120} />
  }
}

/**
 * EmptyState — composable empty-state block with an idle-animated illustration,
 * title, optional description, and optional action slot.
 */
export function EmptyState({
  title,
  description,
  action,
  illustration = 'generic',
  animated = true,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={twMerge(
        clsx(
          'flex flex-col items-center justify-center gap-4 py-12 px-6 text-center',
          className
        )
      )}
    >
      {/* Illustration — decorative, aria-hidden */}
      <div
        aria-hidden="true"
        className={clsx('flex items-center justify-center', animated ? 'animate-float' : undefined)}
      >
        <IllustrationArt variant={illustration} animated={animated} />
      </div>

      {/* Text content — readable */}
      <div className="flex flex-col items-center gap-2 max-w-xs">
        <p className="text-base font-semibold text-[var(--color-text-primary)]">{title}</p>
        {description && (
          <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>
        )}
      </div>

      {/* Optional action */}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
