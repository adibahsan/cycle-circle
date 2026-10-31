'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'
import { dayText, formatDay, formatSentAt, statusBadge, ResultCell, TotalsLines, type SmsCampaign } from '../sms-shared'

/** Read-only view of one campaign: every day's message, its status and when it went out (Bangladesh time). */
export function CampaignDetailClient({ campaign }: { campaign: SmsCampaign }) {
  const sent = campaign.messages.filter((m) => m.status === 'SENT').length
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
        description={`${sent} of ${campaign.messages.length} message${campaign.messages.length !== 1 ? 's' : ''} sent · created by ${
          campaign.creator.fullName ?? campaign.creator.email ?? 'unknown'
        }`}
        tags={[adminCacheTags.sms]}
        actions={<div data-testid="campaign-status">{statusBadge(campaign.status)}</div>}
      />

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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
