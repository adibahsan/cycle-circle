'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition, useState } from 'react'
import { Plus, Pencil, Trash2, ChevronRight } from 'lucide-react'
import { FilterBar } from '@/components/ui/FilterBar'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { deleteArticle } from '@/app/actions/content-actions'

type ArticleRow = {
  id: string
  slug: string
  titleEn: string
  titleBn: string | null
  status: string
  cyclePhases: string[]
  publishedAt: Date | null
  createdAt: Date
  category: { name: string } | null
  author: { fullName: string | null } | null
}

type CategoryOption = {
  id: string
  name: string
  _count: { articles: number }
}

interface ContentClientProps {
  data: {
    articles: ArticleRow[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
  categories: CategoryOption[]
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
]

const PHASE_LABELS: Record<string, string> = {
  MENSTRUAL: 'Menstrual',
  FOLLICULAR: 'Follicular',
  OVULATION: 'Ovulation',
  LUTEAL: 'Luteal',
}

const PHASE_COLORS: Record<string, string> = {
  MENSTRUAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  FOLLICULAR: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  OVULATION: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  LUTEAL: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'PUBLISHED') return <Badge variant="success" size="sm">Published</Badge>
  if (status === 'DRAFT') return <Badge variant="info" size="sm">Draft</Badge>
  if (status === 'ARCHIVED') return <Badge variant="neutral" size="sm">Archived</Badge>
  return <Badge variant="neutral" size="sm">{status}</Badge>
}

function PhaseBadges({ phases }: { phases: string[] }) {
  if (!phases || phases.length === 0) return <span className="text-[var(--color-text-muted)] text-xs">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {phases.map((phase) => (
        <span
          key={phase}
          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${PHASE_COLORS[phase] ?? 'bg-gray-100 text-gray-700'}`}
        >
          {PHASE_LABELS[phase] ?? phase}
        </span>
      ))}
    </div>
  )
}

function formatDate(d: Date | null | string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ContentClient({ data, categories }: ContentClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [deleteTarget, setDeleteTarget] = useState<ArticleRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const currentStatus = searchParams.get('status') ?? 'all'
  const currentCategoryId = searchParams.get('categoryId') ?? 'all'
  const currentPage = data.page
  const currentPageSize = data.pageSize

  const updateParams = useCallback(
    (updates: Record<string, string | number>) => {
      const params = new URLSearchParams(searchParams.toString())
      Object.entries(updates).forEach(([k, v]) => {
        if (v === '' || v === 'all' || v === undefined) {
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

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    ...categories.map((c) => ({ value: c.id, label: `${c.name} (${c._count.articles})` })),
  ]

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteArticle(deleteTarget.id)
      setDeleteTarget(null)
      router.refresh()
    } finally {
      setDeleting(false)
    }
  }

  const COLUMNS: Column<ArticleRow>[] = [
    {
      key: 'titleEn',
      header: 'Title',
      render: (row) => (
        <div className="space-y-0.5">
          <p className="font-medium text-[var(--color-text-primary)] line-clamp-1">{row.titleEn}</p>
          {row.titleBn && (
            <p className="text-xs text-[var(--color-text-muted)] line-clamp-1">{row.titleBn}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => (
        <span className="text-sm text-[var(--color-text-secondary)]">
          {row.category?.name ?? '—'}
        </span>
      ),
    },
    {
      key: 'cyclePhases',
      header: 'Phases',
      render: (row) => <PhaseBadges phases={row.cyclePhases} />,
    },
    {
      key: 'author',
      header: 'Author',
      render: (row) => (
        <span className="text-sm text-[var(--color-text-muted)]">
          {row.author?.fullName ?? '—'}
        </span>
      ),
    },
    {
      key: 'publishedAt',
      header: 'Published',
      sortable: true,
      render: (row) => (
        <span className="text-sm text-[var(--color-text-muted)]">
          {formatDate(row.publishedAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '96px',
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/content/${row.id}`)
            }}
            className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500"
            aria-label="Edit article"
            title="Edit article"
          >
            <Pencil size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setDeleteTarget(row)
            }}
            className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-[var(--color-text-muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500"
            aria-label="Delete article"
            title="Delete article"
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
          <ChevronRight size={14} className="text-[var(--color-text-muted)] ml-0.5" aria-hidden="true" />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Content</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {data.total.toLocaleString()} article{data.total !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          onClick={() => router.push('/content/new')}
          variant="primary"
          size="sm"
        >
          <Plus size={15} />
          New Article
        </Button>
      </div>

      {/* Filters */}
      <FilterBar
        searchValue=""
        onSearchChange={() => {}}
        searchPlaceholder="Search articles…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: STATUS_OPTIONS,
            value: currentStatus,
            onChange: (v) => updateParams({ status: v }),
          },
          {
            key: 'categoryId',
            label: 'Category',
            options: categoryOptions,
            value: currentCategoryId,
            onChange: (v) => updateParams({ categoryId: v }),
          },
        ]}
      />

      {/* Table */}
      <DataTable
        columns={COLUMNS}
        data={data.articles as unknown as ArticleRow[]}
        emptyMessage="No articles match your filters."
        onRowClick={(row) => router.push(`/content/${row.id}`)}
        keyExtractor={(row) => row.id}
      />

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={data.totalPages}
        pageSize={currentPageSize}
        onPageChange={(page) => updateParams({ page })}
        onPageSizeChange={(pageSize) => updateParams({ pageSize, page: 1 })}
      />

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Article"
        message={`Are you sure you want to delete "${deleteTarget?.titleEn}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}
