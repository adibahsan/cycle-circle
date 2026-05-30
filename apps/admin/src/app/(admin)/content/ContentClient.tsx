'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition, useState, useRef } from 'react'
import { Plus, Pencil, Trash2, ChevronRight, Tags, X } from 'lucide-react'
import { FilterBar } from '@/components/ui/FilterBar'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Input } from '@/components/ui/Input'
import { deleteArticle, createCategory, updateCategory, deleteCategory } from '@/app/actions/content-actions'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'

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
  const [searchTerm, setSearchTerm] = useState('')

  // Category manager state
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryOption | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingCategory, setDeletingCategory] = useState(false)
  const [categoryError, setCategoryError] = useState('')
  const categoryInputRef = useRef<HTMLInputElement>(null)

  // Inline category rename state
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [renamingSaving, setRenamingSaving] = useState(false)
  const [renameError, setRenameError] = useState('')

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

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()
    const name = newCategoryName.trim()
    if (!name) return
    setCategoryError('')
    setSaving(true)
    try {
      await createCategory(name)
      setNewCategoryName('')
      router.refresh()
      categoryInputRef.current?.focus()
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : 'Failed to create category')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteCategory() {
    if (!categoryToDelete) return
    setDeletingCategory(true)
    try {
      await deleteCategory(categoryToDelete.id)
      setCategoryToDelete(null)
      router.refresh()
    } finally {
      setDeletingCategory(false)
    }
  }

  function startEditCategory(cat: CategoryOption) {
    setEditingCategoryId(cat.id)
    setEditingCategoryName(cat.name)
    setRenameError('')
  }

  function cancelEditCategory() {
    setEditingCategoryId(null)
    setEditingCategoryName('')
    setRenameError('')
  }

  async function commitRenameCategory(id: string) {
    const name = editingCategoryName.trim()
    if (!name) {
      cancelEditCategory()
      return
    }
    setRenamingSaving(true)
    setRenameError('')
    try {
      await updateCategory(id, name)
      setEditingCategoryId(null)
      setEditingCategoryName('')
      router.refresh()
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : 'Failed to rename category')
    } finally {
      setRenamingSaving(false)
    }
  }

  const filteredArticles = searchTerm.trim()
    ? data.articles.filter((a) =>
        a.titleEn.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.titleBn ?? '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    : data.articles

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
      <AdminPageHeader
        title="Content"
        description={`${data.total.toLocaleString()} article${data.total !== 1 ? 's' : ''}`}
        tags={[adminCacheTags.content]}
        actions={
          <>
            <Button
              onClick={() => setShowCategoryManager(true)}
              variant="secondary"
              size="sm"
            >
              <Tags size={15} aria-hidden="true" />
              Manage Categories
            </Button>
            <Button
              onClick={() => router.push('/content/new')}
              variant="primary"
              size="sm"
            >
              <Plus size={15} aria-hidden="true" />
              New Article
            </Button>
          </>
        }
      />

      {/* Filters */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
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
        data={filteredArticles as unknown as ArticleRow[]}
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

      {/* Delete article confirm */}
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

      {/* Category manager modal */}
      {showCategoryManager && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overscroll-contain"
          role="dialog"
          aria-modal="true"
          aria-labelledby="category-manager-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !saving && !deletingCategory && setShowCategoryManager(false)}
            aria-hidden="true"
          />

          {/* Dialog card */}
          <div className="relative z-10 w-full max-w-lg rounded-2xl glass border border-[var(--color-border)] shadow-soft flex flex-col max-h-[80vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] shrink-0">
              <h2
                id="category-manager-title"
                className="text-lg font-bold text-[var(--color-text-primary)]"
              >
                Manage Categories
              </h2>
              <button
                type="button"
                onClick={() => setShowCategoryManager(false)}
                disabled={saving || deletingCategory}
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Close category manager"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {/* Add category form */}
            <div className="px-6 py-4 border-b border-[var(--color-border)] shrink-0">
              <form onSubmit={handleCreateCategory} className="flex gap-2 items-end">
                <div className="flex-1">
                  <Input
                    ref={categoryInputRef}
                    id="new-category-name"
                    label="New Category"
                    placeholder="e.g. Nutrition…"
                    value={newCategoryName}
                    onChange={(e) => {
                      setNewCategoryName(e.target.value)
                      if (categoryError) setCategoryError('')
                    }}
                    error={categoryError}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={saving}
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={saving}
                  disabled={!newCategoryName.trim()}
                  className="mb-0.5"
                >
                  <Plus size={14} aria-hidden="true" />
                  Add
                </Button>
              </form>
            </div>

            {/* Category list */}
            <div className="overflow-y-auto flex-1 px-6 py-2" aria-live="polite">
              {categories.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                  No categories yet. Add one above.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]" role="list">
                  {categories.map((cat) => {
                    const hasArticles = cat._count.articles > 0
                    const isEditing = editingCategoryId === cat.id
                    const isBusy = saving || deletingCategory || renamingSaving
                    return (
                      <li key={cat.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <div className="flex flex-col gap-1">
                              <input
                                type="text"
                                value={editingCategoryName}
                                onChange={(e) => {
                                  setEditingCategoryName(e.target.value)
                                  if (renameError) setRenameError('')
                                }}
                                onBlur={() => commitRenameCategory(cat.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    commitRenameCategory(cat.id)
                                  } else if (e.key === 'Escape') {
                                    cancelEditCategory()
                                  }
                                }}
                                disabled={renamingSaving}
                                autoFocus
                                spellCheck={false}
                                autoComplete="off"
                                aria-label={`Rename category ${cat.name}`}
                                className="w-full px-2 py-1 text-sm font-medium rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-rose-500 focus:outline-none disabled:opacity-60"
                              />
                              {renameError && (
                                <span className="text-xs text-red-600" aria-live="polite">
                                  {renameError}
                                </span>
                              )}
                            </div>
                          ) : (
                            <>
                              <span className="text-sm font-medium text-[var(--color-text-primary)] truncate block">
                                {cat.name}
                              </span>
                              <span className="text-xs text-[var(--color-text-muted)]">
                                {cat._count.articles} article{cat._count.articles !== 1 ? 's' : ''}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!isEditing && (
                            <button
                              type="button"
                              onClick={() => startEditCategory(cat)}
                              disabled={isBusy}
                              className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 disabled:opacity-40 disabled:cursor-not-allowed"
                              aria-label={`Rename category ${cat.name}`}
                            >
                              <Pencil size={13} aria-hidden="true" />
                            </button>
                          )}
                          <div
                            title={hasArticles ? 'Cannot delete a category that has articles' : undefined}
                          >
                            <button
                              type="button"
                              onClick={() => setCategoryToDelete(cat)}
                              disabled={hasArticles || isBusy || isEditing}
                              className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-[var(--color-text-muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[var(--color-text-muted)] disabled:hover:bg-transparent"
                              aria-label={`Delete category ${cat.name}`}
                            >
                              <Trash2 size={13} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-[var(--color-border)] shrink-0">
              <Button
                variant="secondary"
                size="sm"
                fullWidth
                onClick={() => setShowCategoryManager(false)}
                disabled={saving || deletingCategory}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete category confirm */}
      <ConfirmModal
        open={!!categoryToDelete}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={handleDeleteCategory}
        title="Delete Category"
        message={`Are you sure you want to delete "${categoryToDelete?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deletingCategory}
      />
    </div>
  )
}
