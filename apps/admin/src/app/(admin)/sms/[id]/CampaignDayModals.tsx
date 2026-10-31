'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { addSmsMessage, resendSmsMessage } from '@/app/actions/sms-actions'
import { PartCounter, TEXTAREA_CLASS, formatDay, type SmsMessage } from '../sms-shared'

const DAY_INPUT_CLASS =
  'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:border-[var(--color-primary)] transition-colors'

/** Add one more day (a free Bangladesh day) to a campaign. */
export function AddDayModal({
  campaignId,
  open,
  onClose,
  onSaved,
}: {
  campaignId: string
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [day, setDay] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setDay('')
      setBody('')
      setError('')
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return setError('Pick a day.')
    if (!body.trim()) return setError('Message cannot be empty.')
    setSaving(true)
    setError('')
    try {
      const result = await addSmsMessage(campaignId, { day, body: body.trim() })
      if ('error' in result) {
        setError(result.error)
        return
      }
      toast.success('Day added')
      onSaved()
      onClose()
    } catch {
      setError('Could not add the day')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} titleId="add-day-title" dismissible={!saving} panelClassName="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
        <h2 id="add-day-title" className="text-base font-bold text-[var(--color-text-primary)]">
          Add a day
        </h2>
        <div className="space-y-1.5">
          <label htmlFor="sms-add-day" className="block text-sm font-medium text-[var(--color-text-secondary)]">
            Day (Bangladesh)
          </label>
          <input id="sms-add-day" name="day" type="date" autoComplete="off" value={day} onChange={(e) => setDay(e.target.value)} className={DAY_INPUT_CLASS} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="sms-add-body" className="block text-sm font-medium text-[var(--color-text-secondary)]">
            New message
          </label>
          <textarea id="sms-add-body" name="message" value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={480} className={TEXTAREA_CLASS} />
          <PartCounter text={body} />
        </div>
        <p role="alert" aria-live="polite" className="min-h-[1.25rem] text-sm text-[var(--color-danger)]">
          {error}
        </p>
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" fullWidth onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" fullWidth loading={saving}>
            Add day
          </Button>
        </div>
      </form>
    </Modal>
  )
}

/** Plan a failed or missed message again on a chosen free Bangladesh day. */
export function ResendModal({
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
  const [error, setError] = useState('')

  useEffect(() => {
    if (target) {
      setDay('')
      setError('')
    }
  }, [target])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!target) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return setError('Pick a day.')
    setSaving(true)
    setError('')
    try {
      const result = await resendSmsMessage(target.id, day)
      if ('error' in result) {
        setError(result.error)
        return
      }
      toast.success('Message planned again')
      onSaved()
      onClose()
    } catch {
      setError('Could not plan the message again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={Boolean(target)} onClose={onClose} titleId="resend-title" dismissible={!saving} panelClassName="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
        <h2 id="resend-title" className="text-base font-bold text-[var(--color-text-primary)]">
          Resend on a free day
        </h2>
        {target && (
          <p className="text-sm text-[var(--color-text-muted)]">
            The {formatDay(target.day)} message stays {target.status === 'MISSED' ? 'missed' : 'failed'}; a copy is planned on the day you pick.
          </p>
        )}
        <div className="space-y-1.5">
          <label htmlFor="sms-resend-day" className="block text-sm font-medium text-[var(--color-text-secondary)]">
            Free day (Bangladesh)
          </label>
          <input id="sms-resend-day" name="day" type="date" autoComplete="off" value={day} onChange={(e) => setDay(e.target.value)} className={DAY_INPUT_CLASS} />
        </div>
        <p role="alert" aria-live="polite" className="min-h-[1.25rem] text-sm text-[var(--color-danger)]">
          {error}
        </p>
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" fullWidth onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" fullWidth loading={saving}>
            Plan on this day
          </Button>
        </div>
      </form>
    </Modal>
  )
}
