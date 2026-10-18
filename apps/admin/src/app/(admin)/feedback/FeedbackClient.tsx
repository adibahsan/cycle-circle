'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { Download } from 'lucide-react'
import { FilterBar } from '@/components/ui/FilterBar'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui'
import { Pagination } from '@/components/ui/Pagination'
import { exportFeedbackCsv } from '@/app/actions/export-actions'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'
import { ChartPanel } from '@/components/charts/ChartPanelLazy'
import { DateRangeControl } from '@/components/charts/DateRangeControl'

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
  range: string
  volumeData: { date: string; count: number }[]
  categoryData: { category: string; count: number }[]
  ratingData: { rating: number | null; count: number }[]
}

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'BUG', label: 'Bug Report' },
  { value: 'FEATURE', label: 'Feature Request' },
  { value: 'GENERAL', label: 'General' },
  { value: 'SATISFACTION', label: 'Satisfaction' },
]

// Value encodes mode: `min-N` = at least N stars, `eq-N` = exactly N stars.
const RATING_OPTIONS = [
  { value: 'all', label: 'All Ratings' },
  ...[1, 2, 3, 4, 5].map((n) => ({ value: `min-${n}`, label: `${n}+ Stars` })),
  ...[1, 2, 3, 4, 5].map((n) => ({ value: `eq-${n}`, label: `Exactly ${n}` })),
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
              ? 'text-[var(--color-warning)] text-base leading-none'
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
  return new Date(d).toLocaleDateString(undefined, {
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
          className="mt-0.5 text-xs text-[var(--color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--color-primary)] rounded"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

// ─── Main Client ─────────────────────────────────────────────────────────────

export function FeedbackClient({ data, volumeData, categoryData, ratingData }: FeedbackClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [exporting, setExporting] = useState(false)
  const toast = useToast()
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') ?? '')

  // ── Analytics data transformations ─────────────────────────────────────────

  // Volume-over-time: use date as xKey, count as the series value
  const volumeChartData = volumeData.map((d) => ({ date: d.date, count: d.count }))

  // Category breakdown: use category as xKey, count as series value
  const categoryChartData = categoryData.map((d) => ({
    category: d.category,
    count: d.count,
  }))

  // Rating distribution: map null → "No rating", numbers → "N★"
  const ratingChartData = ratingData.map((d) => ({
    label:
      d.rating === null
        ? 'No rating'
        : `${d.rating}★`, // e.g. "3★"
    count: d.count,
  }))

  const currentCategory = searchParams.get('category') ?? 'all'
  const ratingParam = searchParams.get('rating')
  const minRatingParam = searchParams.get('minRating')
  const currentRating = ratingParam
    ? `eq-${ratingParam}`
    : minRatingParam
      ? `min-${minRatingParam}`
      : 'all'
  const currentDateFrom = searchParams.get('dateFrom') ?? ''
  const currentDateTo = searchParams.get('dateTo') ?? ''
  const currentQuery = searchParams.get('q') ?? ''
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
    const [mode, n] = value.split('-')
    updateParams({
      rating: mode === 'eq' ? n : '',
      minRating: mode === 'min' ? n : '',
    })
  }

  // Server-side search: push the term to the URL after a short pause in typing.
  useEffect(() => {
    const term = searchTerm.trim()
    if (term === currentQuery) return
    const t = setTimeout(() => updateParams({ q: term }), 300)
    return () => clearTimeout(t)
  }, [searchTerm, currentQuery, updateParams])

  function handlePageChange(page: number) {
    updateParams({ page })
  }

  function handlePageSizeChange(pageSize: number) {
    updateParams({ pageSize, page: 1 })
  }

  const handleRowClick = useCallback(
    (row: FeedbackItem) => {
      router.push(`/feedback/${row.id}`)
    },
    [router],
  )

  async function handleExport() {
    setExporting(true)
    try {
      const csv = await exportFeedbackCsv({
        category: currentCategory,
        rating: ratingParam ? Number(ratingParam) : undefined,
        minRating: minRatingParam ? Number(minRatingParam) : undefined,
        search: currentQuery || undefined,
        dateFrom: currentDateFrom || undefined,
        dateTo: currentDateTo || undefined,
      })
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `feedback-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Feedback CSV exported')
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : 'Export failed')
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
    <div className="flex flex-1 flex-col gap-6 page-enter">

      {/* ── Analytics section ──────────────────────────────────────────── */}
      <section aria-label="Feedback analytics" className="flex flex-col gap-4">
        {/* Date range control */}
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
            Analytics
          </h2>
          <DateRangeControl paramKey="range" />
        </div>

        {/* Chart grid */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* Volume over time */}
          <ChartPanel
            title="Feedback Volume"
            data={volumeChartData}
            xKey="date"
            series={[{ key: 'count', label: 'Submissions' }]}
            kinds={['area', 'line', 'bar']}
            defaultKind="area"
            emptyLabel="No submissions in this period"
            className="md:col-span-2 xl:col-span-1"
          />

          {/* Category breakdown */}
          <ChartPanel
            title="By Category"
            data={categoryChartData}
            xKey="category"
            series={[{ key: 'count', label: 'Count' }]}
            kinds={['bar', 'pie']}
            defaultKind="bar"
            emptyLabel="No category data"
          />

          {/* Rating distribution */}
          <ChartPanel
            title="Rating Distribution"
            data={ratingChartData}
            xKey="label"
            series={[{ key: 'count', label: 'Count' }]}
            kinds={['bar']}
            defaultKind="bar"
            emptyLabel="No rating data"
          />
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}

      <AdminPageHeader
        title="Feedback"
        description={`${data.total.toLocaleString()} submission${data.total !== 1 ? 's' : ''} total`}
        tags={[adminCacheTags.feedback]}
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExport}
            loading={exporting}
            disabled={exporting}
          >
            <Download aria-hidden="true" size={15} />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        }
      />

      {/* Filters */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
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
            value: currentRating,
            onChange: handleRatingChange,
          },
        ]}
      />

      {/* Date range */}
      <div className="flex flex-wrap items-center gap-3">
        {([
          ['dateFrom', 'From', currentDateFrom],
          ['dateTo', 'To', currentDateTo],
        ] as const).map(([key, label, value]) => (
          <div key={key} className="flex items-center gap-2">
            <label htmlFor={`filter-${key}`} className="text-sm text-[var(--color-text-muted)] whitespace-nowrap">
              {label}:
            </label>
            <input
              id={`filter-${key}`}
              name={key}
              type="date"
              value={value}
              onChange={(e) => updateParams({ [key]: e.target.value })}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:border-[var(--color-primary)] transition-colors"
            />
          </div>
        ))}
        {(currentDateFrom || currentDateTo) && (
          <Button variant="ghost" size="sm" onClick={() => updateParams({ dateFrom: '', dateTo: '' })}>
            Clear dates
          </Button>
        )}
      </div>

      {/* Table */}
      <DataTable
        columns={COLUMNS}
        data={data.items}
        emptyMessage="No feedback matches your filters."
        keyExtractor={(row) => row.id}
        onRowClick={handleRowClick}
      />

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={data.totalPages}
        pageSize={currentPageSize}
        total={data.total}
        itemLabel="submission"
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  )
}
