'use client'

import Link from 'next/link'
import { ArrowLeft, User } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'

type FeedbackDetail = {
  id: string
  userId: string
  profileId: string | null
  category: string
  message: string
  rating: number | null
  createdAt: Date
  user: {
    id: string
    fullName: string | null
    email: string | null
    phone: string | null
  }
  profile: {
    id: string
    name: string
    relation: string
  } | null
}

type CategoryVariant = 'danger' | 'info' | 'neutral' | 'success'

function categoryBadge(category: string) {
  const map: Record<string, { variant: CategoryVariant; label: string }> = {
    BUG: { variant: 'danger', label: 'Bug Report' },
    FEATURE: { variant: 'info', label: 'Feature Request' },
    GENERAL: { variant: 'neutral', label: 'General' },
    SATISFACTION: { variant: 'success', label: 'Satisfaction' },
  }
  const cfg = map[category] ?? { variant: 'neutral' as CategoryVariant, label: category }
  return <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
}

function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-[var(--color-text-muted)] text-sm">No rating</span>
  const filled = Math.max(0, Math.min(5, Math.round(rating)))
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${filled} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={
            i < filled
              ? 'text-amber-400 text-lg leading-none'
              : 'text-[var(--color-border)] text-lg leading-none'
          }
          aria-hidden="true"
        >
          {i < filled ? '★' : '☆'}
        </span>
      ))}
    </span>
  )
}

function formatDateTime(d: Date) {
  return new Date(d).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface FeedbackDetailClientProps {
  feedback: FeedbackDetail
}

export function FeedbackDetailClient({ feedback }: FeedbackDetailClientProps) {
  const displayName =
    feedback.user.fullName ?? feedback.user.email ?? feedback.user.phone ?? 'Unknown user'

  return (
    <div className="space-y-6 page-enter">
      <Link
        href="/feedback"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Back to feedback
      </Link>

      <AdminPageHeader
        title="Feedback"
        description={`Submitted ${formatDateTime(feedback.createdAt)}`}
        tags={[adminCacheTags.feedback]}
      />

      <div className="glass rounded-2xl border border-[var(--color-border)] p-6 shadow-soft space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          {categoryBadge(feedback.category)}
          <StarRating rating={feedback.rating} />
        </div>

        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
            Message
          </h2>
          <p className="mt-2 text-[var(--color-text-primary)] text-base leading-relaxed whitespace-pre-wrap">
            {feedback.message}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 border-t border-[var(--color-border)] pt-6">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              User
            </h2>
            <Link
              href={`/users/${feedback.user.id}`}
              className="mt-2 inline-flex items-center gap-2 text-[var(--color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 rounded"
            >
              <User size={15} aria-hidden="true" />
              <span className="font-medium">{displayName}</span>
            </Link>
            {feedback.user.email && (
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{feedback.user.email}</p>
            )}
            {feedback.user.phone && (
              <p className="text-sm text-[var(--color-text-muted)]">{feedback.user.phone}</p>
            )}
          </div>

          {feedback.profile && (
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                Profile
              </h2>
              <p className="mt-2 font-medium text-[var(--color-text-primary)]">
                {feedback.profile.name}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">{feedback.profile.relation}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
