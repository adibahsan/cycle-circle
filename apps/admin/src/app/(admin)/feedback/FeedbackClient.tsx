'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { Download } from 'lucide-react'
import { FilterBar } from '@/components/ui/FilterBar'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { exportFeedbackCsv } from '@/app/actions/export-actions'

type FeedbackItem = {
  id: string
  category: string
  message: string
  rating: number | null
  createdAt: Date
  user: { id: string; fullName: string | null; email: string | null }
}

interface FeedbackClientProps {
  data: {
    items: FeedbackItem[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'BUG', label: 'Bug Report' },
  { value: 'FEATURE', label: 'Feature Request' },
  { value: 'GENERAL', label: 'General' },
  { value: 'SATISFACTION', label: 'Satisfaction' },
]

const RATING_OPTIONS = [
  { value: 'all', label: 'All Ratings' },
  { value: '1', label: '1+ Stars' },
  { value: '2', label: '2+ Stars' },
  { value: '3', label: '3+ Stars' },
  { value: '4', label: '4+ Stars' },
  { value: '5', label: '5 Stars' },
]

type CategoryVariant = 'danger' | 'info' | 'neutral' | 'success'

function categoryBadge(category: string) {
  const map: Record<string, { variant: CategoryVariant; label: string }> = {
    BUG: { variant: 'danger', label: 'Bug' },
    FEATURE: { variant: 'info', label: 'Feature' },
    GENERAL: { variant: 'neutral', label: 'General' },
    SATISFACTION: { variant: 'success', label: 'Satisfaction' },
  }
  const cfg = map[category] ?? { variant: 'neutral', label: category }
  return <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
}

// Render filled/empty stars for a numeric rating out of 5
function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) return <span className="text-[var(--color-text-muted)] text-sm">—</span>
  const filled = Math.max(0, Math.min(5, Math.round(rating)))
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${filled} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={
            i < filled
              ? 'text-amber-400 text-base leading-none'
              : 'text-[var(--color-border)] text-base leading-none'
          }
          aria-hidden="true"
        >
          {i < filled ? '★' : '☆'}
        </span>
      ))}
    </span>
  )
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Expandable message cell ──────────────────────────────────────────────────
function MessageCell({ message }: { message: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = message.length > 80

  return (
    <div>
      <p
        className={`text-sm text-[var(--color-text-primary)] ${!expanded && isLong ? 'line-clamp-2' : ''}`}
      >
        {message}
      </p>
      {isLong && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
          className="mt-0.5 text-xs text-[var(--color-primary)] hover:underline focus:outline-none"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

// ─── Main Client ─────────────────────────────────────────────────────────────

export function FeedbackClient({ data }: FeedbackClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [exporting, setExporting] = useState(false)

  const currentCategory = searchParams.get('category') ?? 'all'
  const currentMinRating = searchParams.get('minRating') ?? 'all'
  const currentPage = data.page
  const currentPageSize = data.pageSize

  const updateParams = useCallback(
    (updates: Record<string, string | number>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(updates).forEach(([k, v]) => {
        if (v === '' || v === undefined || v === 'all') {
          params.delete(k)
        } else {
          params.set(k, String(v))
        }
      })
      if (!('page' in updates)) params.set('page', '1')
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [router, pathname, searchParams]
  )

  function handleCategoryChange(value: string) {
    updateParams({ category: value })
  }

  function handleRatingChange(value: string) {
    updateParams({ minRating: value })
  }

  function handlePageChange(page: number) {
    updateParams({ page })
  }

  function handlePageSizeChange(pageSize: number) {
    updateParams({ pageSize, page: 1 })
  }

  async function handleExport() {
    setExporting(true)
    try {
      const csv = await exportFeedbackCsv()
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `feedback-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const COLUMNS: Column<FeedbackItem>[] = [
    {
      key: 'user',
      header: 'User',
      render: (row) => (
        <div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {row.user.fullName ?? '—'}
          </p>
          {row.user.email && (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate max-w-[160px]">
              {row.user.email}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => categoryBadge(row.category),
    },
    {
      key: 'message',
      header: 'Message',
      render: (row) => <MessageCell message={row.message} />,
    },
    {
      key: 'rating',
      header: 'Rating',
      sortable: true,
      render: (row) => <StarRating rating={row.rating} />,
    },
    {
      key: 'createdAt',
      header: 'Date',
      sortable: true,
      render: (row) => (
        <span className="text-sm text-[var(--color-text-muted)]">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Feedback</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {data.total.toLocaleString()} submission{data.total !== 1 ? 's' : ''} total
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExport}
          loading={exporting}
          disabled={exporting}
        >
          <Download size={15} />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>

      {/* Filters */}
      <FilterBar
        searchValue=""
        onSearchChange={() => {}}
        searchPlaceholder="Search feedback…"
        filters={[
          {
            key: 'category',
            label: 'Category',
            options: CATEGORY_OPTIONS,
            value: currentCategory,
            onChange: handleCategoryChange,
          },
          {
            key: 'minRating',
            label: 'Rating',
            options: RATING_OPTIONS,
            value: currentMinRating,
            onChange: handleRatingChange,
          },
        ]}
      />

      {/* Table */}
      <DataTable
        columns={COLUMNS}
        data={data.items as unknown as FeedbackItem[]}
        emptyMessage="No feedback matches your filters."
        keyExtractor={(row) => row.id}
      />

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={data.totalPages}
        pageSize={currentPageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  )
}
