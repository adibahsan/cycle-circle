'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Eye, Archive, FileText } from 'lucide-react'
import { TiptapEditor } from '@/components/TiptapEditor'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { updateArticle } from '@/app/actions/content-actions'

type CategoryOption = {
  id: string
  name: string
  _count: { articles: number }
}

type ArticleData = {
  id: string
  titleEn: string
  titleBn: string | null
  bodyEn: string
  bodyBn: string | null
  status: string
  categoryId: string | null
  cyclePhases: string[]
  publishedAt: Date | null
  category: { id: string; name: string; slug: string } | null
  author: { fullName: string | null } | null
}

interface EditArticleClientProps {
  article: ArticleData
  categories: CategoryOption[]
}

const CYCLE_PHASES = [
  { value: 'MENSTRUAL', label: 'Menstrual', color: 'text-red-600' },
  { value: 'FOLLICULAR', label: 'Follicular', color: 'text-purple-600' },
  { value: 'OVULATION', label: 'Ovulation', color: 'text-orange-600' },
  { value: 'LUTEAL', label: 'Luteal', color: 'text-pink-600' },
]

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft', icon: FileText },
  { value: 'PUBLISHED', label: 'Published', icon: Eye },
  { value: 'ARCHIVED', label: 'Archived', icon: Archive },
]

export function EditArticleClient({ article, categories }: EditArticleClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [titleEn, setTitleEn] = useState(article.titleEn)
  const [titleBn, setTitleBn] = useState(article.titleBn ?? '')
  const [bodyEn, setBodyEn] = useState(article.bodyEn)
  const [bodyBn, setBodyBn] = useState(article.bodyBn ?? '')
  const [categoryId, setCategoryId] = useState(article.categoryId ?? '')
  const [cyclePhases, setCyclePhases] = useState<string[]>(article.cyclePhases ?? [])
  const [status, setStatus] = useState(article.status)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    if (isDirty) window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  function togglePhase(phase: string) {
    setCyclePhases((prev) =>
      prev.includes(phase) ? prev.filter((p) => p !== phase) : [...prev, phase]
    )
  }

  async function handleSave() {
    if (!titleEn.trim()) {
      setError('English title is required.')
      return
    }
    if (!bodyEn.trim() || bodyEn === '<p></p>') {
      setError('English body is required.')
      return
    }
    setError(null)

    startTransition(async () => {
      try {
        await updateArticle(article.id, {
          titleEn: titleEn.trim(),
          titleBn: titleBn.trim() || undefined,
          bodyEn,
          bodyBn: bodyBn.trim() && bodyBn !== '<p></p>' ? bodyBn : undefined,
          categoryId: categoryId || undefined,
          cyclePhases,
          status,
        })
        setIsDirty(false)
        router.push('/content')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save article.')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Back bar */}
      <div className="flex items-center gap-4">
        <Link
          href="/content"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 rounded"
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to Content
        </Link>
      </div>

      {error && (
        <div aria-live="polite" className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6">
        {/* Main editor area */}
        <div className="space-y-6">
          {/* Title row */}
          <div className="glass rounded-2xl border border-[var(--color-border)] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              Titles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="title-en" className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  English Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="title-en"
                  type="text"
                  name="titleEn"
                  autoComplete="off"
                  value={titleEn}
                  onChange={(e) => { setTitleEn(e.target.value); setIsDirty(true) }}
                  placeholder="Article title in English…"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-colors transition-shadow duration-200"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="title-bn" className="block text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Bengali Title
                </label>
                <input
                  id="title-bn"
                  type="text"
                  name="titleBn"
                  autoComplete="off"
                  value={titleBn}
                  onChange={(e) => { setTitleBn(e.target.value); setIsDirty(true) }}
                  placeholder="বাংলায় শিরোনাম…"
                  lang="bn"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-primary)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-colors transition-shadow duration-200"
                />
              </div>
            </div>
          </div>

          {/* Side-by-side body editors */}
          <div className="glass rounded-2xl border border-[var(--color-border)] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              Body Content
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* English editor */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    English Body
                  </span>
                  <span className="text-red-500 text-xs">*</span>
                  <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-medium">
                    EN
                  </span>
                </div>
                <TiptapEditor
                  content={bodyEn}
                  onChange={setBodyEn}
                  placeholder="Write the article content in English…"
                  minHeight="320px"
                />
              </div>

              {/* Bengali editor */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    Bengali Body
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                    বাং
                  </span>
                </div>
                <TiptapEditor
                  content={bodyBn}
                  onChange={setBodyBn}
                  placeholder="বাংলায় আর্টিকেলের বিষয়বস্তু লিখুন…"
                  minHeight="320px"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status */}
          <div className="glass rounded-2xl border border-[var(--color-border)] p-4 space-y-3">
            <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              Status
            </h3>
            <div className="space-y-2">
              {STATUS_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const isSelected = status === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setStatus(opt.value); setIsDirty(true) }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-colors transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 ${
                      isSelected
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/8'
                        : 'border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'
                    }`}
                  >
                    <Icon
                      size={14}
                      className={isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}
                    />
                    <span className={`text-sm font-medium flex-1 ${isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
                      {opt.label}
                    </span>
                    {isSelected && (
                      <div className="h-2 w-2 rounded-full bg-[var(--color-primary)]" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Category */}
          <div className="glass rounded-2xl border border-[var(--color-border)] p-4 space-y-3">
            <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              Category
            </h3>
            <Select
              id="article-category"
              aria-label="Category"
              value={categoryId}
              onChange={(v) => { setCategoryId(v); setIsDirty(true) }}
              selectSize="sm"
              className="bg-[var(--color-bg-primary)]"
              options={[
                { value: '', label: 'No category' },
                ...categories.map((cat) => ({ value: cat.id, label: cat.name })),
              ]}
            />
          </div>

          {/* Cycle Phases */}
          <div className="glass rounded-2xl border border-[var(--color-border)] p-4 space-y-3">
            <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              Cycle Phases
            </h3>
            <div className="space-y-2">
              {CYCLE_PHASES.map((phase) => {
                const checked = cyclePhases.includes(phase.value)
                return (
                  <label
                    key={phase.value}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-colors transition-shadow duration-150 ${
                      checked
                        ? 'border-[var(--color-primary)]/40 bg-[var(--color-primary)]/6'
                        : 'border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePhase(phase.value)}
                      className="h-3.5 w-3.5 rounded border-[var(--color-border)] accent-[var(--color-primary)] cursor-pointer"
                    />
                    <span className={`text-sm font-medium ${checked ? phase.color : 'text-[var(--color-text-secondary)]'}`}>
                      {phase.label}
                    </span>
                  </label>
                )
              })}
            </div>
            {cyclePhases.length > 0 && (
              <button
                type="button"
                onClick={() => setCyclePhases([])}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Article metadata */}
          {article.publishedAt && (
            <div className="glass rounded-2xl border border-[var(--color-border)] p-4 space-y-1">
              <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                Metadata
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Published{' '}
                <span className="text-[var(--color-text-secondary)]">
                  {new Date(article.publishedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </p>
              {article.author?.fullName && (
                <p className="text-xs text-[var(--color-text-muted)]">
                  Author{' '}
                  <span className="text-[var(--color-text-secondary)]">{article.author.fullName}</span>
                </p>
              )}
            </div>
          )}

          {/* Save action */}
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={handleSave}
            loading={isPending}
            disabled={isPending}
            className="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500"
          >
            <Save size={16} aria-hidden="true" />
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}
