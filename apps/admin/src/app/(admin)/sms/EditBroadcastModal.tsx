'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { updateSmsMessage } from '@/app/actions/sms-actions'
import { PartCounter, TEXTAREA_CLASS, type SmsMessage } from './sms-shared'

/** Edit the text of one unsent campaign message. */
export function EditBroadcastModal({
  target,
  onClose,
  onSaved,
}: {
  target: SmsMessage | null
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (target) setBody(target.body)
  }, [target])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!target) return
    if (!body.trim()) {
      toast.error('Message cannot be empty.')
      return
    }
    setSaving(true)
    try {
      const result = await updateSmsMessage(target.id, { body: body.trim() })
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(target.status === 'FAILED' ? 'Message updated and planned again' : 'Message updated')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Could not update the message')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      titleId="edit-campaign-title"
      dismissible={!saving}
      panelClassName="max-w-lg"
      initialFocusRef={textareaRef}
    >
      <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
        <h2 id="edit-campaign-title" className="text-base font-bold text-[var(--color-text-primary)]">
          Edit message
        </h2>
        <div className="space-y-1.5">
          <label htmlFor="sms-edit-message" className="block text-sm font-medium text-[var(--color-text-secondary)]">
            Message
          </label>
          <textarea
            id="sms-edit-message"
            name="message"
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            maxLength={480}
            className={TEXTAREA_CLASS}
          />
          <PartCounter text={body} />
        </div>
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" fullWidth onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" fullWidth loading={saving}>
            Save changes
          </Button>
        </div>
      </form>
    </Modal>
  )
}
