'use client'

import { useRouter } from 'next/navigation'
import { useUrlParams } from '@/lib/use-url-params'
import { useState, useRef, useEffect } from 'react'
import { Plus, Pencil, Trash2, ChevronRight, Tags, X, Check, GripVertical, ChevronUp, ChevronDown } from 'lucide-react'
import { FilterBar } from '@/components/ui/FilterBar'
import { DataTable, Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { deleteArticle, createCategory, updateCategory, deleteCategory, reorderCategories } from '@/app/actions/content-actions'
import { AdminPageHeader } from '@/components/ui/AdminPageHeader'
import { adminCacheTags } from '@/lib/admin-cache-tags'
import { useToast } from '@/components/ui/Toast'
import { ChartPanel } from '@/components/charts/ChartPanelLazy'
import { formatDhaka } from '@vesta/shared/utils/dhaka-date'

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
  nameBn: string | null
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
  statusBreakdown: { status: string; count: number }[]
  byCategory: { category: string; count: number }[]
  byPhase: { phase: string; count: number }[]
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

const PHASE_OPTIONS = [
  { value: 'all', label: 'All Phases' },
  ...Object.entries(PHASE_LABELS).map(([value, label]) => ({ value, label })),
]

const BANGLA_OPTIONS = [
  { value: 'all', label: 'Any' },
  { value: '1', label: 'Missing Bangla' },
]

const PHASE_COLORS: Record<string, string> = {
  MENSTRUAL: 'bg-[color-mix(in_srgb,var(--color-menstrual)_22%,transparent)] text-[var(--color-text-primary)]',
  FOLLICULAR: 'bg-[color-mix(in_srgb,var(--color-follicular)_22%,transparent)] text-[var(--color-text-primary)]',
  OVULATION: 'bg-[color-mix(in_srgb,var(--color-ovulation)_22%,transparent)] text-[var(--color-text-primary)]',
  LUTEAL: 'bg-[color-mix(in_srgb,var(--color-luteal)_22%,transparent)] text-[var(--color-text-primary)]',
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
          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${PHASE_COLORS[phase] ?? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'}`}
        >
          {PHASE_LABELS[phase] ?? phase}
        </span>
      ))}
    </div>
  )
}

function formatDate(d: Date | null | string) {
  if (!d) return '—'
  return formatDhaka(d, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ContentClient({ data, categories, statusBreakdown, byCategory, byPhase }: ContentClientProps) {
  const router = useRouter()
  const { searchParams, updateParams } = useUrlParams({ clearOn: ['all'] })
  const [deleteTarget, setDeleteTarget] = useState<ArticleRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()

  // Category manager state
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryNameBn, setNewCategoryNameBn] = useState('')
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryOption | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingCategory, setDeletingCategory] = useState(false)
  const [categoryError, setCategoryError] = useState('')
  const categoryInputRef = useRef<HTMLInputElement>(null)

  // Inline category rename state
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [editingCategoryNameBn, setEditingCategoryNameBn] = useState('')
  const [renamingSaving, setRenamingSaving] = useState(false)
  const [renameError, setRenameError] = useState('')

  // Category order: optimistic local copy of the server order, reverted if saving fails.
  const [orderedCategories, setOrderedCategories] = useState(categories)
  const [dragId, setDragId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [orderMessage, setOrderMessage] = useState('')
  const [listError, setListError] = useState('')
  useEffect(() => setOrderedCategories(categories), [categories])

  const currentStatus = searchParams.get('status') ?? 'all'
  const currentCategoryId = searchParams.get('categoryId') ?? 'all'
  const currentPhase = searchParams.get('phase') ?? 'all'
  const currentMissingBangla = searchParams.get('missingBangla') === '1' ? '1' : 'all'
  const currentQuery = searchParams.get('q') ?? ''
  const currentPage = data.page
  const currentPageSize = data.pageSize


  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    { value: 'none', label: 'No category' },
    ...categories.map((c) => ({ value: c.id, label: `${c.name} (${c._count.articles})` })),
  ]

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const result = await deleteArticle(deleteTarget.id)
      setDeleteTarget(null)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      router.refresh()
    } catch {
      setDeleteTarget(null)
      toast.error('Could not delete the article. Check your connection and try again.')
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
      const res = await createCategory(name, newCategoryNameBn.trim())
      if (res.error) {
        setCategoryError(res.error)
        return
      }
      setNewCategoryName('')
      setNewCategoryNameBn('')
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
    setListError('')
    try {
      const res = await deleteCategory(categoryToDelete.id)
      if (res.error) setListError(res.error)
      else router.refresh()
      setCategoryToDelete(null)
    } catch {
      setListError('Failed to delete category')
      setCategoryToDelete(null)
    } finally {
      setDeletingCategory(false)
    }
  }

  function startEditCategory(cat: CategoryOption) {
    setEditingCategoryId(cat.id)
    setEditingCategoryName(cat.name)
    setEditingCategoryNameBn(cat.nameBn ?? '')
    setRenameError('')
  }

  function cancelEditCategory() {
    setEditingCategoryId(null)
    setEditingCategoryName('')
    setEditingCategoryNameBn('')
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
      const res = await updateCategory(id, name, editingCategoryNameBn.trim())
      if (res.error) {
        setRenameError(res.error)
        return
      }
      setEditingCategoryId(null)
      setEditingCategoryName('')
      setEditingCategoryNameBn('')
      router.refresh()
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : 'Failed to rename category')
    } finally {
      setRenamingSaving(false)
    }
  }

  async function moveCategory(id: string, toIndex: number) {
    const from = orderedCategories.findIndex((c) => c.id === id)
    if (from < 0 || toIndex < 0 || toIndex >= orderedCategories.length || from === toIndex) return
    const previous = orderedCategories
    const next = [...orderedCategories]
    const [moved] = next.splice(from, 1)
    next.splice(toIndex, 0, moved)
    setOrderedCategories(next)
    setListError('')
    setOrderMessage(`${moved.name} moved to position ${toIndex + 1} of ${next.length}`)
    setReordering(true)
    try {
      const res = await reorderCategories(next.map((c) => c.id))
      if (res.error) {
        setOrderedCategories(previous)
        setListError(res.error)
        setOrderMessage('')
      } else {
        router.refresh()
      }
    } catch {
      setOrderedCategories(previous)
      setListError('Failed to reorder categories')
      setOrderMessage('')
    } finally {
      setReordering(false)
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
            className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]"
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
            className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]"
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
    <div className="flex flex-1 flex-col gap-6 page-enter">
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

      {/* Charts — status / category / cycle-phase breakdowns */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ChartPanel
          title="Articles by Status"
          data={statusBreakdown.map((r) => ({ name: r.status, count: r.count }))}
          xKey="name"
          series={[{ key: 'count', label: 'Articles' }]}
          kinds={['pie', 'bar']}
          defaultKind="pie"
          height={240}
          emptyLabel="No articles yet"
        />
        <ChartPanel
          title="Articles by Category"
          data={byCategory.map((r) => ({ name: r.category, count: r.count }))}
          xKey="name"
          series={[{ key: 'count', label: 'Articles' }]}
          kinds={['bar']}
          defaultKind="bar"
          height={240}
          emptyLabel="No categories yet"
        />
        <ChartPanel
          title="Articles by Cycle Phase"
          data={byPhase.map((r) => ({
            name: r.phase.charAt(0) + r.phase.slice(1).toLowerCase(),
            count: r.count,
          }))}
          xKey="name"
          series={[{ key: 'count', label: 'Articles' }]}
          kinds={['bar']}
          defaultKind="bar"
          height={240}
          emptyLabel="No phase data yet"
        />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={currentQuery}
        onSearchChange={(q) => updateParams({ q })}
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
          {
            key: 'phase',
            label: 'Phase',
            options: PHASE_OPTIONS,
            value: currentPhase,
            onChange: (v) => updateParams({ phase: v }),
          },
          {
            key: 'missingBangla',
            label: 'Bangla',
            options: BANGLA_OPTIONS,
            value: currentMissingBangla,
            onChange: (v) => updateParams({ missingBangla: v }),
          },
        ]}
      />

      {/* Table */}
      <DataTable
        columns={COLUMNS}
        data={data.articles}
        emptyMessage="No articles match your filters."
        onRowClick={(row) => router.push(`/content/${row.id}`)}
        keyExtractor={(row) => row.id}
      />

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={data.totalPages}
        pageSize={currentPageSize}
        total={data.total}
        itemLabel="article"
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
      <Modal
        open={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
        titleId="category-manager-title"
        dismissible={!saving && !deletingCategory}
        panelClassName="max-w-lg"
        initialFocusRef={categoryInputRef}
      >
        <div className="flex flex-col">
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
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="h-12"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    id="new-category-name-bn"
                    name="categoryNameBn"
                    label="Bengali Name (optional)"
                    placeholder="যেমন: পুষ্টি…"
                    lang="bn"
                    value={newCategoryNameBn}
                    onChange={(e) => setNewCategoryNameBn(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={saving}
                    className="h-12"
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={saving}
                  disabled={!newCategoryName.trim()}
                  className="h-12"
                >
                  <Plus size={16} aria-hidden="true" />
                  Add
                </Button>
              </form>
            </div>

            {/* Category list */}
            <div className="overflow-y-auto flex-1 px-6 py-2" aria-live="polite">
              {listError && (
                <p role="alert" className="py-2 text-sm text-[var(--color-error)]">
                  {listError}
                </p>
              )}
              <p className="sr-only" role="status">{orderMessage}</p>
              {orderedCategories.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                  No categories yet. Add one above.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]" role="list">
                  {orderedCategories.map((cat, index) => {
                    const hasArticles = cat._count.articles > 0
                    const isEditing = editingCategoryId === cat.id
                    const isBusy = saving || deletingCategory || renamingSaving
                    const orderLocked = isBusy || reordering || !!editingCategoryId
                    return (
                      <li
                        key={cat.id}
                        className={`flex items-center justify-between gap-3 py-3 ${dragId === cat.id ? 'opacity-50' : ''}`}
                        draggable={!orderLocked}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move'
                          setDragId(cat.id)
                        }}
                        onDragOver={(e) => {
                          if (dragId) e.preventDefault()
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          if (dragId) moveCategory(dragId, index)
                          setDragId(null)
                        }}
                        onDragEnd={() => setDragId(null)}
                      >
                        <div className="flex flex-col items-center shrink-0">
                          <GripVertical size={14} className="text-[var(--color-text-muted)] cursor-grab" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <div
                              className="flex flex-col gap-1"
                              onBlur={(e) => {
                                // Commit only when focus leaves both inputs.
                                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                                  commitRenameCategory(cat.id)
                                }
                              }}
                            >
                              <label htmlFor={`rename-category-${cat.id}`} className="sr-only">
                                {`Rename category ${cat.name}`}
                              </label>
                              <input
                                id={`rename-category-${cat.id}`}
                                name="categoryName"
                                type="text"
                                value={editingCategoryName}
                                onChange={(e) => {
                                  setEditingCategoryName(e.target.value)
                                  if (renameError) setRenameError('')
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    commitRenameCategory(cat.id)
                                  } else if (e.key === 'Escape') {
                                    e.stopPropagation() // cancels the rename only, not the manager
                                    cancelEditCategory()
                                  }
                                }}
                                disabled={renamingSaving}
                                autoFocus
                                spellCheck={false}
                                autoComplete="off"
                                className="w-full px-2 py-1 text-sm font-medium rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none disabled:opacity-60"
                              />
                              <label htmlFor={`rename-category-bn-${cat.id}`} className="sr-only">
                                {`Bengali name for category ${cat.name}`}
                              </label>
                              <input
                                id={`rename-category-bn-${cat.id}`}
                                name="categoryNameBn"
                                type="text"
                                lang="bn"
                                value={editingCategoryNameBn}
                                onChange={(e) => setEditingCategoryNameBn(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    commitRenameCategory(cat.id)
                                  } else if (e.key === 'Escape') {
                                    e.stopPropagation()
                                    cancelEditCategory()
                                  }
                                }}
                                disabled={renamingSaving}
                                spellCheck={false}
                                autoComplete="off"
                                placeholder="Bengali name (optional)…"
                                className="w-full px-2 py-1 text-sm rounded-md border border-[var(--color-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--color-primary)] focus-visible:outline-none disabled:opacity-60"
                              />
                              {renameError && (
                                <span className="text-xs text-[var(--color-danger)]" aria-live="polite">
                                  {renameError}
                                </span>
                              )}
                            </div>
                          ) : (
                            <>
                              <span className="text-sm font-medium text-[var(--color-text-primary)] truncate block">
                                {cat.name}
                              </span>
                              {cat.nameBn && (
                                <span lang="bn" className="text-xs text-[var(--color-text-secondary)] truncate block">
                                  {cat.nameBn}
                                </span>
                              )}
                              <span className="text-xs text-[var(--color-text-muted)]">
                                {cat._count.articles} article{cat._count.articles !== 1 ? 's' : ''}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isEditing ? (
                            <>
                              {/* onMouseDown preventDefault keeps the input from
                                  blurring (which would auto-commit) before these run */}
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => commitRenameCategory(cat.id)}
                                disabled={renamingSaving || !editingCategoryName.trim()}
                                className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-success)] hover:bg-[var(--color-success-bg)] transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label={`Save category name`}
                              >
                                <Check size={14} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={cancelEditCategory}
                                disabled={renamingSaving}
                                className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label="Cancel rename"
                              >
                                <X size={14} aria-hidden="true" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => moveCategory(cat.id, index - 1)}
                                disabled={orderLocked || index === 0}
                                className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label={`Move category ${cat.name} up`}
                              >
                                <ChevronUp size={14} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveCategory(cat.id, index + 1)}
                                disabled={orderLocked || index === orderedCategories.length - 1}
                                className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label={`Move category ${cat.name} down`}
                              >
                                <ChevronDown size={14} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditCategory(cat)}
                                disabled={isBusy}
                                className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label={`Rename category ${cat.name}`}
                              >
                                <Pencil size={13} aria-hidden="true" />
                              </button>
                              <div
                                title={hasArticles ? 'Cannot delete a category that has articles' : undefined}
                              >
                                <button
                                  type="button"
                                  onClick={() => setCategoryToDelete(cat)}
                                  disabled={hasArticles || isBusy}
                                  className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[var(--color-text-muted)] disabled:hover:bg-transparent"
                                  aria-label={`Delete category ${cat.name}`}
                                >
                                  <Trash2 size={13} aria-hidden="true" />
                                </button>
                              </div>
                            </>
                          )}
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
      </Modal>

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
