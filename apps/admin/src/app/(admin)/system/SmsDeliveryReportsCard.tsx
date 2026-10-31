'use client'

import { useState, useTransition } from 'react'
import { MailCheck } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { setSmsDeliveryReportsAction } from '@/app/actions/system-actions'

export function SmsDeliveryReportsCard({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [pending, start] = useTransition()
  const toast = useToast()

  function toggle() {
    const next = !enabled
    start(async () => {
      const res = await setSmsDeliveryReportsAction(next)
      if (res.ok) {
        setEnabled(res.enabled)
        toast.success(`SMS delivery reports turned ${res.enabled ? 'on' : 'off'}`)
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--color-text-primary)]">
            <MailCheck size={16} aria-hidden="true" />
            SMS delivery reports
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            When on, each campaign message asks BDApps for delivery reports, and delivered and failed
            counts fill in as they arrive. When off, campaigns show &ldquo;delivery reports off&rdquo;
            instead of counts.
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Keep this off unless the BDApps SMS plan has delivery reports enabled; otherwise BDApps
            rejects every send. Applies to messages sent after the change.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="SMS delivery reports"
          disabled={pending}
          onClick={toggle}
          className={[
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent',
            'transition-colors focus-visible:outline-none focus-visible:ring-2',
            'focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            enabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border-strong)]',
          ].join(' ')}
        >
          <span
            aria-hidden="true"
            className={[
              'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
              enabled ? 'translate-x-5' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
      </div>
    </Card>
  )
}
