'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { useToast } from '@/components/ui/Toast'
import { rescheduleSmsBroadcast } from '@/app/actions/sms-actions'
import { toLocalInput, type SmsBroadcast } from './sms-shared'

export function RescheduleModal({
  target,
  onClose,
  onSaved,
}: {
  target: SmsBroadcast | null
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [when, setWhen] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (target) setWhen(toLocalInput(target.scheduledFor))
  }, [target])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!target) return
    const date = new Date(when)
    if (!when || Number.isNaN(date.getTime())) {
      toast.error('Pick a date and time.')
      return
    }
    setSaving(true)
    try {
      await rescheduleSmsBroadcast(target.id, date.toISOString())
      toast.success('Broadcast rescheduled')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Could not reschedule the broadcast')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={Boolean(target)} onClose={onClose} titleId="reschedule-broadcast-title" dismissible={!saving} panelClassName="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
        <h2 id="reschedule-broadcast-title" className="text-base font-bold text-[var(--color-text-primary)]">
          Reschedule broadcast
        </h2>
        {target && (
          <p className="truncate text-sm text-[var(--color-text-muted)]" title={target.message}>
            {target.message}
          </p>
        )}
        <div className="space-y-1.5">
          <label htmlFor="sms-reschedule" className="block text-sm font-medium text-[var(--color-text-secondary)]">
            New send time
          </label>
          <DateTimePicker id="sms-reschedule" aria-label="New send date and time" value={when} onChange={setWhen} minDate={new Date()} />
        </div>
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" fullWidth onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" fullWidth loading={saving}>
            Reschedule
          </Button>
        </div>
      </form>
    </Modal>
  )
}
