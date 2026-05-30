'use client'

import { RefetchButton } from '@/components/ui/RefetchButton'

interface AdminPageHeaderProps {
  title: string
  description?: string
  tags: string[]
  actions?: React.ReactNode
}

export function AdminPageHeader({ title, description, tags, actions }: AdminPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <RefetchButton tags={tags} />
      </div>
    </div>
  )
}
