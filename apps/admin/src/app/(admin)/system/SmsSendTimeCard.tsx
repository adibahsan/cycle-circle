'use client'

import { useState, useTransition } from 'react'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { setSmsSendTimeAction } from '@/app/actions/system-actions'

/** `HH:MM` Bangladesh time as `HH:MM` UTC (Bangladesh is UTC+6, no DST). */
function toUtc(time: string) {
  const [h = 0, m = 0] = time.split(':').map(Number)
  return `${String((h + 18) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function SmsSendTimeCard({ initialTime }: { initialTime: string }) {
  const [saved, setSaved] = useState(initialTime)
  const [value, setValue] = useState(initialTime)
  const [pending, start] = useTransition()
  const toast = useToast()
  const dirty = value !== saved && value !== ''

  function save() {
    start(async () => {
      const res = await setSmsSendTimeAction(value)
      if (res.ok) {
        setSaved(res.time)
        toast.success(`SMS send time set to ${res.time} Bangladesh time`)
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--color-text-primary)]">
            <Clock size={16} aria-hidden="true" />
            SMS daily send time
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Every campaign message goes out at this time on its day. A message whose day passes
            unsent is marked missed and is never sent late.
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Current: <span className="tabular-nums">{saved}</span> Bangladesh time (
            <span className="tabular-nums">{toUtc(saved)}</span> UTC). The server checks every 15
            minutes.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label htmlFor="sms-send-time" className="mb-1.5 block text-sm font-medium text-[var(--color-text-secondary)]">
              Send time (Bangladesh)
            </label>
            <input
              id="sms-send-time"
              name="smsSendTime"
              type="time"
              step={60}
              required
              autoComplete="off"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 tabular-nums text-[var(--color-text-primary)] transition-colors focus-visible:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
            />
          </div>
          <Button size="sm" onClick={save} loading={pending} disabled={!dirty || pending}>
            Save
          </Button>
        </div>
      </div>
    </Card>
  )
}
