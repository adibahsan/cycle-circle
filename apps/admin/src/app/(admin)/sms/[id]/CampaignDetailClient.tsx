'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarClock, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/components/ui/Toast'
import { cancelSmsCampaign, deleteSmsCampaign } from '@/app/actions/sms-actions'
import { canDeleteCampaign, canEditMessage } from '@vesta/shared/utils/sms'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'
import { dayText, formatDay, formatSentAt, statusBadge, ResultCell, TotalsLines, type SmsCampaign, type SmsMessage } from '../sms-shared'
import { EditBroadcastModal } from '../EditBroadcastModal'
import { RescheduleModal } from '../RescheduleModal'
import { AddDayModal, ResendModal } from './CampaignDayModals'

const ICON_BUTTON =
  'p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]'

/** One campaign: every day's message, its status and when it went out (Bangladesh time), with the controls to run it. */
export function CampaignDetailClient({ campaign }: { campaign: SmsCampaign }) {
  const router = useRouter()
  const toast = useToast()
  const [editTarget, setEditTarget] = useState<SmsMessage | null>(null)
  const [moveTarget, setMoveTarget] = useState<SmsMessage | null>(null)
  const [resendTarget, setResendTarget] = useState<SmsMessage | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const sent = campaign.messages.filter((m) => m.status === 'SENT').length
  const total = campaign.messages.length
  const cancelled = campaign.status === 'cancelled'
  const hasPlanned = campaign.messages.some((m) => m.status === 'PLANNED')
  const refresh = () => router.refresh()

  async function handleCancel() {
    setBusy(true)
    try {
      const result = await cancelSmsCampaign(campaign.id)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setCancelOpen(false)
      toast.success(`Cancelled, ${result.sent} of ${result.total} sent`)
      refresh()
    } catch {
      toast.error('Could not cancel the campaign')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    try {
      const result = await deleteSmsCampaign(campaign.id)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success('Campaign deleted')
      router.push('/sms')
    } catch {
      toast.error('Could not delete the campaign')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-1 flex-col gap-6 page-enter">
      <Link
        href="/sms"
        className="inline-flex w-fit items-center gap-1.5 rounded text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        All campaigns
      </Link>

      <AdminPageHeader
        title={campaign.name}
        description={`${sent} of ${total} message${total !== 1 ? 's' : ''} sent · created by ${
          campaign.creator.fullName ?? campaign.creator.email ?? 'unknown'
        }`}
        tags={[adminCacheTags.sms]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div data-testid="campaign-status">{statusBadge(campaign.status)}</div>
            {!cancelled && (
              <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
                <Plus aria-hidden="true" size={15} />
                Add day
              </Button>
            )}
            {!cancelled && hasPlanned && (
              <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
                Cancel campaign
              </Button>
            )}
            {canDeleteCampaign(campaign.messages) && (
              <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 aria-hidden="true" size={15} />
                Delete campaign
              </Button>
            )}
          </div>
        }
      />
      {cancelled && (
        <p data-testid="campaign-cancelled-summary" role="status" className="text-sm font-medium text-[var(--color-text-secondary)]">
          Cancelled, {sent} of {total} sent
        </p>
      )}

      <TotalsLines messages={campaign.messages} />

      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Messages in {campaign.name}</caption>
          <thead className="bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-muted)]">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Day</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Message</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Sent (Bangladesh time)</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Result</th>
              <th scope="col" className="px-4 py-2.5 font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {campaign.messages.map((m) => (
              <tr key={m.id} data-day={dayText(m.day)} className="border-t border-[var(--color-border)] align-top">
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-[var(--color-text-secondary)]">{formatDay(m.day)}</td>
                <td className="px-4 py-3 text-[var(--color-text-primary)]">
                  <p className="max-w-prose whitespace-pre-wrap">{m.body}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1">
                    {statusBadge(m.status)}
                    {m.status === 'FAILED' && m.lastError && (
                      <p className="max-w-[260px] text-xs text-[var(--color-danger)]">{m.lastError}</p>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-[var(--color-text-muted)]">{formatSentAt(m.sentAt)}</td>
                <td className="px-4 py-3"><ResultCell message={m} /></td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex items-center gap-1">
                    {canEditMessage(m.status) && (
                      <>
                        <button type="button" onClick={() => setEditTarget(m)} className={ICON_BUTTON} aria-label={`Edit message for ${formatDay(m.day)}`} title="Edit">
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                        <button type="button" onClick={() => setMoveTarget(m)} className={ICON_BUTTON} aria-label={`Move message for ${formatDay(m.day)} to another day`} title="Move to another day">
                          <CalendarClock size={15} aria-hidden="true" />
                        </button>
                      </>
                    )}
                    {!cancelled && (m.status === 'FAILED' || m.status === 'MISSED') && (
                      <button type="button" onClick={() => setResendTarget(m)} className={ICON_BUTTON} aria-label={`Resend message for ${formatDay(m.day)} on a free day`} title="Resend on a free day">
                        <RotateCcw size={15} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EditBroadcastModal target={editTarget} onClose={() => setEditTarget(null)} onSaved={refresh} />
      <RescheduleModal target={moveTarget} onClose={() => setMoveTarget(null)} onSaved={refresh} />
      <ResendModal target={resendTarget} onClose={() => setResendTarget(null)} onSaved={refresh} />
      <AddDayModal campaignId={campaign.id} open={addOpen} onClose={() => setAddOpen(false)} onSaved={refresh} />
      <ConfirmModal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        title="Cancel this campaign?"
        message="Days that have not gone out are cancelled. Messages already sent stay in the history."
        confirmLabel="Cancel campaign"
        loading={busy}
      />
      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete this campaign?"
        message="Nothing has been sent, so the campaign and its days are removed for good."
        confirmLabel="Delete"
        loading={busy}
      />
    </div>
  )
}
