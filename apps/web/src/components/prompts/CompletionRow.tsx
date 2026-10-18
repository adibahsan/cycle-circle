'use client'

import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ProfileCompletionStatus } from '@/lib/profile-completion'
import { showCompletionRow } from '@/lib/prompt-rules'
import '@vesta/shared/utils/i18n'

export const OPEN_COMPLETION_EVENT = 'vesta:open-completion'

/** The one compact dashboard row for profile completion; hidden at 100%. Opens the layout's completion pop-up. */
export function CompletionRow({ status, variant = 'row' }: { status: ProfileCompletionStatus | null | undefined; variant?: 'row' | 'pill' }) {
  const { t } = useTranslation()
  if (!status || !showCompletionRow(status)) return null
  return (
    <button
      type="button"
      data-testid="completion-row"
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_COMPLETION_EVENT))}
      aria-label={t('profileCompletion.headerAriaLabel', { percent: status.percent })}
      className={
        (variant === 'pill'
          ? 'inline-flex min-h-11 w-full sm:w-auto items-center gap-2 rounded-full px-4 '
          : 'w-full flex min-h-11 items-center gap-3 px-4 py-2.5 rounded-xl ') +
        'bg-tint-lavender border border-transparent text-left hover:border-[var(--goal-accent)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]'
      }
    >
      <span className="text-sm font-bold tabular-nums text-accent-lavender" aria-hidden="true">
        {status.percent}%
      </span>
      <span className="flex-1 min-w-0 truncate text-sm font-medium text-[var(--color-text-primary)]">{t('profileCompletion.title')}</span>
      <ChevronRight size={16} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
    </button>
  )
}
