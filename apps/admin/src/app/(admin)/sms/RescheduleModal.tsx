'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { rescheduleSmsMessage } from '@/app/actions/sms-actions'
import { dayText, type SmsMessage } from './sms-shared'

/** Move one unsent campaign message to another Bangladesh day. */
export function RescheduleModal({
  target,
  onClose,
  onSaved,
}: {
  target: SmsMessage | null
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [day, setDay] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (target) setDay(dayText(target.day))
  }, [target])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!target) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      toast.error('Pick a day.')
      return
    }
    setSaving(true)
    try {
      await rescheduleSmsMessage(target.id, day)
      toast.success('Message moved')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Could not move the message')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={Boolean(target)} onClose={onClose} titleId="reschedule-campaign-title" dismissible={!saving} panelClassName="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
        <h2 id="reschedule-campaign-title" className="text-base font-bold text-[var(--color-text-primary)]">
          Move message to another day
        </h2>
        {target && (
          <p className="truncate text-sm text-[var(--color-text-muted)]" title={target.body}>
            {target.body}
          </p>
        )}
        <div className="space-y-1.5">
          <label htmlFor="sms-reschedule" className="block text-sm font-medium text-[var(--color-text-secondary)]">
            New day (Bangladesh)
          </label>
          <input
            id="sms-reschedule"
            name="day"
            type="date"
            autoComplete="off"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:border-[var(--color-primary)] transition-colors"
          />
        </div>
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" fullWidth onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" fullWidth loading={saving}>
            Move message
          </Button>
        </div>
      </form>
    </Modal>
  )
}
