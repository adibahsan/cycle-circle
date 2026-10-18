'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { updateSmsBroadcast } from '@/app/actions/sms-actions'
import { composeSms, type SmsSendLanguage } from '@vesta/shared/utils/sms'
import { LanguagePicker, PartCounter, TEXTAREA_CLASS, type SmsBroadcast } from './sms-shared'

export function EditBroadcastModal({
  target,
  onClose,
  onSaved,
}: {
  target: SmsBroadcast | null
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [message, setMessage] = useState('')
  const [messageBn, setMessageBn] = useState('')
  const [language, setLanguage] = useState<SmsSendLanguage>('BOTH')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (target) {
      setMessage(target.message)
      setMessageBn(target.messageBn ?? '')
      setLanguage(target.sendLanguage ?? 'BOTH')
    }
  }, [target])

  let composed = ''
  let composeError: string | null = null
  try {
    composed = composeSms(message.trim(), messageBn.trim() || null, language)
  } catch (e) {
    composeError = e instanceof Error ? e.message : null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!target) return
    if (!message.trim()) {
      toast.error('Message cannot be empty.')
      return
    }
    if (composeError) {
      toast.error(composeError)
      return
    }
    setSaving(true)
    try {
      await updateSmsBroadcast(target.id, {
        message: message.trim(),
        messageBn: messageBn.trim() || undefined,
        sendLanguage: language,
      })
      toast.success(target.status === 'FAILED' ? 'Broadcast updated and re-queued' : 'Broadcast updated')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Could not update the broadcast')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      titleId="edit-broadcast-title"
      dismissible={!saving}
      panelClassName="max-w-lg"
      initialFocusRef={textareaRef}
    >
      <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
        <h2 id="edit-broadcast-title" className="text-base font-bold text-[var(--color-text-primary)]">
          Edit broadcast
        </h2>
        <div className="space-y-1.5">
          <label htmlFor="sms-edit-message" className="block text-sm font-medium text-[var(--color-text-secondary)]">
            Message (English)
          </label>
          <textarea
            id="sms-edit-message"
            name="message"
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={480}
            className={TEXTAREA_CLASS}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="sms-edit-message-bn" className="block text-sm font-medium text-[var(--color-text-secondary)]">
            Message (Bengali) <span className="font-normal text-[var(--color-text-muted)]">— optional</span>
          </label>
          <textarea
            id="sms-edit-message-bn"
            name="messageBn"
            lang="bn"
            value={messageBn}
            onChange={(e) => setMessageBn(e.target.value)}
            rows={3}
            maxLength={480}
            className={TEXTAREA_CLASS}
          />
        </div>
        <LanguagePicker value={language} onChange={setLanguage} idPrefix="sms-edit-lang" />
        <div className="space-y-1">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">What handsets receive</p>
          {composeError ? (
            <p className="text-xs text-[var(--color-danger)]" role="alert">{composeError}</p>
          ) : (
            <>
              {composed && (
                <p lang={language === 'EN' ? 'en' : 'bn'} className="whitespace-pre-wrap rounded-lg bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
                  {composed}
                </p>
              )}
              <PartCounter text={composed} />
            </>
          )}
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
